// Bootstrap, hash routing between views and controllers wiring UI <-> Engine <-> Storage.
import { EventBus } from './core/EventBus.js';
import { StorageAdapter } from './storage/StorageAdapter.js';
import { HistoryManager } from './storage/HistoryManager.js';
import { BankRepository } from './banks/BankRepository.js';
import { buildTest } from './engine/TestBuilder.js';
import { ExamSession } from './engine/ExamSession.js';
import * as UI from './ui/Render.js';

const bus = new EventBus();
const storage = new StorageAdapter(bus);
const historyMgr = new HistoryManager(storage);
const repo = new BankRepository(storage);

const state = {
  settings: null,
  session: null,
  lastResults: null,
  uploadReport: [],
  historyFilter: null,
  install: { deferred: null, ios: /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone },
};

const main = document.getElementById('view');
const mq = window.matchMedia('(prefers-color-scheme: dark)');
let teardown = null;
let renderId = 0;
let firstRender = true;

bus.on('storage:error', (msg) => UI.toast(msg, { type: 'warning', duration: 9000 }));

// ---------------- theme ----------------
function applyTheme(pref) {
  const dark = pref === 'dark' || (pref !== 'light' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0F17' : '#F8FAFC');
  const btn = document.getElementById('theme-btn');
  btn?.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  btn?.setAttribute('title', dark ? 'Modo claro' : 'Modo oscuro');
}

// Header button: toggles between light and dark (explicit choice, saved).
document.getElementById('theme-btn')?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  state.settings = historyMgr.saveSettings({ theme: next });
  applyTheme(next);
  if (currentRoute() === 'settings') render(); // keep the Settings radios in sync
});
mq.addEventListener?.('change', () => applyTheme(state.settings?.theme || 'system'));

// ---------------- session persistence ----------------
function saveSessionNow() {
  if (state.session && !state.session.finished) historyMgr.saveSession(state.session.snapshot());
}

function leaveSession({ discard = false } = {}) {
  const s = state.session;
  if (!s) return;
  s.pause();
  if (discard) historyMgr.clearSession();
  else historyMgr.saveSession(s.snapshot());
  state.session = null;
}

bus.on('clock:tick', ({ elapsedSec }) => { if (elapsedSec > 0 && elapsedSec % 5 === 0) saveSessionNow(); });

bus.on('session:finished', async (results) => {
  state.session = null;
  historyMgr.clearSession();
  state.lastResults = results;
  try {
    await historyMgr.saveAttempt(results);
  } catch (e) {
    UI.toast(`No se pudo guardar el intento en el historial (${e.message}).`, { type: 'error' });
  }
  go('results');
});

document.addEventListener('visibilitychange', () => {
  if (!state.session) return;
  if (document.visibilityState === 'hidden') {
    state.session.pause();
    saveSessionNow();
  } else if (currentRoute() === 'test') {
    state.session.start();
  }
});
window.addEventListener('pagehide', saveSessionNow);

// ---------------- routing ----------------
const currentRoute = () => location.hash.replace(/^#\/?/, '').split('?')[0];

function go(route) {
  const target = `#/${route}`;
  if (location.hash === target) render();
  else location.hash = target;
}

window.addEventListener('hashchange', render);

const ROUTES = { '': showHome, test: showQuiz, results: showResults, history: showHistory, settings: showSettings };

async function render() {
  const id = ++renderId;
  const route = ROUTES[currentRoute()] ? currentRoute() : '';
  if (route !== 'test' && state.session) {
    leaveSession();
    UI.toast('Test guardado. Puedes reanudarlo desde Inicio.', { type: 'success' });
  }
  const view = await ROUTES[route]();
  if (id !== renderId || !view) {
    view?.destroy?.();
    return;
  }
  teardown?.();
  teardown = view.destroy || null;
  main.replaceChildren(view.el);
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const active = a.dataset.nav === (route === 'test' || route === 'results' ? '' : route);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  view.onMount?.();
  if (!firstRender && route !== 'test') main.querySelector('.page__title')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
  firstRender = false;
}

// ---------------- home ----------------
async function showHome() {
  const banks = repo.list();
  const bank = repo.get(state.settings.lastBankId) || banks[0] || null;
  const saved = historyMgr.getSession();
  const savedSession = saved && {
    bankLabel: repo.get(saved.bankId)?.label || saved.bankId,
    index: Number(saved.index) || 0,
    total: saved.questionIds.length,
    elapsedSec: Math.floor((Number(saved.elapsedMs) || 0) / 1000),
    simulacro: Boolean(saved.config?.simulacro),
  };
  const counts = bank
    ? { failed: (await historyMgr.getFailedQuestionIds(bank.id)).size, favorites: historyMgr.getFavorites(bank.id).size }
    : { failed: 0, favorites: 0 };
  const el = UI.renderHome({
    banks, bank, savedSession, counts, settings: state.settings, uploadReport: state.uploadReport,
    install: { canPrompt: Boolean(state.install.deferred), ios: state.install.ios },
  }, {
    selectBank(id) {
      state.settings = historyMgr.saveSettings({ lastBankId: id });
      render();
    },
    resume: resumeSession,
    async discardSession() {
      if (!(await UI.confirmDialog({ title: 'Descartar test', message: 'Se perderá el progreso del test en curso. ¿Continuar?', confirmLabel: 'Descartar', danger: true }))) return;
      historyMgr.clearSession();
      UI.toast('Test descartado.');
      render();
    },
    uploadFiles,
    deleteBank,
    startTest: (config) => startTest(bank, config),
    async install() {
      const evt = state.install.deferred;
      if (!evt) return;
      evt.prompt();
      await evt.userChoice.catch(() => null);
      state.install.deferred = null;
      render();
    },
  });
  return { el };
}

async function uploadFiles(files) {
  const report = [];
  let lastSaved = null;
  for (const file of files) {
    let r;
    try {
      r = await repo.readFile(file);
    } catch (e) {
      r = { fileName: file.name, errors: [`No se pudo leer el archivo (${e.message})`], warnings: [], data: null };
    }
    if (!r.errors.length) {
      const id = r.data.certification.id;
      if (repo.has(id)) {
        const ok = await UI.confirmDialog({
          title: 'Banco existente',
          message: `Ya existe un banco con id «${id}» (${repo.get(id).label}). ¿Reemplazarlo por «${r.fileName}»?`,
          confirmLabel: 'Reemplazar', testid: 'replace-bank-modal',
        });
        if (!ok) {
          report.push({ ...r, status: '— No se reemplazó (cancelado)' });
          continue;
        }
      }
      const bank = await repo.saveUploaded(r.data, r.fileName);
      lastSaved = bank.id;
      report.push({ ...r, status: `✔ Cargado: ${bank.label}, ${bank.questions.length} preguntas` });
    } else {
      report.push(r);
    }
  }
  state.uploadReport = report;
  if (lastSaved) {
    state.settings = historyMgr.saveSettings({ lastBankId: lastSaved });
    UI.toast('Banco cargado correctamente.', { type: 'success' });
  } else if (report.some((r) => r.errors.length)) {
    UI.toast('Hay errores de validación: revisa el informe.', { type: 'error' });
  }
  render();
}

async function deleteBank(id) {
  const bank = repo.get(id);
  const ok = await UI.confirmDialog({
    title: 'Eliminar banco', danger: true, confirmLabel: 'Eliminar', testid: 'delete-bank-modal',
    message: `Se eliminará «${bank?.label || id}» de este navegador. El historial de este banco se conserva.`,
  });
  if (!ok) return;
  const problems = await repo.removeUploaded(id);
  problems.forEach((p) => UI.toast(p, { type: 'warning' }));
  UI.toast('Banco eliminado.');
  render();
}

async function startTest(bank, config) {
  if (!bank) return 'Selecciona un banco.';
  const ctx = {
    failedIds: await historyMgr.getFailedQuestionIds(bank.id),
    favoriteIds: historyMgr.getFavorites(bank.id),
    domainAccuracy: config.mode === 'weakest' ? await historyMgr.getDomainAccuracy(bank.id) : {},
  };
  const built = buildTest(bank, config, ctx);
  if (built.error) return built.error;
  if (historyMgr.getSession()) {
    const ok = await UI.confirmDialog({ title: 'Test en curso', message: 'Ya tienes un test guardado. Si empiezas uno nuevo se descartará. ¿Continuar?', confirmLabel: 'Empezar nuevo', danger: true });
    if (!ok) return null;
  }
  built.notices.forEach((n) => UI.toast(n, { type: 'info', duration: 8000 }));
  const { questionIds: _ignored, ...cleanConfig } = config;
  state.session = ExamSession.create(bank, cleanConfig, built, bus);
  saveSessionNow();
  go('test');
  return null;
}

function resumeSession() {
  const saved = historyMgr.getSession();
  if (!saved) return render();
  try {
    state.session = ExamSession.restore(repo.get(saved.bankId), saved, bus);
    go('test');
  } catch (e) {
    historyMgr.clearSession();
    UI.toast(`No se pudo reanudar el test: ${e.message}. Se ha descartado.`, { type: 'warning', duration: 9000 });
    render();
  }
}

// ---------------- quiz ----------------
async function showQuiz() {
  const s = state.session;
  if (!s) {
    location.replace('#/');
    return null;
  }
  const view = UI.mountQuiz({
    session: s, bus, settings: state.settings,
    isFavorite: (qid) => historyMgr.getFavorites(s.bank.id).has(qid),
  }, {
    submit(qid, ids) {
      s.submitAnswer(qid, ids);
      saveSessionNow();
    },
    next() {
      s.next();
      saveSessionNow();
    },
    toggleFavorite(qid) {
      const on = historyMgr.toggleFavorite(s.bank.id, qid);
      UI.toast(on ? '⭐ Añadida a favoritas' : 'Quitada de favoritas', { duration: 2000 });
      return on;
    },
    exit() {
      UI.openModal({
        title: 'Salir del test', testid: 'exit-modal',
        body: 'Puedes guardar el test para reanudarlo más tarde en la misma pregunta, o descartarlo.',
        actions: [
          { label: 'Cancelar', variant: 'ghost', testid: 'exit-cancel-btn' },
          { label: 'Descartar test', variant: 'danger', testid: 'exit-discard-btn', onClick: () => { leaveSession({ discard: true }); UI.toast('Test descartado.'); go(''); } },
          { label: 'Guardar y salir', variant: 'primary', testid: 'exit-save-btn', onClick: () => { go(''); } },
        ],
      });
    },
  });
  return {
    el: view.el,
    destroy: view.destroy,
    onMount: () => { if (document.visibilityState === 'visible') s.start(); },
  };
}

// ---------------- results ----------------
async function showResults() {
  const r = state.lastResults;
  if (!r) {
    location.replace('#/');
    return null;
  }
  const bank = repo.get(r.bankId);
  return {
    el: UI.renderResults({ results: r, bank }, {
      async repeatFailed(ids) {
        if (!bank) return UI.toast('El banco ya no está disponible.', { type: 'error' });
        const config = { ...r.config, mode: 'normal', questionIds: ids, count: ids.length };
        const built = buildTest(bank, config, { failedIds: new Set(), favoriteIds: new Set(), domainAccuracy: {} });
        if (built.error) return UI.toast(built.error, { type: 'error' });
        const { questionIds: _ignored, ...cleanConfig } = config;
        state.session = ExamSession.create(bank, cleanConfig, built, bus);
        saveSessionNow();
        go('test');
      },
      newTest: () => go(''),
    }),
  };
}

// ---------------- history ----------------
async function showHistory() {
  const all = await historyMgr.getAttempts();
  const ids = new Set([...all.map((a) => a.bankId), ...repo.list().map((b) => b.id)]);
  const bankOptions = [...ids].map((id) => ({ id, label: repo.get(id)?.label || all.find((a) => a.bankId === id)?.bankName || id }));
  const filter = state.historyFilter && ids.has(state.historyFilter) ? state.historyFilter : null;
  const attempts = filter ? all.filter((a) => a.bankId === filter) : all;
  let domainItems = null;
  if (filter) {
    const acc = {};
    for (const at of attempts) {
      for (const a of at.answers) {
        const d = (acc[a.domainId] ||= { correct: 0, total: 0 });
        d.total += 1;
        if (a.correct) d.correct += 1;
      }
    }
    const bank = repo.get(filter);
    domainItems = Object.entries(acc).map(([domainId, d]) => ({
      label: bank?.domainById.get(domainId)?.name || domainId,
      value: Math.round((d.correct / d.total) * 100),
      detail: `${d.correct}/${d.total}`,
    }));
  }
  return {
    el: UI.renderHistory({ attempts, bankOptions, filter, domainItems }, {
      setFilter(id) { state.historyFilter = id || null; render(); },
      async exportData() {
        const data = await historyMgr.exportData();
        UI.downloadJSON(data, `CertQuiz-progreso-${new Date().toISOString().slice(0, 10)}.json`);
        UI.toast(`Progreso exportado (${data.attempts.length} intentos).`, { type: 'success' });
      },
      async importFile(file) {
        let obj;
        try {
          obj = JSON.parse(await file.text());
        } catch {
          return UI.toast('El archivo no es un JSON válido.', { type: 'error' });
        }
        const err = historyMgr.validateImport(obj);
        if (err) return UI.toast(err, { type: 'error', duration: 9000 });
        const ok = await UI.confirmDialog({
          title: 'Importar progreso', confirmLabel: 'Importar', testid: 'import-modal',
          message: `El archivo contiene ${obj.attempts.length} intento(s). Se fusionarán con tu historial (sin duplicar) y se recalcularán las estadísticas. ¿Continuar?`,
        });
        if (!ok) return;
        const res = await historyMgr.importData(obj);
        state.settings = historyMgr.getSettings();
        applyTheme(state.settings.theme);
        UI.toast(`Importados ${res.added} intento(s); ${res.skipped} ya existían.`, { type: 'success' });
        render();
      },
    }),
  };
}

// ---------------- settings ----------------
async function showSettings() {
  return {
    el: UI.renderSettings({ settings: state.settings }, {
      saveSettings(patch) {
        state.settings = historyMgr.saveSettings(patch);
        if ('theme' in patch) applyTheme(state.settings.theme);
        UI.toast('Ajustes guardados.', { type: 'success', duration: 1500 });
      },
      async clearHistory() {
        const ok = await UI.confirmDialog({
          title: 'Borrar historial', danger: true, confirmLabel: 'Borrar historial', testid: 'clear-history-modal',
          message: 'Se eliminarán todos los intentos, las estadísticas y el test en curso. Se conservan ajustes, bancos subidos y favoritas.',
        });
        if (!ok) return;
        await historyMgr.clearHistory();
        UI.toast('Historial borrado.', { type: 'success' });
      },
      resetApp: openResetModal,
    }),
  };
}

function openResetModal() {
  const cb = UI.h('input', { type: 'checkbox', testid: 'danger-modal-checkbox' });
  const body = UI.h('div', { class: 'stack' },
    UI.h('p', { text: 'Se borrará de este navegador, sin posibilidad de recuperarlo:' }),
    UI.h('ul', { class: 'bullets' },
      ['Historial de intentos y estadísticas', 'Test en curso', 'Favoritas y ajustes (el tema vuelve a la preferencia del sistema)', 'Bancos subidos', 'Cachés sin conexión y service worker']
        .map((t) => UI.h('li', { text: t }))),
    UI.h('label', { class: 'check' }, cb, UI.h('strong', { text: 'Entiendo que se borrará todo' })));
  const modal = UI.openModal({
    title: 'Restablecer aplicación', body, testid: 'danger-modal',
    actions: [
      { label: 'Cancelar', variant: 'ghost', testid: 'danger-modal-cancel-btn' },
      {
        label: 'Sí, borrar todo', variant: 'danger', testid: 'danger-modal-confirm-btn', disabled: true,
        onClick: async () => {
          const btn = modal.buttons[1];
          btn.disabled = true;
          btn.textContent = 'Borrando…';
          leaveSession({ discard: true });
          await storage.purgeAllData();
          location.replace(location.pathname + location.search); // reload at the initial state (#/)
          return false;
        },
      },
    ],
  });
  cb.addEventListener('change', () => { modal.buttons[1].disabled = !cb.checked; });
}

// ---------------- help / shortcuts ----------------
function openHelp() {
  const rows = [['1 – 9', 'Seleccionar/alternar la opción en esa posición'], ['A – F', 'Seleccionar/alternar opción por letra'],
    ['Enter', 'Comprobar respuesta o pasar a la siguiente'], ['Esc', 'Cerrar ventanas'], ['?', 'Mostrar esta ayuda']];
  UI.openModal({
    title: 'Atajos de teclado', testid: 'help-modal',
    body: UI.h('dl', { class: 'shortcuts' }, rows.map(([k, v]) => UI.h('div', {}, UI.h('dt', {}, UI.h('kbd', { text: k })), UI.h('dd', { text: v })))),
    actions: [{ label: 'Entendido', variant: 'primary', testid: 'help-close-btn' }],
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== '?' || UI.isModalOpen()) return;
  const tag = e.target?.tagName;
  if ((tag === 'INPUT' && !e.target.classList.contains('opt__input')) || tag === 'TEXTAREA' || tag === 'SELECT') return;
  e.preventDefault();
  openHelp();
});
document.getElementById('help-btn')?.addEventListener('click', openHelp);
// Skip link must not change the hash (hash is used for routing).
document.querySelector('.skip')?.addEventListener('click', (e) => { e.preventDefault(); main.focus(); });

// ---------------- PWA ----------------
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.install.deferred = e;
  if (currentRoute() === '') render();
});
window.addEventListener('appinstalled', () => {
  state.install.deferred = null;
  UI.toast('CertQuiz instalada.', { type: 'success' });
});

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  let userReload = false;
  const notify = (worker) => UI.toast('Nueva versión disponible', {
    type: 'info', duration: 0,
    action: { label: 'Recargar', onClick: () => { userReload = true; worker.postMessage({ type: 'SKIP_WAITING' }); } },
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (userReload) location.reload(); });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) notify(w); });
    });
  }).catch((e) => console.warn('Service worker no registrado:', e));
}

// ---------------- init ----------------
async function init() {
  storage.migrate();
  state.settings = historyMgr.getSettings();
  applyTheme(state.settings.theme);
  registerSW();
  const problems = await repo.loadAll();
  problems.forEach((p) => UI.toast(p, { type: 'warning', duration: 9000 }));
  if (['test', 'results'].includes(currentRoute())) history.replaceState(null, '', '#/');
  await render();
}

init();
