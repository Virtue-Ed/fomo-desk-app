import { leaderHandle } from './format';
import type {
  ActivityItem,
  Agent,
  Book,
  BookView,
  CopyBook,
  CopyWallet,
  Counts,
  EquityPoint,
  Position,
  Snapshot,
  Timeframe,
  Trade,
} from './types';
import { httpsUrl } from './url';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const WINDOW_MS: Record<Exclude<Timeframe, 'all'>, number> = {
  live: 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

export const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: 'live', label: 'LIVE' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: '1D' },
  { id: '1w', label: '1W' },
  { id: 'all', label: 'ALL' },
];

const HOME_ORDER = ['scanner', 'auditor', 'analyst', 'executor', 'risk', 'copier', 'scanner_ws', 'telegram', 'publisher'];

function rec(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function time(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readGeneratedAt(value: unknown): number | null {
  const row = rec(value);
  if (!row) return null;
  return time(row.generated_at);
}

function maxTimestamp(value: unknown): number | null {
  let max: number | null = null;
  const visit = (node: unknown) => {
    if (typeof node === 'string' && ISO.test(node)) {
      const parsed = Date.parse(node);
      if (Number.isFinite(parsed)) max = max == null ? parsed : Math.max(max, parsed);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      Object.values(node as Record<string, unknown>).forEach(visit);
    }
  };
  visit(value);
  return max;
}

function shiftTimes(value: unknown, delta: number): unknown {
  if (typeof value === 'string' && ISO.test(value)) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed + delta).toISOString();
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => shiftTimes(item, delta));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = shiftTimes(item, delta);
    }
    return out;
  }
  return value;
}

/** Slide ISO timestamps so generated_at lands on now. Relative gaps stay put. */
export function rebaseToNow(raw: unknown, now = Date.now()): unknown {
  const anchor = readGeneratedAt(raw) ?? maxTimestamp(raw);
  const copy = structuredClone(raw);
  if (anchor == null) return copy;
  return shiftTimes(copy, now - anchor);
}

function parseMode(value: unknown): { mode: Snapshot['mode']; modeLabel: string } {
  const raw = str(value).toUpperCase();
  if (raw === 'PAPER' || raw === 'LIVE') return { mode: raw, modeLabel: raw };
  if (!raw) return { mode: 'UNKNOWN', modeLabel: 'UNKNOWN' };
  return { mode: 'UNKNOWN', modeLabel: raw.slice(0, 16) };
}

function parseEquity(value: unknown): EquityPoint[] {
  const points = new Map<number, number>();
  for (const item of list(value)) {
    const row = rec(item);
    if (!row) continue;
    const t = time(row.t);
    const v = num(row.v);
    if (t == null || v == null) continue;
    points.set(t, v);
  }
  return [...points.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v }));
}

function parseTrade(value: unknown, index: number): Trade | null {
  const row = rec(value);
  if (!row) return null;
  const t = time(row.t);
  const symbol = str(row.symbol);
  if (t == null || !symbol) return null;
  const sideRaw = str(row.side).toLowerCase();
  return {
    id: str(row.id) || `${symbol}-${t}-${index}`,
    symbol,
    side: sideRaw === 'buy' ? 'buy' : 'sell',
    t,
    usd: num(row.usd) ?? 0,
    pnlUsd: num(row.pnl_usd),
    pnlPct: num(row.pnl_pct),
    reason: str(row.reason),
    url: httpsUrl(row.url),
  };
}

function leaderForSymbol(symbol: string, trades: Trade[]): string | null {
  const related = trades.filter((trade) => trade.symbol === symbol && trade.reason).sort((a, b) => b.t - a.t);
  for (const trade of related) {
    const handle = leaderHandle(trade.reason);
    if (handle) return handle;
  }
  return null;
}

function parsePosition(value: unknown): Position | null {
  const row = rec(value);
  if (!row) return null;
  const symbol = str(row.symbol);
  if (!symbol) return null;
  return {
    symbol,
    entryUsd: num(row.entry_usd),
    sizeUsd: num(row.size_usd),
    pnlPct: num(row.pnl_pct),
    stopPct: num(row.stop_pct),
    url: httpsUrl(row.url),
    leader: null,
  };
}

function parseStats(value: unknown): Record<string, number | string> {
  const row = rec(value);
  if (!row) return {};
  const stats: Record<string, number | string> = {};
  for (const [key, item] of Object.entries(row)) {
    if (typeof item === 'number' && Number.isFinite(item)) stats[key] = item;
    else if (typeof item === 'string' && item.trim()) stats[key] = item.trim();
  }
  return stats;
}

function parseAgent(value: unknown): Agent | null {
  const row = rec(value);
  if (!row) return null;
  const name = str(row.name).toLowerCase();
  if (!name) return null;
  return {
    name,
    status: str(row.status),
    lastBeat: time(row.last_beat),
    line: str(row.line),
    stats: parseStats(row.stats),
  };
}

function parseActivity(value: unknown): ActivityItem | null {
  const row = rec(value);
  if (!row) return null;
  const t = time(row.t);
  if (t == null) return null;
  const symbol = str(row.symbol);
  return {
    t,
    agent: str(row.agent).toLowerCase(),
    kind: str(row.kind),
    symbol: symbol || null,
    text: str(row.text),
    pnlUsd: num(row.pnl_usd),
    pnlPct: num(row.pnl_pct),
    url: httpsUrl(row.url),
    copy: false,
  };
}

function parseCounts(value: unknown): Counts {
  const row = rec(value);
  const pick = (key: string) => num(row?.[key]) ?? 0;
  return {
    seen: pick('seen'),
    scannerKilled: pick('scanner_killed'),
    auditorRefused: pick('auditor_refused'),
    analystRejected: pick('analyst_rejected'),
    waiting: pick('waiting'),
  };
}

function parseCopyEquity(value: unknown): { equity: number | null; series: EquityPoint[] } {
  if (Array.isArray(value)) {
    const series = parseEquity(value);
    return { equity: series.at(-1)?.v ?? null, series };
  }
  return { equity: num(value), series: [] };
}

function parseWallet(value: unknown): CopyWallet | null {
  const row = rec(value);
  if (!row) return null;
  const wallet = str(row.wallet);
  const handle = str(row.handle) || str(row.name);
  if (!wallet && !handle) return null;
  return { handle: handle || shortFallback(wallet), wallet, rank: num(row.rank) };
}

function shortFallback(wallet: string): string {
  return wallet.length <= 12 ? wallet : `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

function parseCopy(row: Record<string, unknown>, generatedAt: number): CopyBook | null {
  const equityParsed = parseCopyEquity(row.copy_equity_usd);
  const trades = list(row.copy_trades)
    .map(parseTrade)
    .filter((item): item is Trade => item != null)
    .sort((a, b) => a.t - b.t);
  const positions = list(row.copy_positions)
    .map(parsePosition)
    .filter((item): item is Position => item != null)
    .map((position) => ({ ...position, leader: leaderForSymbol(position.symbol, trades) }));
  const wallets = list(row.copy_wallets)
    .map(parseWallet)
    .filter((item): item is CopyWallet => item != null);
  const leadersAt = time(row.copy_leaders_captured_at);
  const stackUsd = num(row.copy_stack_usd);
  const startField = num(row.copy_start_stack_usd);
  const realizedUsd = num(row.copy_pnl_usd);
  const realizedPct = num(row.copy_pnl_pct);
  const modeLabel = str(row.copy_mode).toUpperCase() || null;
  const knowEquity = equityParsed.equity != null || equityParsed.series.length > 0;
  const present =
    knowEquity ||
    trades.length > 0 ||
    positions.length > 0 ||
    wallets.length > 0 ||
    stackUsd != null ||
    startField != null ||
    realizedUsd != null ||
    realizedPct != null ||
    modeLabel != null ||
    leadersAt != null;
  if (!present) return null;

  const headline = equityParsed.equity ?? equityParsed.series.at(-1)?.v ?? stackUsd ?? startField ?? 0;
  const startUsd = startField ?? equityParsed.series[0]?.v ?? headline;
  const pnlUsd = knowEquity ? headline - startUsd : (realizedUsd ?? headline - startUsd);
  const pnlPct = knowEquity
    ? startUsd !== 0
      ? (pnlUsd / startUsd) * 100
      : 0
    : (realizedPct ?? (startUsd !== 0 ? (pnlUsd / startUsd) * 100 : 0));
  let series = equityParsed.series;
  if (series.length < 2 && knowEquity) {
    const end = generatedAt || Date.now();
    const firstTrade = trades[0]?.t;
    let begin = firstTrade != null ? Math.min(firstTrade, end - 60_000) : end - 60 * 60 * 1000;
    if (begin >= end) begin = end - 60_000;
    series = [
      { t: begin, v: startUsd },
      { t: end, v: headline },
    ];
  }
  return {
    modeLabel,
    equityUsd: knowEquity ? headline : null,
    startUsd,
    stackUsd,
    pnlUsd,
    pnlPct,
    multiple: startUsd > 0 ? headline / startUsd : null,
    equity: series,
    trades,
    positions,
    wallets,
    leadersAt,
  };
}

function isCopyActivity(item: ActivityItem): boolean {
  if (/^copy\b/i.test(item.text)) return true;
  return item.agent === 'copier' && /buy|sell|push|copy/.test(item.kind.toLowerCase());
}

function sameCopyEvent(item: ActivityItem, trade: Trade): boolean {
  if (!item.url || !trade.url || item.url !== trade.url) return false;
  return Math.abs(item.t - trade.t) <= 2 * 60 * 1000;
}

function tradeToActivity(trade: Trade): ActivityItem {
  return {
    t: trade.t,
    agent: 'copier',
    kind: trade.side,
    symbol: trade.symbol,
    text: trade.reason,
    pnlUsd: trade.pnlUsd,
    pnlPct: trade.pnlPct,
    url: trade.url,
    copy: true,
  };
}

function mergeCopyActivity(activity: ActivityItem[], trades: Trade[]): ActivityItem[] {
  const tagged = activity.map((item) => ({ ...item, copy: item.copy || isCopyActivity(item) }));
  const extras: ActivityItem[] = [];
  for (const trade of trades) {
    const match = tagged.find((item) => sameCopyEvent(item, trade));
    if (match) {
      match.copy = true;
      continue;
    }
    extras.push(tradeToActivity(trade));
  }
  return [...tagged, ...extras].sort((a, b) => b.t - a.t);
}

export function normalizeSnapshot(raw: unknown): Snapshot {
  const row = rec(raw) ?? {};
  const equity = parseEquity(row.equity);
  const generated = time(row.generated_at);
  const generatedAt = generated ?? equity.at(-1)?.t ?? Date.now();
  const stackUsd = num(row.stack_usd) ?? equity.at(-1)?.v ?? 0;
  const startStackUsd = num(row.start_stack_usd) ?? equity[0]?.v ?? 0;
  const pnlUsd = num(row.pnl_usd) ?? stackUsd - startStackUsd;
  const pnlPct = num(row.pnl_pct) ?? (startStackUsd !== 0 ? (pnlUsd / startStackUsd) * 100 : 0);
  const mode = parseMode(row.mode);
  const trades = list(row.trades)
    .map(parseTrade)
    .filter((item): item is Trade => item != null)
    .sort((a, b) => a.t - b.t);
  const copy = parseCopy(row, generatedAt);
  const activity = mergeCopyActivity(
    list(row.activity)
      .map(parseActivity)
      .filter((item): item is ActivityItem => item != null),
    copy?.trades ?? [],
  );
  return {
    generatedAt,
    generatedAtKnown: generated != null,
    mode: mode.mode,
    modeLabel: mode.modeLabel,
    stackUsd,
    startStackUsd,
    pnlUsd,
    pnlPct,
    multiple: startStackUsd > 0 ? stackUsd / startStackUsd : null,
    equity,
    trades,
    positions: list(row.positions)
      .map(parsePosition)
      .filter((item): item is Position => item != null),
    agents: list(row.agents)
      .map(parseAgent)
      .filter((item): item is Agent => item != null),
    counts: parseCounts(row.counts),
    activity,
    lastReportUrl: httpsUrl(row.last_report_url),
    copy,
  };
}

export function bookView(snapshot: Snapshot, book: Book): BookView {
  if (book === 'copy' && snapshot.copy) {
    const copy = snapshot.copy;
    const headline = copy.equityUsd ?? copy.equity.at(-1)?.v ?? copy.stackUsd ?? 0;
    return {
      headlineUsd: headline,
      startUsd: copy.startUsd,
      pnlUsd: copy.pnlUsd,
      pnlPct: copy.pnlPct,
      multiple: copy.multiple,
      equity: copy.equity,
      trades: copy.trades,
      end: Math.max(snapshot.generatedAt, copy.equity.at(-1)?.t ?? 0, copy.trades.at(-1)?.t ?? 0),
    };
  }
  return {
    headlineUsd: snapshot.stackUsd,
    startUsd: snapshot.startStackUsd,
    pnlUsd: snapshot.pnlUsd,
    pnlPct: snapshot.pnlPct,
    multiple: snapshot.multiple,
    equity: snapshot.equity,
    trades: snapshot.trades,
    end: Math.max(snapshot.generatedAtKnown ? snapshot.generatedAt : 0, snapshot.equity.at(-1)?.t ?? 0),
  };
}

export function sliceSeries(
  equity: EquityPoint[],
  trades: Trade[],
  end: number,
  tf: Timeframe,
): { equity: EquityPoint[]; trades: Trade[] } {
  const start = tf === 'all' ? Number.NEGATIVE_INFINITY : end - WINDOW_MS[tf];
  const sliced = equity.filter((point) => point.t >= start && point.t <= end + 60_000);
  const prior = [...equity].reverse().find((point) => point.t < start);
  if (prior && sliced.length && sliced[0].t > start && start !== Number.NEGATIVE_INFINITY) {
    sliced.unshift({ t: start, v: prior.v });
  }
  return {
    equity: sliced,
    trades: trades.filter((trade) => trade.t >= start && trade.t <= end + 60_000),
  };
}

export function sortAgents(agents: Agent[]): Agent[] {
  const rank = (name: string) => {
    const index = HOME_ORDER.indexOf(name);
    return index === -1 ? 100 : index;
  };
  return [...agents].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

export function isRunning(status: string): boolean {
  const value = status.trim().toLowerCase();
  if (!value) return false;
  if (/(error|fail|stop|down|dead|off|exit|idle|paused|standby)/.test(value)) return false;
  return /(run|live|ok|up|healthy|active|connect|watch)/.test(value);
}

export function statusTone(status: string): 'good' | 'bad' | 'warn' | 'muted' {
  const value = status.toLowerCase();
  if (/(error|fail|down|dead)/.test(value)) return 'bad';
  if (/(stale|degraded|reconnect|warn)/.test(value)) return 'warn';
  if (isRunning(status)) return 'good';
  return 'muted';
}
