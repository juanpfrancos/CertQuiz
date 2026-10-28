// Tiny DOM helpers. Strings are always inserted as text nodes (never innerHTML).
const PROPS = new Set(['value', 'checked', 'disabled', 'htmlFor', 'indeterminate', 'open', 'selected']);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'testid') el.setAttribute('data-testid', v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === 'text') el.textContent = v;
    else if (k === 'testid') el.setAttribute('data-testid', v);
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

export const letter = (i) => String.fromCharCode(65 + i);

export function fmtDuration(sec) {
  const t = Math.max(0, Math.round(sec || 0));
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

export function referencesList(refs, testid) {
  if (!refs?.length) return null;
  return h('div', { class: 'refs' },
    h('h4', { class: 'label', text: 'Referencias' }),
    h('ul', { testid },
      refs.map((r) => h('li', {},
        r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', text: r.title }) : h('span', { text: r.title })))));
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
