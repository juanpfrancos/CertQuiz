// Hand-made SVG charts (no libraries). All labels via textContent.
import { s, h } from './dom.js';

const truncate = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** points: [{label, value (0-100), detail}] */
export function lineChart(points, { testid = 'history-chart-svg', title = 'Evolución del % de acierto' } = {}) {
  const W = 640, H = 260, L = 44, R = 16, T = 16, B = 34;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v) => T + ih - (v / 100) * ih;
  const avg = points.length ? Math.round(points.reduce((a, p) => a + p.value, 0) / points.length) : 0;
  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'chart chart--line', role: 'img', testid,
    'aria-label': `${title}: ${points.length} intentos, media ${avg}%, último ${points.at(-1)?.value ?? 0}%`,
  });
  svg.append(s('title', { text: title }));
  for (const v of [0, 25, 50, 75, 100]) {
    svg.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'chart__grid' }));
    svg.append(s('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart__axis', text: `${v}%` }));
  }
  if (points.length > 1) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    svg.append(s('path', { d: `${d} L${x(points.length - 1).toFixed(1)},${T + ih} L${x(0).toFixed(1)},${T + ih} Z`, class: 'chart__area' }));
    svg.append(s('path', { d, class: 'chart__line' }));
  }
  const step = Math.ceil(points.length / 10);
  points.forEach((p, i) => {
    const g = s('g', { class: 'chart__point', tabindex: '0', role: 'img', 'aria-label': `Intento ${i + 1}: ${p.value}% · ${p.detail || p.label}` });
    g.append(s('title', { text: `Intento ${i + 1}: ${p.value}% · ${p.detail || p.label}` }));
    g.append(s('circle', { cx: x(i), cy: y(p.value), r: 4.5 }));
    svg.append(g);
    if (i % step === 0 || i === points.length - 1) {
      svg.append(s('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', class: 'chart__axis', text: `#${i + 1}` }));
    }
  });
  return svg;
}

/** items: [{label, value (0-100), detail}] — horizontal bars */
export function barChart(items, { testid = 'domain-bar-chart', title = '% de acierto por dominio' } = {}) {
  const W = 480, row = 50, T = 6;
  const H = T + items.length * row + 4;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart chart--bars', role: 'img', testid,
    'aria-label': `${title}: ${items.map((i) => `${i.label} ${i.value}%`).join('; ')}` });
  svg.append(s('title', { text: title }));
  items.forEach((it, i) => {
    const y0 = T + i * row;
    const level = it.value >= 70 ? 'good' : it.value >= 50 ? 'mid' : 'low';
    const g = s('g', {});
    g.append(s('title', { text: `${it.label}: ${it.value}% ${it.detail ? `(${it.detail})` : ''}` }));
    g.append(s('text', { x: 0, y: y0 + 14, class: 'chart__label', text: truncate(it.label, 52) }));
    g.append(s('rect', { x: 0, y: y0 + 22, width: W - 60, height: 12, rx: 6, class: 'chart__track' }));
    g.append(s('rect', { x: 0, y: y0 + 22, width: Math.max(0, ((W - 60) * it.value) / 100), height: 12, rx: 6, class: `chart__bar chart__bar--${level}` }));
    g.append(s('text', { x: W, y: y0 + 33, 'text-anchor': 'end', class: 'chart__value', text: `${it.value}%` }));
    svg.append(g);
  });
  return svg;
}

export function emptyChart(message, testid) {
  return h('p', { class: 'empty', testid, text: message });
}
