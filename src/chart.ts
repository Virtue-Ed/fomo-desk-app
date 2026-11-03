import { formatUsd } from './format';
import { sliceSeries } from './model';
import type { EquityPoint, Timeframe, Trade } from './types';

const NS = 'http://www.w3.org/2000/svg';
const VB_W = 360;
const VB_H = 188;
const PAD_L = 8;
const PAD_R = 12;
const PAD_T = 22;
const PAD_B = 16;
const PALETTE = ['#3ee08a', '#ff9f43', '#e879f9', '#67e8f9', '#fb7185'];

let paintToken = 0;

export function paintChart(
  host: HTMLElement,
  series: { equity: EquityPoint[]; trades: Trade[]; end: number },
  tf: Timeframe,
): void {
  const token = ++paintToken;
  const draw = () => {
    if (token !== paintToken || !host.isConnected) return;
    renderChart(host, series, tf);
  };
  draw();
  if (document.fonts && document.fonts.status !== 'loaded') {
    void document.fonts.ready.then(draw);
  }
}

function renderChart(
  host: HTMLElement,
  series: { equity: EquityPoint[]; trades: Trade[]; end: number },
  tf: Timeframe,
): void {
  host.replaceChildren();
  const { equity, trades } = sliceSeries(series.equity, series.trades, series.end, tf);
  if (equity.length < 2) {
    const empty = document.createElement('p');
    empty.className = 'chart-empty';
    empty.textContent = 'Not enough equity points in this window.';
    host.append(empty);
    return;
  }

  const smooth = upsample(equity);
  const t0 = equity[0].t;
  const t1 = equity[equity.length - 1].t;
  const spanT = Math.max(1, t1 - t0);
  const values = equity.map((point) => point.v);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const spanV = Math.max(maxV - minV, Math.abs(maxV) * 0.02, 1);
  const yMin = minV - spanV * 0.14;
  const yMax = maxV + spanV * 0.4;
  const xOf = (t: number) => PAD_L + ((t - t0) / spanT) * (VB_W - PAD_L - PAD_R);
  const yOf = (v: number) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * (VB_H - PAD_T - PAD_B);

  const line = smooth
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xOf(point.t).toFixed(2)} ${yOf(point.v).toFixed(2)}`)
    .join(' ');
  const last = smooth[smooth.length - 1];
  const area = `${line} L ${xOf(last.t).toFixed(2)} ${(VB_H - 6).toFixed(2)} L ${xOf(smooth[0].t).toFixed(2)} ${(VB_H - 6).toFixed(2)} Z`;

  const uid = `eq${paintToken}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `Equity from ${formatUsd(equity[0].v)} to ${formatUsd(equity[equity.length - 1].v)}`,
  );
  svg.setAttribute('font-family', 'Inter, -apple-system, BlinkMacSystemFont, sans-serif');
  svg.append(chartDefs(uid));

  const areaPath = document.createElementNS(NS, 'path');
  areaPath.setAttribute('d', area);
  areaPath.setAttribute('fill', `url(#${uid}-fill)`);
  const linePath = document.createElementNS(NS, 'path');
  linePath.setAttribute('d', line);
  linePath.setAttribute('fill', 'none');
  linePath.setAttribute('stroke', '#3ee08a');
  linePath.setAttribute('stroke-width', '2.4');
  linePath.setAttribute('stroke-linejoin', 'round');
  linePath.setAttribute('stroke-linecap', 'round');
  linePath.setAttribute('filter', `url(#${uid}-glow)`);
  svg.append(areaPath, linePath);

  const endX = xOf(equity[equity.length - 1].t);
  const endY = yOf(equity[equity.length - 1].v);
  svg.append(circle(endX, endY, 7, '#3ee08a', '0.22'), circle(endX, endY, 3.4, '#e9fff3'), circle(endX, endY, 2, '#3ee08a'));

  const labeled = trades
    .filter((trade) => trade.pnlUsd != null && valueAt(equity, trade.t) != null)
    .sort((a, b) => Math.abs(b.pnlUsd ?? 0) - Math.abs(a.pnlUsd ?? 0))
    .slice(0, 4)
    .sort((a, b) => a.t - b.t);
  const labeledIds = new Set(labeled.map((trade) => trade.id));

  for (const trade of trades) {
    const value = valueAt(equity, trade.t);
    if (value == null || labeledIds.has(trade.id)) continue;
    const color = trade.pnlUsd != null && trade.pnlUsd < 0 ? '#ff5d73' : '#9aa6b2';
    svg.append(circle(xOf(trade.t), yOf(value), 2.5, color));
  }

  const markers = labeled.map((trade, index) => {
    const value = valueAt(equity, trade.t) ?? trade.usd;
    const color = trade.pnlUsd != null && trade.pnlUsd < 0 ? '#ff5d73' : PALETTE[index % PALETTE.length];
    const x = xOf(trade.t);
    const y = yOf(value);
    svg.append(circle(x, y, 3.2, color));
    const group = document.createElementNS(NS, 'g');
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('rx', '9');
    rect.setAttribute('fill', 'rgba(0,0,0,0.82)');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '1.2');
    const text = document.createElementNS(NS, 'text');
    text.textContent = formatUsd(trade.pnlUsd ?? 0, true);
    text.setAttribute('fill', color);
    text.setAttribute('font-size', '11');
    text.setAttribute('font-weight', '700');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('x', '0');
    text.setAttribute('y', '0');
    group.append(rect, text);
    svg.append(group);
    return { trade, x, y, rect, text, color };
  });

  host.append(svg);
  placeLabels(markers);
}

function placeLabels(
  markers: {
    x: number;
    y: number;
    rect: SVGRectElement;
    text: SVGTextElement;
  }[],
): void {
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  for (const marker of markers) {
    const box = marker.text.getBBox();
    const w = Math.max(46, box.width + 14);
    const h = 18;
    let x = Math.max(2, Math.min(VB_W - w - 2, marker.x - w / 2));
    let y = marker.y - h - 12;
    if (y < 2) y = Math.min(VB_H - h - 2, marker.y + 10);
    for (const other of placed) {
      if (overlaps(x, y, w, h, other)) y = other.y - h - 4;
    }
    if (y < 1) y = Math.min(VB_H - h - 2, marker.y + 12);
    placed.push({ x, y, w, h });
    marker.rect.setAttribute('x', x.toFixed(2));
    marker.rect.setAttribute('y', y.toFixed(2));
    marker.rect.setAttribute('width', w.toFixed(2));
    marker.rect.setAttribute('height', String(h));
    marker.text.setAttribute('x', (x + w / 2).toFixed(2));
    marker.text.setAttribute('y', (y + h / 2 + 0.5).toFixed(2));
  }
}

function overlaps(
  x: number,
  y: number,
  w: number,
  h: number,
  other: { x: number; y: number; w: number; h: number },
): boolean {
  const gap = 4;
  return !(x + w + gap < other.x || other.x + other.w + gap < x || y + h + gap < other.y || other.y + other.h + gap < y);
}

function svgNode(name: string, attrs: Record<string, string> = {}): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function chartDefs(uid: string): SVGDefsElement {
  const defs = svgNode('defs');
  const gradient = svgNode('linearGradient', { id: `${uid}-fill`, x1: '0', y1: '0', x2: '0', y2: '1' });
  gradient.append(
    svgNode('stop', { offset: '0%', 'stop-color': '#3ee08a', 'stop-opacity': '0.28' }),
    svgNode('stop', { offset: '55%', 'stop-color': '#3ee08a', 'stop-opacity': '0.05' }),
    svgNode('stop', { offset: '100%', 'stop-color': '#3ee08a', 'stop-opacity': '0' }),
  );
  const filter = svgNode('filter', { id: `${uid}-glow`, x: '-20%', y: '-40%', width: '140%', height: '180%' });
  const blur = svgNode('feGaussianBlur', { stdDeviation: '2.6', result: 'blur' });
  const merge = svgNode('feMerge');
  merge.append(svgNode('feMergeNode', { in: 'blur' }), svgNode('feMergeNode', { in: 'SourceGraphic' }));
  filter.append(blur, merge);
  defs.append(gradient, filter);
  return defs as SVGDefsElement;
}

function circle(cx: number, cy: number, r: number, fill: string, opacity?: string): SVGCircleElement {
  const el = document.createElementNS(NS, 'circle');
  el.setAttribute('cx', cx.toFixed(2));
  el.setAttribute('cy', cy.toFixed(2));
  el.setAttribute('r', String(r));
  el.setAttribute('fill', fill);
  if (opacity) el.setAttribute('opacity', opacity);
  return el;
}

function valueAt(points: EquityPoint[], t: number): number | null {
  if (!points.length || t < points[0].t || t > points[points.length - 1].t) return null;
  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    const a = points[i - 1];
    if (t <= b.t) {
      const u = (t - a.t) / Math.max(1, b.t - a.t);
      return a.v + (b.v - a.v) * u;
    }
  }
  return points[points.length - 1].v;
}

function upsample(points: EquityPoint[]): EquityPoint[] {
  if (points.length < 2 || points.length >= 48) return points;
  const steps = Math.max(2, Math.ceil(56 / (points.length - 1)));
  const out: EquityPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (let step = 0; step < steps; step++) {
      const u = step / steps;
      const eased = (1 - Math.cos(Math.PI * u)) / 2;
      out.push({ t: a.t + (b.t - a.t) * u, v: a.v + (b.v - a.v) * eased });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
