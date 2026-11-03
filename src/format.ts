import { timeZone } from './config';
import type { ActivityItem } from './types';

const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timeOnly = new Intl.DateTimeFormat('en-US', {
  timeZone,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dayKeyFmt = new Intl.DateTimeFormat('en-US', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dayAndTime = new Intl.DateTimeFormat('en-US', {
  timeZone,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function spaces(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, ' ');
}

export function formatUsd(value: number, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const body = `$${money.format(Math.abs(value))}`;
  if (value < 0) return `-${body}`;
  if (signed && value > 0) return `+${body}`;
  return body;
}

export function formatPct(value: number, digits = 2, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const body = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (value < 0) return `-${body}%`;
  if (signed && value > 0) return `+${body}%`;
  return `${body}%`;
}

export function formatActivityPct(value: number): string {
  const digits = Math.abs(value) >= 10 ? 0 : 1;
  return formatPct(value, digits, true);
}

export function formatMultiple(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const digits = Math.abs(value) >= 10 ? 1 : 2;
  return `${value.toFixed(digits)}×`;
}

export function formatNum(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1) return formatUsd(value);
  if (abs >= 0.01) return `$${abs.toFixed(4)}`;
  const body = abs.toPrecision(3);
  return value < 0 ? `-$${body}` : `$${body}`;
}

export function formatAgo(then: number, now = Date.now()): string {
  if (!Number.isFinite(then)) return 'unknown';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatWhen(ms: number, referenceMs: number): string {
  if (!Number.isFinite(ms)) return '';
  if (dayKeyFmt.format(ms) === dayKeyFmt.format(referenceMs)) return spaces(timeOnly.format(ms));
  return spaces(dayAndTime.format(ms));
}

const VERBS: Record<string, string> = {
  buy: 'Bought',
  bought: 'Bought',
  sell: 'Sold',
  sold: 'Sold',
  stop: 'Stopped',
  stopped: 'Stopped',
  trailing_stop: 'Stopped',
  refuse: 'Refused',
  refused: 'Refused',
  reject: 'Rejected',
  rejected: 'Rejected',
  pass: 'Passed',
  passed: 'Passed',
  skip: 'Skipped',
  alert: 'Alert',
  note: 'Note',
};

export function kindVerb(kind: string): string {
  const key = kind.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (VERBS[key]) return VERBS[key];
  if (!key) return 'Update';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function activityTitle(item: ActivityItem): string {
  const verb = kindVerb(item.kind);
  return item.symbol ? `${verb} ${item.symbol}` : item.text || verb;
}

export function activitySubtitle(item: ActivityItem, when: string): string {
  const parts: string[] = [];
  if (item.agent) parts.push(agentLabel(item.agent));
  const title = activityTitle(item).toLowerCase();
  if (item.text && item.text.toLowerCase() !== title) parts.push(item.text);
  if (when) parts.push(when);
  return parts.join(' · ');
}

const AGENT_NAMES: Record<string, string> = {
  scanner: 'Scanner',
  scanner_ws: 'Scanner WS',
  auditor: 'Auditor',
  analyst: 'Analyst',
  executor: 'Executor',
  risk: 'Risk',
  telegram: 'Telegram',
};

export function agentLabel(name: string): string {
  const key = name.trim().toLowerCase();
  return AGENT_NAMES[key] ?? titleCase(name);
}

export function titleCase(value: string): string {
  const cleaned = value.trim().replace(/[_-]+/g, ' ');
  if (!cleaned) return 'Unknown';
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
