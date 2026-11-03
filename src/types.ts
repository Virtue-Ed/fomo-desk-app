export type Tab = 'home' | 'agents' | 'activity' | 'account';

export type Timeframe = 'live' | '1h' | '4h' | '1d' | '1w' | 'all';

export interface EquityPoint {
  t: number;
  v: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  t: number;
  usd: number;
  pnlUsd: number | null;
  pnlPct: number | null;
  reason: string;
  url: string | null;
}

export interface Position {
  symbol: string;
  entryUsd: number | null;
  sizeUsd: number | null;
  pnlPct: number | null;
  stopPct: number | null;
  url: string | null;
}

export interface Agent {
  name: string;
  status: string;
  lastBeat: number | null;
  line: string;
  stats: Record<string, number | string>;
}

export interface Counts {
  seen: number;
  scannerKilled: number;
  auditorRefused: number;
  analystRejected: number;
  waiting: number;
}

export interface ActivityItem {
  t: number;
  agent: string;
  kind: string;
  symbol: string | null;
  text: string;
  pnlUsd: number | null;
  pnlPct: number | null;
  url: string | null;
}

export interface Snapshot {
  generatedAt: number;
  generatedAtKnown: boolean;
  mode: 'PAPER' | 'LIVE' | 'UNKNOWN';
  modeLabel: string;
  stackUsd: number;
  startStackUsd: number;
  pnlUsd: number;
  pnlPct: number;
  multiple: number | null;
  equity: EquityPoint[];
  trades: Trade[];
  positions: Position[];
  agents: Agent[];
  counts: Counts;
  activity: ActivityItem[];
  lastReportUrl: string | null;
}

export interface AppState {
  tab: Tab;
  tf: Timeframe;
  snapshot: Snapshot | null;
  error: string | null;
  notice: string | null;
  loading: boolean;
  demo: boolean;
  hasToken: boolean;
}
