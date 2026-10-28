// History list + SVG charts + export/import.
import { h, fmtDate, fmtDuration } from './dom.js';
import { lineChart, barChart, emptyChart } from './Charts.js';
import { MODES } from '../engine/TestBuilder.js';

/**
 * m: {attempts (filtered, chronological), bankOptions:[{id,label}], filter, domainItems|null}
 * a: {setFilter(id), exportData(), importFile(file)}
 */
export function renderHistory(m, a) {
  const select = h('select', { id: 'hist-filter', testid: 'history-bank-filter', onchange: (e) => a.setFilter(e.target.value) },
    h('option', { value: '', text: 'Todos los bancos', selected: !m.filter }),
    m.bankOptions.map((b) => h('option', { value: b.id, text: b.label, selected: m.filter === b.id })));
  const importInput = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', id: 'import-file', testid: 'input-import-file',
    onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) a.importFile(f); } });
  const rows = [...m.attempts].reverse();

  return h('div', { class: 'page history' },
    h('header', { class: 'page__head page__head--row' },
      h('div', {},
        h('p', { class: 'eyebrow', text: 'Tu progreso' }),
        h('h1', { class: 'page__title', tabindex: '-1', text: 'Historial y estadísticas' })),
      h('div', { class: 'inline-actions' },
        h('button', { type: 'button', class: 'btn btn--ghost', testid: 'btn-export-history', text: '⭳ Exportar', onclick: a.exportData }),
        importInput,
        h('label', { htmlFor: 'import-file', class: 'btn btn--ghost', testid: 'btn-import-history', tabindex: '0', role: 'button', text: '⭱ Importar',
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); importInput.click(); } } }))),
    h('div', { class: 'field field--inline' }, h('label', { htmlFor: 'hist-filter', class: 'field__label', text: 'Banco' }), select),
    h('div', { class: 'history__charts' },
      h('section', { class: 'card', 'aria-labelledby': 'evo-title' },
        h('h2', { id: 'evo-title', class: 'card__title', text: 'Evolución del % de acierto' }),
        m.attempts.length
          ? lineChart(m.attempts.map((at) => ({ value: pct(at), label: fmtDate(at.date), detail: `${fmtDate(at.date)} · ${at.bankName || at.bankId}` })))
          : emptyChart('Aún no hay intentos. Completa un test para ver tu evolución.', 'history-chart-empty')),
      h('section', { class: 'card', 'aria-labelledby': 'dom-hist-title' },
        h('h2', { id: 'dom-hist-title', class: 'card__title', text: '% de acierto por dominio' }),
        m.domainItems?.length
          ? barChart(m.domainItems, { testid: 'history-domain-chart' })
          : emptyChart(m.filter ? 'Sin datos de dominios para este banco.' : 'Elige un banco para ver el acierto por dominio.', 'history-domain-empty'))),
    h('section', { class: 'card', 'aria-labelledby': 'att-title' },
      h('h2', { id: 'att-title', class: 'card__title', text: `Intentos (${rows.length})` }),
      rows.length
        ? h('div', { class: 'table-wrap' },
          h('table', { class: 'table', testid: 'history-attempts-list' },
            h('thead', {}, h('tr', {}, ['Fecha', 'Banco', 'Modo', 'Puntaje', 'Duración'].map((t) => h('th', { scope: 'col', text: t })))),
            h('tbody', {}, rows.map((at) => h('tr', { testid: `attempt-row-${at.id}` },
              h('td', { text: fmtDate(at.date) }),
              h('td', { text: at.bankName || at.bankId }),
              h('td', { text: `${MODES[at.mode] || at.mode}${at.simulacro ? ' · Simulacro' : ''}` }),
              h('td', { class: 'num' }, h('span', { class: `score-chip score-chip--${pct(at) >= 70 ? 'good' : pct(at) >= 50 ? 'mid' : 'low'}`, text: `${pct(at)}%` }), ` ${at.correct}/${at.total}`),
              h('td', { class: 'num', text: fmtDuration(at.durationSec) }))))))
        : h('p', { class: 'empty', testid: 'history-empty', text: 'Sin intentos registrados.' })));
}

const pct = (at) => (at.total ? Math.round((at.correct / at.total) * 100) : 0);
