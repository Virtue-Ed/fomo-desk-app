import sampleRaw from '../sample-snapshot.json';
import './styles.css';
import { pollIntervalMs } from './config';
import { fetchSnapshot } from './github';
import { normalizeSnapshot, rebaseToNow } from './model';
import { cleanToken, clearToken, readToken, writeToken } from './storage';
import type { AppState, Book, Tab, Timeframe } from './types';
import { buildApp, mountDynamic, staleNow, staleText, updatedText } from './views';

const state: AppState = {
  tab: 'home',
  tf: 'live',
  snapshot: null,
  error: null,
  notice: null,
  loading: false,
  demo: false,
  hasToken: false,
  book: 'main',
};

let pollTimer = 0;
let controller: AbortController | null = null;
let etag: string | null = null;

const actions = {
  setTab,
  setTimeframe,
  setBook,
  saveToken,
  clearToken: onClearToken,
  retry: () => {
    void refresh();
  },
  leaveDemo,
  previewDemo,
};

function isDemoMode(): boolean {
  return new URLSearchParams(location.search).get('demo') === '1';
}

function readTab(): Tab {
  const name = location.hash.replace(/^#/, '');
  if (name === 'agents' || name === 'activity' || name === 'account' || name === 'home') return name;
  return 'home';
}

function stripSecretsFromUrl(): void {
  const url = new URL(location.href);
  let dirty = false;
  for (const key of ['token', 'access_token', 'pat', 'github_token']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      dirty = true;
    }
  }
  if (!dirty) return;
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  state.notice = 'A token was removed from the page address. Paste it in Account so it is not kept in browser history.';
}

function setBook(book: Book): void {
  if (state.book === book) return;
  state.book = book;
  render(false);
}

function render(resetScroll = false): void {
  if (state.book === 'copy' && !state.snapshot?.copy) state.book = 'main';
  const previous = document.querySelector<HTMLElement>('.main');
  const scroll = resetScroll ? 0 : (previous?.scrollTop ?? 0);
  const typing =
    document.activeElement instanceof HTMLInputElement && document.activeElement.id === 'token-input'
      ? {
          value: document.activeElement.value,
          start: document.activeElement.selectionStart,
          end: document.activeElement.selectionEnd,
        }
      : null;

  const root = document.querySelector('#app');
  if (!root) return;
  root.replaceChildren(buildApp(state, actions));
  const main = root.querySelector<HTMLElement>('.main');
  if (main) main.scrollTop = scroll;
  if (typing) {
    const input = root.querySelector<HTMLInputElement>('#token-input');
    if (input) {
      input.value = typing.value;
      input.focus();
      if (typing.start != null && typing.end != null) input.setSelectionRange(typing.start, typing.end);
    }
  }
  mountDynamic(root, state);
}

function setTab(tab: Tab): void {
  if (state.tab === tab) return;
  state.tab = tab;
  const url = new URL(location.href);
  url.hash = tab;
  history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
  render(true);
}

function setTimeframe(tf: Timeframe): void {
  if (state.tf === tf) return;
  state.tf = tf;
  render(false);
}

function saveToken(raw: string): void {
  const token = cleanToken(raw);
  if (token.length < 10) {
    state.error = 'That does not look like a token. Paste the full fine-grained token.';
    render();
    return;
  }
  try {
    writeToken(token);
  } catch {
    state.error = 'This browser blocked local storage, so the token could not be saved.';
    render();
    return;
  }
  state.hasToken = true;
  state.error = null;
  state.notice = state.demo ? 'Token saved on this device. Leave demo to load the private snapshot.' : 'Token saved on this device.';
  etag = null;
  if (state.demo) {
    render();
    return;
  }
  state.tab = 'home';
  const url = new URL(location.href);
  url.hash = 'home';
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  render(true);
  startPolling();
}

function onClearToken(): void {
  try {
    clearToken();
  } catch {
    state.error = 'This browser blocked local storage, so the token could not be cleared.';
    render();
    return;
  }
  state.hasToken = false;
  state.notice = 'Token cleared from this browser.';
  state.error = null;
  etag = null;
  if (!state.demo) {
    stopPolling();
    state.snapshot = null;
  }
  render();
}

function leaveDemo(): void {
  const url = new URL(location.href);
  url.searchParams.delete('demo');
  location.assign(`${url.pathname}${url.search}${url.hash}`);
}

function previewDemo(): void {
  const url = new URL(location.href);
  url.searchParams.set('demo', '1');
  url.hash = 'home';
  location.assign(`${url.pathname}${url.search}${url.hash}`);
}

function loadDemo(): void {
  state.snapshot = normalizeSnapshot(rebaseToNow(sampleRaw, Date.now() - 4000));
  state.loading = false;
  state.error = null;
}

function stopPolling(): void {
  window.clearInterval(pollTimer);
  pollTimer = 0;
  controller?.abort();
  controller = null;
}

function startPolling(): void {
  stopPolling();
  if (state.demo || document.visibilityState === 'hidden' || !readToken()) return;
  void refresh();
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refresh();
  }, pollIntervalMs);
}

async function refresh(): Promise<void> {
  const token = readToken();
  if (!token || state.demo) return;
  controller?.abort();
  const next = new AbortController();
  controller = next;
  const first = state.snapshot == null;
  state.loading = first;
  if (first) render();
  try {
    const result = await fetchSnapshot(token, etag, next.signal);
    if (next.signal.aborted) return;
    etag = result.etag;
    state.loading = false;
    state.error = null;
    if (result.notModified) return;
    state.snapshot = normalizeSnapshot(result.raw);
    render();
  } catch (error) {
    if (next.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
    state.loading = false;
    state.error = error instanceof Error ? error.message : 'Could not load the snapshot.';
    render();
  }
}

function tick(): void {
  const ago = document.querySelector<HTMLElement>('[data-ago]');
  if (ago) ago.textContent = updatedText(state);
  document.querySelector('[data-updated]')?.classList.toggle('is-stale', staleNow(state));
  const banner = document.querySelector<HTMLElement>('[data-stale]');
  const label = document.querySelector<HTMLElement>('[data-stale-text]');
  if (label) label.textContent = staleText(state);
  if (banner) banner.hidden = !staleNow(state);
}

function registerWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* Online reads still work if the worker fails to install. */
    });
  });
}

function boot(): void {
  stripSecretsFromUrl();
  state.demo = isDemoMode();
  state.hasToken = readToken() != null;
  state.tab = readTab();
  if (state.demo) loadDemo();
  render();
  registerWorker();
  window.setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startPolling();
    else stopPolling();
  });
  window.addEventListener('popstate', () => {
    state.tab = readTab();
    render(true);
  });
  if (!state.demo) startPolling();
}

boot();
