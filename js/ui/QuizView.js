// Question screen. Mounted once per test; only the question card is rebuilt
// on question:changed, feedback is painted in place on answer:checked.
import { h, letter, fmtDuration, referencesList } from './dom.js';
import { isModalOpen } from './components.js';

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * ctx: {session, bus, settings, isFavorite(qid)}
 * a: {submit(qid, ids), next(), toggleFavorite(qid) -> bool, exit()}
 * returns {el, destroy}
 */
export function mountQuiz(ctx, a) {
  const { session, bus, settings } = ctx;
  const sim = session.isSimulacro;
  const showTimer = settings.showTimer || session.timeLimitSec > 0;

  const progressText = h('span', { class: 'quiz__progress-text', testid: 'quiz-progress-text' });
  const bar = h('span', { class: 'progress__bar' });
  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Progreso del test', 'aria-valuemin': '0', testid: 'quiz-progress-bar' }, bar);
  const timer = h('span', { class: 'timer', role: 'timer', 'aria-label': session.timeLimitSec ? 'Tiempo restante' : 'Tiempo transcurrido', testid: 'quiz-timer', hidden: !showTimer });
  const card = h('article', { class: 'card question', 'aria-live': 'off', testid: 'question-card' });

  const el = h('div', { class: 'page quiz' },
    h('div', { class: 'quiz__bar' },
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', testid: 'btn-exit-test', text: '← Salir', onclick: a.exit }),
      h('div', { class: 'quiz__meta' }, progressText, sim && h('span', { class: 'badge badge--warning', text: 'Simulacro' })),
      timer),
    progress,
    card,
    h('p', { class: 'kbd-hint muted small' }, 'Atajos: 1–9 / A–F seleccionan · Enter comprueba/avanza · ? ayuda'));

  let q; let selected; let checked; let inputs; let primary; let verdict; let feedbackArea;

  function renderQuestion() {
    q = session.current;
    selected = new Set();
    checked = false;
    const n = session.index + 1;
    progressText.textContent = `Pregunta ${n}/${session.total}`;
    progress.setAttribute('aria-valuemax', String(session.total));
    progress.setAttribute('aria-valuenow', String(n));
    bar.style.transform = `scaleX(${n / session.total})`;

    const options = session.orderedOptions(q);
    const multi = q.type === 'multiple_choice';
    const name = `opt-${q.id}`;
    const domain = session.bank.domainById.get(q.domainId);
    const fav = ctx.isFavorite(q.id);
    const favBtn = h('button', { type: 'button', class: `fav ${fav ? 'is-on' : ''}`, 'aria-pressed': String(fav), testid: 'btn-toggle-favorite',
      'aria-label': 'Marcar como favorita', title: 'Favorita',
      onclick: () => {
        const on = a.toggleFavorite(q.id);
        favBtn.classList.toggle('is-on', on);
        favBtn.setAttribute('aria-pressed', String(on));
        favBtn.querySelector('.fav__star').textContent = on ? '★' : '☆';
        favBtn.querySelector('.fav__txt').textContent = on ? 'Favorita' : 'Marcar';
      } },
    h('span', { class: 'fav__star', 'aria-hidden': 'true', text: fav ? '★' : '☆' }), h('span', { class: 'fav__txt', text: fav ? 'Favorita' : 'Marcar' }));

    inputs = options.map((o, i) => {
      const input = h('input', { type: multi ? 'checkbox' : 'radio', name, value: o.id, class: 'opt__input', testid: `option-input-${i}`,
        onchange: () => onSelect() });
      const label = h('label', { class: 'opt', testid: `option-item-${i}`, 'data-option-id': o.id },
        input,
        h('span', { class: 'opt__key', 'aria-hidden': 'true', text: letter(i) }),
        h('span', { class: 'opt__text' }, h('span', { class: 'sr-only', text: `${letter(i)}. ` }), o.text),
        h('span', { class: 'opt__badge', testid: `option-badge-${i}` }));
      return { input, label, id: o.id };
    });

    verdict = h('p', { class: 'verdict', 'aria-live': 'polite', 'aria-atomic': 'true', testid: 'feedback-verdict' });
    feedbackArea = h('div', { class: 'feedback', testid: 'feedback-container', hidden: true });
    primary = h('button', { type: 'button', class: 'btn btn--primary btn--lg', disabled: true, testid: 'btn-check-answer',
      text: sim ? (session.isLast ? 'Responder y finalizar' : 'Responder y continuar') : 'Comprobar respuesta', onclick: onPrimary });

    card.replaceChildren(
      h('div', { class: 'question__top' },
        h('span', { class: 'badge', testid: 'question-domain', text: domain?.name || q.domainId }),
        favBtn),
      h('p', { class: 'question__stem', id: `stem-${q.id}`, tabindex: '-1', testid: 'question-text', text: q.question }),
      h('fieldset', { class: 'opts' },
        h('legend', { class: 'opts__legend' },
          multi ? h('span', { class: 'badge badge--accent', testid: 'multi-hint', text: `Selecciona ${q.correct_answers.length} respuestas` })
            : h('span', { class: 'muted small', text: 'Selecciona una respuesta' })),
        h('div', { class: 'opts__list' }, inputs.map((i) => i.label))),
      verdict,
      feedbackArea,
      h('div', { class: 'question__actions' }, primary));

    const prev = session.answerOf(q.id);
    if (prev && !sim) {
      prev.selected.forEach((id) => selected.add(id));
      inputs.forEach((i) => { i.input.checked = selected.has(i.id); });
      paint(prev.correct, q.correct_answers);
    }
  }

  function onSelect() {
    if (checked) return;
    selected = new Set(inputs.filter((i) => i.input.checked).map((i) => i.id));
    inputs.forEach((i) => i.label.classList.toggle('is-chosen', i.input.checked));
    primary.disabled = selected.size === 0;
  }

  function onPrimary() {
    if (!checked) {
      if (!selected.size) return;
      const ids = inputs.filter((i) => selected.has(i.id)).map((i) => i.id);
      a.submit(q.id, ids);
      if (sim) a.next();
      return;
    }
    a.next();
  }

  function paint(correct, correctIds) {
    checked = true;
    const ok = new Set(correctIds);
    for (const i of inputs) {
      i.input.disabled = true;
      const chosen = selected.has(i.id);
      const badge = i.label.querySelector('.opt__badge');
      i.label.classList.remove('is-chosen');
      i.label.classList.add('is-locked');
      if (chosen && ok.has(i.id)) { i.label.classList.add('opt--correct'); badge.textContent = '✔ Correcta'; }
      else if (chosen) { i.label.classList.add('opt--incorrect'); badge.textContent = '✘ Incorrecta'; }
      else if (ok.has(i.id)) { i.label.classList.add('opt--missed'); badge.textContent = '✔ Era correcta'; }
    }
    verdict.textContent = correct ? '✔ Correcto' : '✘ Incorrecto';
    verdict.className = `verdict ${correct ? 'verdict--ok' : 'verdict--ko'}`;
    feedbackArea.replaceChildren(
      h('h3', { class: 'label', text: 'Explicación' }),
      h('p', { class: 'feedback__text', testid: 'explanation-text', text: q.explanation || 'Sin explicación.' }),
      referencesList(q.references, 'references-list'));
    feedbackArea.hidden = false;
    primary.disabled = false;
    primary.textContent = session.isLast ? 'Finalizar' : 'Siguiente';
    primary.setAttribute('data-testid', session.isLast ? 'btn-finish-test' : 'btn-next-question');
    primary.focus({ preventScroll: true });
  }

  function onTick({ elapsedSec, remainingSec }) {
    if (!showTimer) return;
    const value = remainingSec ?? elapsedSec;
    timer.textContent = `${remainingSec != null ? '⏳' : '⏱'} ${fmtDuration(value)}`;
    timer.classList.toggle('timer--warn', remainingSec != null && remainingSec <= 60);
  }

  function onKey(e) {
    if (isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const isOptionInput = t instanceof HTMLInputElement && t.classList.contains('opt__input');
    if (TYPING.has(t?.tagName) && !isOptionInput) return;
    if (e.key === 'Enter') {
      if (t?.tagName === 'BUTTON' || t?.tagName === 'A') return; // native activation
      if (!primary.disabled) { e.preventDefault(); primary.click(); }
      return;
    }
    if (checked) return;
    let idx = -1;
    if (/^[1-9]$/.test(e.key)) idx = Number(e.key) - 1;
    else if (/^[a-f]$/i.test(e.key)) idx = e.key.toLowerCase().charCodeAt(0) - 97;
    if (idx < 0 || idx >= inputs.length) return;
    e.preventDefault();
    const target = inputs[idx].input;
    target.checked = target.type === 'radio' ? true : !target.checked;
    target.focus({ preventScroll: true });
    onSelect();
  }

  const offs = [
    bus.on('question:changed', () => { renderQuestion(); card.querySelector('.question__stem')?.focus?.(); window.scrollTo({ top: 0 }); }),
    bus.on('answer:checked', (r) => { if (!r.simulacro && r.question.id === q.id) paint(r.correct, r.correctIds); }),
    bus.on('clock:tick', onTick),
  ];
  document.addEventListener('keydown', onKey);
  renderQuestion();
  onTick(session.clockInfo());

  return {
    el,
    destroy() {
      offs.forEach((off) => off());
      document.removeEventListener('keydown', onKey);
    },
  };
}
