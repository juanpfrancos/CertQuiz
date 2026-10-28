// Home: bank selection, upload, resume banner and test configuration.
import { h, fmtDuration } from './dom.js';
import { MODES } from '../engine/TestBuilder.js';

const MODE_HINTS = {
  normal: 'Preguntas aleatorias de los dominios seleccionados.',
  failed: 'Solo preguntas que tienes pendientes de dominar.',
  weakest: 'Dominio con menor % de acierto histórico (ignora el filtro de dominio).',
  favorites: 'Preguntas que marcaste con ⭐.',
};

/**
 * m: {banks, bank, savedSession, settings, counts:{failed,favorites}, install:{canPrompt, ios}, uploadReport}
 * a: {selectBank, resume, discardSession, uploadFiles, deleteBank, startTest, install}
 */
export function renderHome(m, a) {
  return h('div', { class: 'page home' },
    m.savedSession && resumeBanner(m.savedSession, a),
    h('header', { class: 'page__head' },
      h('p', { class: 'eyebrow', text: 'Simulador de certificaciones' }),
      h('h1', { class: 'page__title', tabindex: '-1', text: 'Prepara tu examen' }),
      h('p', { class: 'muted', text: 'Practica con bancos de preguntas de Microsoft, AWS, Google y más. Todo se guarda solo en este navegador.' })),
    h('div', { class: 'home__grid' },
      h('div', { class: 'stack' },
        bankSection(m, a),
        m.bank && bankDetail(m.bank),
        uploadSection(m, a),
        installSection(m.install, a)),
      m.bank ? configSection(m, a) : h('section', { class: 'card' }, h('p', { class: 'empty', text: 'No hay bancos disponibles. Sube un archivo JSON para empezar.' }))));
}

function resumeBanner(s, a) {
  return h('section', { class: 'resume', testid: 'resume-banner', 'aria-labelledby': 'resume-title' },
    h('div', {},
      h('h2', { id: 'resume-title', class: 'resume__title', text: 'Tienes un test en curso' }),
      h('p', { class: 'resume__meta', testid: 'resume-meta',
        text: `${s.bankLabel} · Pregunta ${s.index + 1} de ${s.total} · ${fmtDuration(s.elapsedSec)}${s.simulacro ? ' · Simulacro' : ''}` })),
    h('div', { class: 'resume__actions' },
      h('button', { type: 'button', class: 'btn btn--primary', testid: 'btn-resume-test', text: 'Reanudar', onclick: a.resume }),
      h('button', { type: 'button', class: 'btn btn--ghost', testid: 'btn-discard-test', text: 'Descartar', onclick: a.discardSession })));
}

function bankSection(m, a) {
  return h('section', { class: 'card', 'aria-labelledby': 'banks-title' },
    h('h2', { id: 'banks-title', class: 'card__title', text: 'Banco de preguntas' }),
    m.banks.length
      ? h('div', { class: 'bank-list', role: 'radiogroup', 'aria-labelledby': 'banks-title', testid: 'bank-selector' },
        m.banks.map((b) => h('div', { class: `bank-card ${m.bank?.id === b.id ? 'is-selected' : ''}`, testid: `bank-card-${b.id}` },
          h('label', { class: 'bank-card__main' },
            h('input', { type: 'radio', name: 'bank', class: 'bank-card__radio', value: b.id, checked: m.bank?.id === b.id, onchange: () => a.selectBank(b.id), testid: `bank-radio-${b.id}` }),
            h('span', { class: 'bank-card__code', text: b.certification.exam_code }),
            h('span', { class: 'bank-card__body' },
              h('span', { class: 'bank-card__name', text: b.name }),
              h('span', { class: 'bank-card__meta', text: `${b.certification.provider} · ${b.questions.length} preguntas` })),
            h('span', { class: `badge ${b.source === 'uploaded' ? 'badge--accent' : ''}`, text: b.source === 'uploaded' ? 'Subido' : 'Incluido' })),
          b.source === 'uploaded' && h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `Eliminar banco ${b.name}`, title: 'Eliminar banco subido', testid: `btn-delete-bank-${b.id}`, text: '🗑', onclick: () => a.deleteBank(b.id) }))))
      : h('p', { class: 'empty', text: 'No hay bancos disponibles.' }));
}

function bankDetail(bank) {
  const c = bank.certification;
  const item = (k, v, testid) => h('div', {}, h('dt', { text: k }), h('dd', { text: v, testid }));
  return h('section', { class: 'card', 'aria-labelledby': 'bank-detail-title', testid: 'bank-detail' },
    h('h2', { id: 'bank-detail-title', class: 'card__title', text: c.name }),
    h('dl', { class: 'facts' },
      item('Proveedor', c.provider, 'bank-provider'),
      item('Código', c.exam_code, 'bank-code'),
      item('Idioma', c.language, 'bank-language'),
      item('Preguntas', String(bank.questions.length), 'bank-total-questions')),
    h('h3', { class: 'label', text: 'Preguntas por dominio' }),
    h('ul', { class: 'domain-counts', testid: 'bank-domain-counts' },
      bank.domains.map((d) => h('li', { testid: `domain-count-${d.id}` },
        h('span', { text: d.name }),
        h('span', { class: 'domain-counts__n', text: `${d.count}${d.examWeight ? ` · ${d.examWeight}` : ''}` })))));
}

function uploadSection(m, a) {
  const input = h('input', { type: 'file', id: 'bank-upload', accept: '.json,application/json', multiple: true, class: 'sr-only', testid: 'input-json-upload',
    onchange: (e) => { a.uploadFiles([...e.target.files]); e.target.value = ''; } });
  const zone = h('label', { class: 'dropzone', htmlFor: 'bank-upload', testid: 'upload-dropzone' },
    h('span', { class: 'dropzone__icon', 'aria-hidden': 'true', text: '⇪' }),
    h('span', { class: 'dropzone__title', text: 'Sube tus bancos (.json)' }),
    h('span', { class: 'muted small', text: 'Arrastra y suelta o pulsa para elegir · máx. 10 MB por archivo' }));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    const files = [...(e.dataTransfer?.files || [])].filter((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
    if (files.length) a.uploadFiles(files);
  });
  return h('section', { class: 'card', 'aria-labelledby': 'upload-title' },
    h('h2', { id: 'upload-title', class: 'card__title', text: 'Añadir banco' }),
    input, zone,
    m.uploadReport?.length && h('div', { class: 'upload-report', role: 'alert', testid: 'upload-report' },
      m.uploadReport.map((r) => h('div', { class: `upload-report__item ${r.errors.length ? 'is-error' : 'is-ok'}` },
        h('p', { class: 'upload-report__title' },
          h('strong', { text: r.fileName }), ' — ',
          r.errors.length ? `✘ No se cargó (${r.errors.length} error${r.errors.length > 1 ? 'es' : ''})` : (r.status || '✔ Cargado')),
        r.errors.length > 0 && h('ul', { class: 'errors', testid: 'upload-errors' }, r.errors.map((e) => h('li', { text: e }))),
        r.warnings.length > 0 && h('details', { class: 'warnings' },
          h('summary', { text: `${r.warnings.length} aviso(s)` }),
          h('ul', {}, r.warnings.map((w) => h('li', { text: w }))))))));
}

function installSection(install, a) {
  if (!install.canPrompt && !install.ios) return null;
  return h('section', { class: 'card card--subtle', 'aria-labelledby': 'install-title' },
    h('h2', { id: 'install-title', class: 'card__title', text: 'Instalar app' }),
    install.canPrompt
      ? h('div', {}, h('p', { class: 'muted small', text: 'Instálala para usarla sin conexión como una app más.' }),
        h('button', { type: 'button', class: 'btn btn--primary', testid: 'btn-install-pwa', text: 'Instalar app', onclick: a.install }))
      : h('p', { class: 'muted small', testid: 'ios-install-hint', text: 'En iPhone/iPad: pulsa Compartir (□↑) y después «Añadir a pantalla de inicio».' }));
}

function configSection(m, a) {
  const bank = m.bank;
  const msg = h('p', { class: 'form-msg', role: 'alert', testid: 'config-message' });
  const count = h('input', { type: 'number', id: 'cfg-count', min: '1', max: '1000', value: String(m.settings.defaultCount), inputmode: 'numeric', testid: 'input-question-count' });
  const domainBoxes = bank.domains.map((d) => h('input', { type: 'checkbox', value: d.id, checked: true, testid: `checkbox-domain-${d.id}` }));
  const simulacro = h('input', { type: 'checkbox', id: 'cfg-sim', testid: 'checkbox-timed-exam' });
  const limit = h('input', { type: 'number', id: 'cfg-limit', min: '0', max: '600', step: '1', value: String(bank.certification.duration_minutes || 0), disabled: true, testid: 'input-time-limit' });
  const shuffle = h('input', { type: 'checkbox', id: 'cfg-shuffle', checked: Boolean(m.settings.shuffleOptions), testid: 'checkbox-random-order' });
  simulacro.addEventListener('change', () => { limit.disabled = !simulacro.checked; });
  const setAll = (v) => domainBoxes.forEach((b) => { b.checked = v; });

  const modeCount = { failed: m.counts.failed, favorites: m.counts.favorites };
  const form = h('form', { class: 'card config', 'aria-labelledby': 'config-title', testid: 'config-form', novalidate: true },
    h('h2', { id: 'config-title', class: 'card__title', text: 'Configurar test' }),
    h('div', { class: 'field' },
      h('label', { htmlFor: 'cfg-count', class: 'field__label', text: 'Cantidad de preguntas' }),
      count,
      h('p', { class: 'field__hint', testid: 'available-count', text: `Disponibles en el banco: ${bank.questions.length}. Si hay menos que las pedidas, se usa el máximo.` })),
    h('fieldset', { class: 'field' },
      h('legend', { class: 'field__label', text: 'Dominios' }),
      h('div', { class: 'inline-actions' },
        h('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Todos', testid: 'btn-domains-all', onclick: () => setAll(true) }),
        h('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Ninguno', testid: 'btn-domains-none', onclick: () => setAll(false) })),
      h('div', { class: 'checks' }, bank.domains.map((d, i) => h('label', { class: 'check' }, domainBoxes[i], h('span', { text: `${d.name} (${d.count})` }))))),
    h('fieldset', { class: 'field', testid: 'select-test-mode' },
      h('legend', { class: 'field__label', text: 'Modo de selección' }),
      h('div', { class: 'mode-grid' }, Object.entries(MODES).map(([key, label], i) => h('label', { class: 'mode' },
        h('input', { type: 'radio', name: 'mode', value: key, checked: i === 0, testid: `radio-mode-${key}` }),
        h('span', { class: 'mode__body' },
          h('span', { class: 'mode__label', text: modeCount[key] != null ? `${label} (${modeCount[key]})` : label }),
          h('span', { class: 'mode__hint', text: MODE_HINTS[key] })))))),
    h('fieldset', { class: 'field' },
      h('legend', { class: 'field__label', text: 'Opciones' }),
      h('label', { class: 'check' }, simulacro, h('span', {}, h('strong', { text: 'Modo simulacro' }), h('span', { class: 'muted small', text: ' — sin feedback hasta el final, sin volver atrás' }))),
      h('div', { class: 'field field--inline' },
        h('label', { htmlFor: 'cfg-limit', class: 'small', text: 'Tiempo límite (minutos, 0 = sin límite)' }), limit),
      h('label', { class: 'check' }, shuffle, h('span', { text: 'Orden aleatorio de opciones' }))),
    msg,
    h('button', { type: 'submit', class: 'btn btn--primary btn--lg btn--block', testid: 'btn-start-test', text: 'Empezar test' }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    msg.textContent = '';
    const config = {
      count: Number(count.value) || m.settings.defaultCount,
      domainIds: domainBoxes.filter((b) => b.checked).map((b) => b.value),
      mode: form.querySelector('input[name="mode"]:checked')?.value || 'normal',
      simulacro: simulacro.checked,
      timeLimitMin: simulacro.checked ? Math.max(0, Number(limit.value) || 0) : 0,
      shuffleOptions: shuffle.checked,
    };
    if (!config.domainIds.length && config.mode !== 'weakest') {
      msg.textContent = 'Selecciona al menos un dominio.';
      return;
    }
    Promise.resolve(a.startTest(config)).then((err) => { if (err) msg.textContent = err; });
  });
  return form;
}
