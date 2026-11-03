import { formatNum, formatPct, formatUsd } from './format';

const PREFERRED = [
  'taken_apart',
  'pools',
  'sold',
  'copied',
  'following',
  'in_usd',
  'open',
  'rejected',
  'no_volume',
  'top10_hold_pct',
  'stop_pct',
  'trail_pct',
  'copycat',
];

export function statLines(stats: Record<string, number | string>): { lines: string[]; pill: string | null } {
  const entries = Object.entries(stats).filter(([key]) => key !== 'score');
  entries.sort((a, b) => rank(a[0]) - rank(b[0]));
  const lines: string[] = [];
  let pill: string | null = null;
  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      if (!pill && value.trim()) pill = value.trim();
      continue;
    }
    if (Number.isFinite(value) && lines.length < 2) lines.push(formatStat(key, value));
  }
  return { lines, pill };
}

function rank(key: string): number {
  const index = PREFERRED.indexOf(key);
  return index === -1 ? 50 : index;
}

function formatStat(key: string, value: number): string {
  if (key === 'pools') return `${formatNum(value)} pools`;
  if (key === 'taken_apart') return `${formatNum(value)} taken apart`;
  if (key === 'rejected') return `${formatNum(value)} rejected`;
  if (key === 'no_volume') return `${formatNum(value)} no volume`;
  if (key === 'sold') return `${formatNum(value)} sold`;
  if (key === 'open') return `${formatNum(value)} open`;
  if (key === 'copycat') return `${formatNum(value)} copycat`;
  if (key === 'in_usd') return `${formatUsd(value)} in`;
  if (key === 'stop_pct') return `stop ${formatPct(value, 0)}`;
  if (key === 'trail_pct') return `trail ${formatPct(value, 0)}`;
  if (key === 'top10_hold_pct') return `top 10 hold ${formatPct(Math.abs(value), 0)}`;
  if (key.endsWith('_pct')) return `${key.replace(/_pct$/, '').replace(/_/g, ' ')} ${formatPct(value, 0)}`;
  if (key.endsWith('_usd')) return `${formatUsd(value)} ${key.replace(/_usd$/, '').replace(/_/g, ' ')}`;
  return `${formatNum(value)} ${key.replace(/_/g, ' ')}`;
}
