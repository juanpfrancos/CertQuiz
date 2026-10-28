// Results of a finished test with domain breakdown and full review.
import { h, fmtDuration, referencesList } from './dom.js';
import { barChart } from './Charts.js';
import { MODES } from '../engine/TestBuilder.js';

/** m: {results, bank}; a: {repeatFailed(ids), newTest()} */
export function renderResults({ results: r, bank }, a) {
  const failed = r.answers.filter((x) => !x.correct);
  const level = r.pct >= 70 ? 'good' : r.pct >= 50 ? 'mid' : 'low';
  let filter = r.simulacro ? 'all' : 'failed';
  const list = h('div', { class: 'review', testid: 'results-failed-review' });
  const tabs = {
    failed: h('button', { type: 'button', class: 'seg__btn', testid: 'review-filter-failed', text: `Falladas (${failed.length})`, onclick: () => setFilter('failed') }),
    all: h('button', { type: 'button', class: 'seg__btn', testid: 'review-filter-all', text: `Todas (${r.answers.length})`, onclick: () => setFilter('all') }),
  };

  function setFilter(f) {
    filter = f;
    for (const [k, b] of Object.entries(tabs)) b.setAttribute('aria-pressed', String(k === f));
    const items = (f === 'failed' ? failed : r.answers);
    list.replaceChildren(...(items.length
      ? items.map((ans) => reviewItem(ans, r.answers.indexOf(ans), bank))
      : [h('p', { class: 'empty', text: '¡Sin fallos! No hay preguntas que revisar.' })]));
  }
  setFilter(filter);

  return h('div', { class: 'page results' },
    h('header', { class: 'page__head' },
      h('p', { class: 'eyebrow', text: `${r.bankName} · ${MODES[r.mode] || r.mode}${r.simulacro ? ' · Simulacro' : ''}` }),
      h('h1', { class: 'page__title', tabindex: '-1', text: 'Resultados' })),
    r.reason === 'timeout' && h('p', { class: 'notice notice--warning', role: 'status', testid: 'timeout-notice', text: '⏳ Tiempo agotado: las preguntas no respondidas cuentan como incorrectas.' }),
    h('section', { class: `card score score--${level}` },
      h('div', { class: 'score__big' },
        h('span', { class: 'score__pct', testid: 'results-score-percentage', text: `${r.pct}%` }),
        h('span', { class: 'score__label', text: r.pct >= 70 ? '✔ Buen resultado' : '✘ Sigue practicando' })),
      h('dl', { class: 'facts facts--3' },
        h('div', {}, h('dt', { text: 'Aciertos' }), h('dd', { testid: 'results-correct', text: `✔ ${r.correct}` })),
        h('div', {}, h('dt', { text: 'Fallos' }), h('dd', { testid: 'results-incorrect', text: `✘ ${r.total - r.correct}` })),
        h('div', {}, h('dt', { text: 'Tiempo' }), h('dd', { testid: 'results-duration', text: fmtDuration(r.durationSec) })))),
    h('section', { class: 'card', 'aria-labelledby': 'dom-title', testid: 'results-domains-breakdown' },
      h('h2', { id: 'dom-title', class: 'card__title', text: 'Desglose por dominio' }),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Dominio' }), h('th', { scope: 'col', text: 'Aciertos' }), h('th', { scope: 'col', text: '%' }))),
          h('tbody', {}, r.byDomain.map((d) => h('tr', {}, h('td', { text: d.name }), h('td', { class: 'num', text: `${d.correct}/${d.total}` }), h('td', { class: 'num', text: `${d.pct}%` })))))),
      barChart(r.byDomain.map((d) => ({ label: d.name, value: d.pct, detail: `${d.correct}/${d.total}` })), { testid: 'results-domain-chart' })),
    h('section', { class: 'card', 'aria-labelledby': 'rev-title' },
      h('div', { class: 'card__row' },
        h('h2', { id: 'rev-title', class: 'card__title', text: 'Revisión' }),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Filtrar revisión' }, tabs.failed, tabs.all)),
      list),
    h('div', { class: 'actions-row' },
      h('button', { type: 'button', class: 'btn btn--primary', testid: 'btn-repeat-failed', disabled: failed.length === 0, text: 'Repetir falladas de este test',
        onclick: () => a.repeatFailed(failed.map((x) => x.questionId)) }),
      h('button', { type: 'button', class: 'btn btn--ghost', testid: 'btn-new-test', text: 'Nuevo test', onclick: a.newTest })));
}

function reviewItem(ans, idx, bank) {
  const q = bank?.byId.get(ans.questionId);
  if (!q) return h('p', { class: 'empty', text: `Pregunta ${ans.questionId} no disponible.` });
  const texts = (ids) => (ids.length ? ids.map((id) => q.optionText(id)) : null);
  const yours = texts(ans.selected);
  return h('details', { class: `review__item ${ans.correct ? 'is-ok' : 'is-ko'}`, testid: `review-item-${q.id}` },
    h('summary', {},
      h('span', { class: 'review__mark', 'aria-hidden': 'true', text: ans.correct ? '✔' : '✘' }),
      h('span', { class: 'sr-only', text: ans.correct ? 'Correcta: ' : 'Incorrecta: ' }),
      h('span', { class: 'review__n', text: `#${idx + 1}` }),
      h('span', { class: 'review__stem', text: q.question.split('\n')[0] })),
    h('div', { class: 'review__body' },
      h('p', { class: 'question__stem', text: q.question }),
      h('h4', { class: 'label', text: 'Tu respuesta' }),
      yours ? h('ul', { class: `answer-list ${ans.correct ? 'is-ok' : 'is-ko'}` }, yours.map((t) => h('li', { text: t })))
        : h('p', { class: 'muted', text: 'Sin responder' }),
      h('h4', { class: 'label', text: 'Respuesta correcta' }),
      h('ul', { class: 'answer-list is-ok' }, q.correct_answers.map((id) => h('li', { text: q.optionText(id) }))),
      h('h4', { class: 'label', text: 'Explicación' }),
      h('p', { class: 'feedback__text', text: q.explanation || 'Sin explicación.' }),
      referencesList(q.references)));
}
