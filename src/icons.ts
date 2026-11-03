const NS = 'http://www.w3.org/2000/svg';

function svg(viewBox = '0 0 24 24'): SVGSVGElement {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function path(d: string, attrs: Record<string, string> = {}): SVGPathElement {
  const el = document.createElementNS(NS, 'path');
  el.setAttribute('d', d);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.8',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

function asterisk(): SVGSVGElement {
  const el = svg();
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('fill', 'currentColor');
  for (const rot of [0, 45, 90, 135]) {
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', '10.2');
    rect.setAttribute('y', '2.1');
    rect.setAttribute('width', '3.6');
    rect.setAttribute('height', '19.8');
    rect.setAttribute('rx', '1.8');
    rect.setAttribute('transform', `rotate(${rot} 12 12)`);
    g.append(rect);
  }
  el.append(g);
  return el;
}

function plug(): SVGSVGElement {
  const el = svg();
  el.append(
    path(
      'M9 2.4h1.7V7.2H9V2.4zm4.3 0H15V7.2h-1.7V2.4zM7.6 8.2h8.8a.8.8 0 0 1 .8.8v.6a4.6 4.6 0 0 1-3.8 4.5V21h-2.8v-6.9A4.6 4.6 0 0 1 6.8 9.6V9a.8.8 0 0 1 .8-.8z',
      { fill: 'currentColor' },
    ),
  );
  return el;
}

function alert(): SVGSVGElement {
  const el = svg();
  el.append(
    path('M12 3.6 21.2 20H2.8L12 3.6z', stroke),
    path('M12 9.2v5.2', stroke),
    path('M12 17.2h.01', { ...stroke, 'stroke-width': '2.4' }),
  );
  return el;
}

function cloud(): SVGSVGElement {
  const el = svg();
  el.append(
    path('M7.1 18.2h9.3a3.4 3.4 0 0 0 .4-6.8 4.6 4.6 0 0 0-8.8-1.4 3.2 3.2 0 0 0-.9 8.2z', {
      fill: 'currentColor',
    }),
  );
  return el;
}

function flame(): SVGSVGElement {
  const el = svg();
  el.append(
    path(
      'M12 2.2c.5 2.5-.5 4.1-1.7 5.5-.8.9-1.4 1.8-1.4 3 0 .7.2 1.3.6 1.9C8.4 11.2 7.8 9.7 7.8 8.4 6 9.9 4.8 12 4.8 14.4 4.8 18.2 8 21.4 12 21.4s7.2-3.2 7.2-7c0-3.3-2.3-5.7-3.5-7.5-.4 1.4-1.1 2.4-1.8 3 .3-2.6-.5-5-1.9-7.7z',
      { fill: 'currentColor' },
    ),
  );
  return el;
}

function pulse(): SVGSVGElement {
  const el = svg();
  el.append(path('M2.2 12h4.2l2.1-6.2L12.4 18l2.3-6H21.8', stroke));
  return el;
}

function copies(): SVGSVGElement {
  const el = svg();
  el.append(path('M9 8h10v10H9z', stroke), path('M5 5h10', stroke), path('M5 5v10', stroke));
  return el;
}

function plane(): SVGSVGElement {
  const el = svg();
  el.append(path('M3 11.2 21 3.6l-7.6 16.6-2.4-6.6L3 11.2z', { fill: 'currentColor' }));
  return el;
}

function dot(): SVGSVGElement {
  const el = svg();
  el.append(path('M12 7.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6z', { fill: 'currentColor' }));
  return el;
}

export function agentGlyph(name: string): SVGSVGElement {
  switch (name) {
    case 'scanner':
      return asterisk();
    case 'scanner_ws':
      return pulse();
    case 'auditor':
      return plug();
    case 'analyst':
      return alert();
    case 'executor':
      return cloud();
    case 'risk':
      return flame();
    case 'telegram':
      return plane();
    case 'copier':
      return copies();
    default:
      return dot();
  }
}

export function brandMark(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'mark';
  wrap.append(asterisk());
  return wrap;
}

export function tabIcon(tab: 'home' | 'agents' | 'activity' | 'account'): SVGSVGElement {
  const el = svg();
  if (tab === 'home') {
    el.append(path('M4 11.1 12 4.4l8 6.7V20a1 1 0 0 1-1 1h-4.6v-5.6H9.6V21H5a1 1 0 0 1-1-1v-8.9z', stroke));
  } else if (tab === 'agents') {
    el.append(
      path('M9 11.2a2.7 2.7 0 1 0-2.7-2.7A2.7 2.7 0 0 0 9 11.2z', stroke),
      path('M16.2 10.6a2.2 2.2 0 1 0-2.2-2.2 2.2 2.2 0 0 0 2.2 2.2z', stroke),
      path('M3.6 19.2c.4-2.3 2.3-3.7 5.4-3.7s5 1.4 5.4 3.7', stroke),
      path('M14 15.6c1.5-.3 3 .2 4 1.3.6.7 1 1.6 1.2 2.3', stroke),
    );
  } else if (tab === 'activity') {
    el.append(path('M2.2 12h4.2l2.1-6.2L12.4 18l2.3-6H21.8', stroke));
  } else {
    el.append(
      path('M12 11.2a3.1 3.1 0 1 0-3.1-3.1A3.1 3.1 0 0 0 12 11.2z', stroke),
      path('M5.2 19.4c.7-2.6 3-4.1 6.8-4.1s6.1 1.5 6.8 4.1', stroke),
    );
  }
  return el;
}

export function scoreRing(score: number): SVGSVGElement {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circ;
  const el = svg('0 0 44 44');
  el.setAttribute('class', 'ring');
  const track = document.createElementNS(NS, 'circle');
  track.setAttribute('cx', '22');
  track.setAttribute('cy', '22');
  track.setAttribute('r', String(radius));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'rgba(255,255,255,0.1)');
  track.setAttribute('stroke-width', '3');
  const value = document.createElementNS(NS, 'circle');
  value.setAttribute('cx', '22');
  value.setAttribute('cy', '22');
  value.setAttribute('r', String(radius));
  value.setAttribute('fill', 'none');
  value.setAttribute('stroke', '#3ee08a');
  value.setAttribute('stroke-width', '3');
  value.setAttribute('stroke-linecap', 'round');
  value.setAttribute('stroke-dasharray', `${dash} ${circ - dash}`);
  value.setAttribute('transform', 'rotate(-90 22 22)');
  const text = document.createElementNS(NS, 'text');
  text.setAttribute('x', '22');
  text.setAttribute('y', '23');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('fill', '#ffffff');
  text.setAttribute('font-size', '12');
  text.setAttribute('font-weight', '700');
  text.textContent = String(Math.round(clamped));
  el.append(track, value, text);
  return el;
}
