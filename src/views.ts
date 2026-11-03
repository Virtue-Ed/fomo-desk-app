import { snapshotSource, staleAfterMs } from './config';
import { paintChart } from './chart';
import { button, h } from './dom';
import {
  activitySubtitle,
  activityTitle,
  agentLabel,
  formatActivityPct,
  formatAgo,
  formatNum,
  formatPct,
  formatPrice,
  formatUsd,
  formatWhen,
  formatMultiple,
  titleCase,
} from './format';
import { agentGlyph, brandMark, scoreRing, tabIcon } from './icons';
import { isRunning, sortAgents, statusTone, TIMEFRAMES } from './model';
import { statLines } from './stats';
import type { ActivityItem, Agent, AppState, Position, Snapshot, Tab, Timeframe } from './types';

export interface Actions {
  setTab: (tab: Tab) => void;
  setTimeframe: (tf: Timeframe) => void;
  saveToken: (raw: string) => void;
  clearToken: () => void;
  retry: () => void;
  leaveDemo: () => void;
  previewDemo: () => void;
}

const AGENT_COLOR: Record<string, string> = {
  scanner: '#2ee6c7',
  scanner_ws: '#7ad7ff',
  auditor: '#ff5d6c',
  analyst: '#ff5a5a',
  executor: '#b07cff',
  risk: '#ff8a34',
  telegram: '#2aabee',
};

export function buildApp(state: AppState, actions: Actions): HTMLElement {
  const app = h('div', { class: 'app' });
  app.append(renderHeader(state));
  app.append(renderStale(state));
  const main = h('main', { class: 'main', attrs: { id: 'main' } });
  if (state.notice) main.append(h('div', { class: 'note banner', text: state.notice, attrs: { role: 'status' } }));
  if (state.error && state.snapshot) main.append(renderError(state, actions));
  if (!state.snapshot && state.tab !== 'account') main.append(renderGate(state, actions));
  else if (state.tab === 'home' && state.snapshot) main.append(renderHome(state, actions));
  else if (state.tab === 'agents' && state.snapshot) main.append(renderAgents(state.snapshot));
  else if (state.tab === 'activity' && state.snapshot) main.append(renderActivity(state.snapshot));
  else main.append(renderAccount(state, actions));
  app.append(main, renderTabs(state, actions));
  return app;
}

export function mountDynamic(root: ParentNode, state: AppState): void {
  const host = root.querySelector<HTMLElement>('[data-chart]');
  if (host && state.snapshot && state.tab === 'home') paintChart(host, state.snapshot, state.tf);
  bindDots(root);
}

function renderHeader(state: AppState): HTMLElement {
  const header = h('header', { class: 'top' });
  const brand = h('div', { class: 'brand' });
  brand.append(brandMark());
  const text = h('div', { class: 'brand-text' });
  text.append(h('h1', { text: 'Grok Bot Desk' }));
  const updated = h('p', {
    class: staleNow(state) ? 'updated is-stale' : 'updated',
    attrs: { 'data-updated': '1' },
  });
  updated.append(h('span', { text: updatedText(state), attrs: { 'data-ago': '1' } }));
  if (state.demo) updated.append(h('span', { class: 'demo-mini', text: 'DEMO' }));
  text.append(updated);
  brand.append(text);
  header.append(brand);
  if (state.snapshot) {
    header.append(
      h('div', { class: 'badges' }, [
        h('span', {
          class: `mode mode-${state.snapshot.mode.toLowerCase()}`,
          text: state.snapshot.modeLabel,
        }),
      ]),
    );
  }
  return header;
}

function renderStale(state: AppState): HTMLElement {
  const banner = h('div', {
    class: 'stale',
    attrs: { 'data-stale': '1', role: 'status' },
  });
  banner.append(h('span', { text: staleText(state), attrs: { 'data-stale-text': '1' } }));
  banner.hidden = !staleNow(state);
  return banner;
}

function renderError(state: AppState, actions: Actions): HTMLElement {
  const box = h('div', { class: 'alert banner', attrs: { role: 'alert' } });
  box.append(h('p', { text: state.error ?? '' }));
  if (!state.demo) box.append(button('btn btn-ghost', 'Retry', actions.retry));
  return box;
}

function renderGate(state: AppState, actions: Actions): HTMLElement {
  const wrap = h('div', { class: 'gate pad' });
  if (state.loading) {
    wrap.append(h('p', { class: 'gate-title', text: 'Fetching snapshot…' }));
    return wrap;
  }
  if (state.error) {
    wrap.append(h('p', { class: 'gate-title', text: 'The snapshot didn’t load.' }));
    wrap.append(h('p', { class: 'help', text: state.error }));
    wrap.append(button('btn btn-primary', 'Retry', actions.retry));
  } else {
    wrap.append(h('p', { class: 'gate-title', text: 'The desk is waiting for a token.' }));
    wrap.append(
      h('p', {
        class: 'help',
        text: 'Paste a fine-grained GitHub token with read-only Contents on the private data repo. This app only reads a snapshot. It cannot trade.',
      }),
    );
  }
  wrap.append(button('btn btn-primary', 'Go to Account', () => actions.setTab('account')));
  if (!state.demo) wrap.append(button('btn btn-ghost', 'Preview sample data', actions.previewDemo));
  return wrap;
}

function renderHome(state: AppState, actions: Actions): HTMLElement {
  const snapshot = state.snapshot;
  if (!snapshot) return h('div');
  const page = h('div', { class: 'home' });
  const hero = h('div', { class: 'pad hero' });
  hero.append(h('p', { class: 'balance', text: formatUsd(snapshot.stackUsd) }));
  const row = h('div', { class: 'pnl-row' });
  const tone = snapshot.pnlUsd < 0 || snapshot.pnlPct < 0 ? 'neg' : 'pos';
  row.append(
    h('p', {
      class: `pnl ${tone}`,
      text: `${formatUsd(snapshot.pnlUsd)} (${formatPct(snapshot.pnlPct, 2)})`,
    }),
  );
  if (snapshot.multiple != null) {
    row.append(h('span', { class: `mult ${tone}`, text: formatMultiple(snapshot.multiple) }));
  }
  hero.append(row);
  page.append(hero);

  const chartBlock = h('div', { class: 'pad' });
  const wrap = h('div', { class: 'chart-wrap' });
  wrap.append(h('div', { class: 'chart-host', attrs: { 'data-chart': '1' } }));
  chartBlock.append(wrap, renderChips(state, actions));
  page.append(chartBlock);

  const agents = sortAgents(snapshot.agents);
  const head = h('div', { class: 'section-head pad' });
  head.append(h('h2', { text: 'Agents' }));
  head.append(h('span', { class: 'running', text: `${agents.filter((agent) => isRunning(agent.status)).length} running` }));
  page.append(head);
  if (!agents.length) {
    page.append(h('p', { class: 'help pad', text: 'No agents in this snapshot.' }));
  } else {
    const scroller = h('div', { class: 'scroller', attrs: { 'data-scroller': '1' } });
    for (const agent of agents) scroller.append(agentCard(agent));
    page.append(scroller, h('div', { class: 'dots', attrs: { 'data-dots': '1' } }));
  }

  const feedHead = h('div', { class: 'section-head pad' });
  feedHead.append(h('h2', { text: 'Activity' }));
  feedHead.append(button('linkish', 'See all', () => actions.setTab('activity')));
  page.append(feedHead);
  const feed = h('div', { class: 'feed pad' });
  const items = snapshot.activity.slice(0, 3);
  if (!items.length) feed.append(h('p', { class: 'help', text: 'No activity yet.' }));
  for (const item of items) feed.append(feedRow(item, snapshot.generatedAt));
  page.append(feed);
  return page;
}

function renderChips(state: AppState, actions: Actions): HTMLElement {
  const row = h('div', { class: 'chips', attrs: { role: 'tablist', 'aria-label': 'Chart window' } });
  for (const tf of TIMEFRAMES) {
    const on = state.tf === tf.id;
    const chip = h('button', {
      class: on ? 'chip is-on' : 'chip',
      attrs: {
        type: 'button',
        role: 'tab',
        'data-tf': tf.id,
        'aria-selected': on ? 'true' : 'false',
      },
    });
    if (tf.id === 'live') chip.append(h('span', { class: 'live-dot', attrs: { 'aria-hidden': 'true' } }));
    chip.append(document.createTextNode(tf.label));
    chip.addEventListener('click', () => actions.setTimeframe(tf.id));
    row.append(chip);
  }
  return row;
}

function agentCard(agent: Agent): HTMLElement {
  const card = h('article', { class: 'agent-card' });
  const top = h('div', { class: 'agent-top' });
  top.append(agentBadge(agent.name));
  const score = typeof agent.stats.score === 'number' ? agent.stats.score : null;
  if (score != null) top.append(scoreRing(score));
  card.append(top);
  const nameRow = h('div', { class: 'agent-name-row' });
  nameRow.append(h('div', { class: 'agent-name', text: agentLabel(agent.name) }));
  nameRow.append(h('div', { class: `agent-status tone-${statusTone(agent.status)}`, text: titleCase(agent.status) }));
  card.append(nameRow);
  const stats = statLines(agent.stats);
  stats.lines.forEach((line, index) => {
    card.append(h('div', { class: index === 0 ? 'agent-stat primary' : 'agent-stat', text: line }));
  });
  if (stats.pill) card.append(h('div', { class: 'flag', text: stats.pill }));
  return card;
}

function agentBadge(name: string): HTMLElement {
  const color = AGENT_COLOR[name] ?? '#c5ccd6';
  const badge = h('div', { class: 'badge-icon', attrs: { style: `--c:${color}` } });
  badge.append(agentGlyph(name));
  return badge;
}

function renderAgents(snapshot: Snapshot): HTMLElement {
  const page = h('div', { class: 'pad page' });
  const head = h('div', { class: 'section-head' });
  head.append(h('h2', { text: 'Agents' }));
  head.append(
    h('span', {
      class: 'running',
      text: `${snapshot.agents.filter((agent) => isRunning(agent.status)).length} running`,
    }),
  );
  page.append(head, summaryRow(snapshot));
  const counts = countsLine(snapshot);
  if (counts) page.append(h('p', { class: 'counts', text: counts }));
  const list = h('div', { class: 'msgs' });
  const ordered = [...snapshot.agents].sort((a, b) => (b.lastBeat ?? 0) - (a.lastBeat ?? 0));
  if (!ordered.length) list.append(h('p', { class: 'help', text: 'No agents in this snapshot.' }));
  for (const agent of ordered) list.append(messageRow(agent, snapshot.generatedAt));
  page.append(list);
  return page;
}

function summaryRow(snapshot: Snapshot): HTMLElement {
  const row = h('div', { class: 'msg' });
  row.append(brandMark());
  const body = h('div', {});
  body.append(h('div', { class: 'msg-name', text: 'Grok Bot' }));
  body.append(h('div', { class: 'msg-line', text: summaryLine(snapshot) }));
  row.append(body);
  return row;
}

function summaryLine(snapshot: Snapshot): string {
  const parts: string[] = [];
  if (snapshot.startStackUsd > 0) {
    parts.push(`${formatUsd(snapshot.startStackUsd)} → ${formatUsd(snapshot.stackUsd)}`);
  } else {
    parts.push(formatUsd(snapshot.stackUsd));
  }
  if (snapshot.counts.auditorRefused) parts.push(`${formatNum(snapshot.counts.auditorRefused)} refused`);
  return parts.join(' · ');
}

function countsLine(snapshot: Snapshot): string {
  const counts = snapshot.counts;
  const parts: string[] = [];
  if (counts.seen) parts.push(`${formatNum(counts.seen)} seen`);
  if (counts.scannerKilled) parts.push(`${formatNum(counts.scannerKilled)} killed`);
  if (counts.auditorRefused) parts.push(`${formatNum(counts.auditorRefused)} auditor refused`);
  if (counts.analystRejected) parts.push(`${formatNum(counts.analystRejected)} analyst rejected`);
  if (counts.waiting) parts.push(`${formatNum(counts.waiting)} waiting`);
  return parts.join(' · ');
}

function messageRow(agent: Agent, generatedAt: number): HTMLElement {
  const row = h('div', { class: 'msg' });
  row.append(agentBadge(agent.name));
  const body = h('div', {});
  body.append(h('div', { class: 'msg-name', text: agentLabel(agent.name) }));
  body.append(h('div', { class: 'msg-line', text: agent.line || 'No update yet.' }));
  const when = agent.lastBeat != null ? formatWhen(agent.lastBeat, generatedAt) : '';
  const meta = [titleCase(agent.status), when].filter(Boolean).join(' · ');
  if (meta) body.append(h('div', { class: 'msg-meta', text: meta }));
  row.append(body);
  const fresh =
    agent.lastBeat != null && generatedAt - agent.lastBeat <= 3 * 60 * 1000 && generatedAt - agent.lastBeat >= -60_000;
  if (fresh) row.append(h('span', { class: 'fresh', attrs: { 'aria-label': 'Recent' } }));
  return row;
}

function renderActivity(snapshot: Snapshot): HTMLElement {
  const page = h('div', { class: 'pad page' });
  page.append(h('h2', { class: 'page-title', text: 'Activity' }));
  const openHead = h('div', { class: 'section-head tight' });
  openHead.append(h('h3', { text: 'Open' }));
  openHead.append(h('span', { class: 'running', text: String(snapshot.positions.length) }));
  page.append(openHead);
  if (!snapshot.positions.length) {
    page.append(h('p', { class: 'help', text: 'No open positions.' }));
  } else {
    const open = h('div', { class: 'feed' });
    for (const position of snapshot.positions) open.append(positionRow(position));
    page.append(open);
  }
  const feedHead = h('div', { class: 'section-head' });
  feedHead.append(h('h3', { text: 'Feed' }));
  page.append(feedHead);
  const feed = h('div', { class: 'feed' });
  if (!snapshot.activity.length) feed.append(h('p', { class: 'help', text: 'No activity yet.' }));
  for (const item of snapshot.activity) feed.append(feedRow(item, snapshot.generatedAt));
  page.append(feed);
  return page;
}

function positionRow(position: Position): HTMLElement {
  const pnl = position.pnlPct;
  const tone = pnl == null ? '' : pnl < 0 ? 'neg' : 'pos';
  const body = h('div', {}, [
    h('div', { class: 'feed-title', text: position.symbol }),
    h('div', { class: 'feed-sub', text: positionSubtitle(position) }),
  ]);
  const nums = h('div', { class: `feed-num ${tone}` });
  if (pnl != null) {
    nums.append(h('div', { class: 'feed-pnl', text: formatPct(pnl, Math.abs(pnl) >= 10 ? 0 : 1, true) }));
  }
  nums.append(h('div', { class: 'feed-pct', text: 'open' }));
  return maybeLink(position.url, 'feed-row', [tokenAvatar(position.symbol), body, nums]);
}

function positionSubtitle(position: Position): string {
  const parts: string[] = [];
  if (position.sizeUsd != null) parts.push(`${formatUsd(position.sizeUsd)} in`);
  if (position.entryUsd != null) parts.push(`entry ${formatPrice(position.entryUsd)}`);
  if (position.stopPct != null) parts.push(`stop ${formatPct(position.stopPct, 0)}`);
  return parts.join(' · ');
}

function feedRow(item: ActivityItem, referenceMs: number): HTMLElement {
  const negative = (item.pnlUsd ?? 0) < 0 || (item.pnlPct ?? 0) < 0;
  const positive = item.pnlUsd != null && item.pnlUsd > 0;
  const tone = negative ? 'neg' : positive ? 'pos' : '';
  const body = h('div', {}, [
    h('div', { class: 'feed-title', text: activityTitle(item) }),
    h('div', { class: 'feed-sub', text: activitySubtitle(item, formatWhen(item.t, referenceMs)) }),
  ]);
  const nums = h('div', { class: `feed-num ${tone}` });
  if (item.pnlUsd != null) nums.append(h('div', { class: 'feed-pnl', text: formatUsd(item.pnlUsd, true) }));
  if (item.pnlPct != null) nums.append(h('div', { class: 'feed-pct', text: formatActivityPct(item.pnlPct) }));
  return maybeLink(item.url, 'feed-row', [tokenAvatar(item.symbol ?? item.agent ?? '?'), body, nums]);
}

function tokenAvatar(seed: string): HTMLElement {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const letter = (seed.replace(/[^a-z0-9]/gi, '')[0] ?? '?').toUpperCase();
  return h('div', {
    class: 'token',
    text: letter,
    attrs: { style: `--h:${hash % 360}`, 'aria-hidden': 'true' },
  });
}

function maybeLink(url: string | null, className: string, kids: Node[]): HTMLElement {
  if (!url) return h('div', { class: className }, kids);
  return h('a', {
    class: className,
    attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' },
  }, kids);
}

function renderAccount(state: AppState, actions: Actions): HTMLElement {
  const page = h('div', { class: 'pad page' });
  page.append(h('h2', { class: 'page-title', text: 'Account' }));
  if (state.demo) {
    page.append(
      h('div', {
        class: 'note',
        text: 'Demo mode (?demo=1) is showing sample-snapshot.json, with times shifted to now. GitHub is not called.',
      }),
    );
    page.append(button('btn btn-ghost', 'Leave demo', actions.leaveDemo));
  }

  const connection = h('section', { class: 'card' });
  connection.append(h('h3', { class: 'card-title', text: 'Connection' }));
  connection.append(h('p', { class: 'card-line', text: state.demo ? 'Source: sample data' : state.hasToken ? 'Token saved on this device' : 'No token saved' }));
  if (state.loading) connection.append(h('p', { class: 'card-line', text: 'Fetching…' }));
  if (state.snapshot?.generatedAtKnown) {
    connection.append(
      h('p', {
        class: 'card-line',
        text: `Snapshot ${formatWhen(state.snapshot.generatedAt, state.snapshot.generatedAt)} CT`,
      }),
    );
  }
  page.append(connection);

  const form = h('form', { class: 'stack' });
  form.append(h('label', { class: 'label', text: 'Fine-grained GitHub token', attrs: { for: 'token-input' } }));
  form.append(
    h('p', {
      class: 'help',
      text: `Read-only Contents on ${snapshotSource.owner}/${snapshotSource.repo} only. It stays in this browser and is sent only to api.github.com.`,
    }),
  );
  const input = h('input', {
    class: 'field',
    attrs: {
      id: 'token-input',
      type: 'password',
      name: 'github-token',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      placeholder: 'github_pat_…',
      enterkeyhint: 'done',
      'aria-label': 'Fine-grained GitHub token',
    },
  });
  form.append(input);
  form.append(
    h('button', {
      class: 'btn btn-primary',
      text: state.hasToken ? 'Replace token' : 'Save token',
      attrs: { type: 'submit' },
    }),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.saveToken((input as HTMLInputElement).value);
  });
  page.append(form);
  page.append(button('btn btn-danger', 'Sign out / clear token', actions.clearToken));

  const source = h('section', { class: 'card' });
  source.append(h('h3', { class: 'card-title', text: 'Snapshot source' }));
  source.append(h('p', { class: 'code', text: `${snapshotSource.owner}/${snapshotSource.repo}` }));
  source.append(h('p', { class: 'code', text: `${snapshotSource.path} · ${snapshotSource.ref}` }));
  source.append(
    h('p', {
      class: 'help',
      text: 'Change the owner, repo, or path in src/config.ts. The desk refreshes every 30 seconds while this page is visible. Reloading offline keeps the shell and drops the numbers.',
    }),
  );
  page.append(source);

  if (state.snapshot?.lastReportUrl) {
    page.append(
      h('a', {
        class: 'btn btn-ghost',
        text: 'Open last report',
        attrs: { href: state.snapshot.lastReportUrl, target: '_blank', rel: 'noopener noreferrer' },
      }),
    );
  } else if (state.snapshot) {
    page.append(h('p', { class: 'help', text: 'No night report link in this snapshot.' }));
  }
  return page;
}

function renderTabs(state: AppState, actions: Actions): HTMLElement {
  const nav = h('nav', { class: 'tabs', attrs: { 'aria-label': 'Primary' } });
  const items: Array<[Tab, string]> = [
    ['home', 'Home'],
    ['agents', 'Agents'],
    ['activity', 'Activity'],
    ['account', 'Account'],
  ];
  for (const [id, label] of items) {
    const tab = h('button', { class: 'tab', attrs: { type: 'button' } });
    if (state.tab === id) tab.setAttribute('aria-current', 'page');
    tab.append(tabIcon(id), h('span', { text: label }));
    tab.addEventListener('click', () => actions.setTab(id));
    nav.append(tab);
  }
  return nav;
}

function bindDots(root: ParentNode): void {
  const scroller = root.querySelector<HTMLElement>('[data-scroller]');
  const dots = root.querySelector<HTMLElement>('[data-dots]');
  if (!scroller || !dots) return;
  const cards = [...scroller.querySelectorAll<HTMLElement>('.agent-card')];
  dots.replaceChildren();
  if (cards.length < 2) return;
  const marks = cards.map((_, index) => h('span', { class: index === 0 ? 'dot is-on' : 'dot' }));
  dots.append(...marks);
  const update = () => {
    const stride = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : cards[0].offsetWidth;
    if (stride <= 0) return;
    const index = Math.max(0, Math.min(cards.length - 1, Math.round(scroller.scrollLeft / stride)));
    marks.forEach((dot, dotIndex) => dot.classList.toggle('is-on', dotIndex === index));
  };
  scroller.addEventListener('scroll', update, { passive: true });
  update();
}

export function updatedText(state: AppState, now = Date.now()): string {
  if (!state.snapshot) {
    if (state.loading) return 'Fetching snapshot…';
    if (!state.demo && !state.hasToken) return 'Add a token to load the desk';
    return 'No snapshot yet';
  }
  if (!state.snapshot.generatedAtKnown) return 'Last updated unknown';
  return `Last updated ${formatAgo(state.snapshot.generatedAt, now)}`;
}

export function staleNow(state: AppState, now = Date.now()): boolean {
  if (!state.snapshot) return false;
  if (!state.snapshot.generatedAtKnown) return true;
  return now - state.snapshot.generatedAt > staleAfterMs;
}

export function staleText(state: AppState): string {
  if (state.snapshot && !state.snapshot.generatedAtKnown) return 'This snapshot has no generated_at time.';
  return 'This snapshot is more than 5 minutes old.';
}
