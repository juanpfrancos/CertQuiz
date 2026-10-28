// Attempts, per-question stats, failed list, favorites, settings and active session.
export const PROGRESS_TYPE = 'cq-progress';
export const PROGRESS_SCHEMA = '1.0';

export const DEFAULT_SETTINGS = {
  theme: 'system',
  defaultCount: 50,
  showTimer: true,
  shuffleOptions: false,
  exitThreshold: 1,
  lastBankId: null,
};

// Applies one answer to a stat record (pure).
export function applyAnswer(stat, correct) {
  const s = stat || { seen: 0, failed: 0, lastResult: null, consecutiveCorrect: 0 };
  return {
    ...s,
    seen: s.seen + 1,
    failed: s.failed + (correct ? 0 : 1),
    lastResult: correct ? 'correct' : 'incorrect',
    consecutiveCorrect: correct ? s.consecutiveCorrect + 1 : 0,
  };
}

export const isFailed = (stat, threshold) => Boolean(stat) && stat.failed >= 1 && stat.consecutiveCorrect < threshold;

const byDate = (a, b) => String(a.date).localeCompare(String(b.date));

export class HistoryManager {
  constructor(storage) {
    this.storage = storage;
  }

  // ----- settings -----
  getSettings() {
    const s = this.storage.getLocal('settings', {});
    return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
  }

  saveSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    this.storage.saveLocal('settings', next);
    return next;
  }

  // ----- favorites -----
  getAllFavorites() {
    const f = this.storage.getLocal('favorites', {});
    return f && typeof f === 'object' && !Array.isArray(f) ? f : {};
  }

  getFavorites(bankId) {
    return new Set(this.getAllFavorites()[bankId] || []);
  }

  toggleFavorite(bankId, questionId) {
    const all = this.getAllFavorites();
    const set = new Set(all[bankId] || []);
    const on = !set.has(questionId);
    if (on) set.add(questionId); else set.delete(questionId);
    all[bankId] = [...set];
    this.storage.saveLocal('favorites', all);
    return on;
  }

  // ----- active session -----
  getSession() {
    const s = this.storage.getLocal('session', null);
    return s && Array.isArray(s.questionIds) ? s : null;
  }

  saveSession(state) {
    this.storage.saveLocal('session', state);
  }

  clearSession() {
    this.storage.removeLocal('session');
  }

  // ----- attempts & stats -----
  toAttemptRecord(r) {
    return {
      id: r.id, bankId: r.bankId, bankName: r.bankName, date: r.date, mode: r.mode, simulacro: r.simulacro,
      total: r.total, correct: r.correct, durationSec: r.durationSec,
      answers: r.answers.map((a) => ({ questionId: a.questionId, domainId: a.domainId, selected: [...a.selected], correct: a.correct })),
    };
  }

  async saveAttempt(results) {
    const attempt = this.toAttemptRecord(results);
    await this.storage.saveIndexedDB('attempts', attempt);
    const existing = await this.storage.getAllIndexedDB('questionStats', 'bankId', attempt.bankId);
    const stats = new Map(existing.map((s) => [s.questionId, s]));
    for (const a of attempt.answers) {
      stats.set(a.questionId, { bankId: attempt.bankId, questionId: a.questionId, ...applyAnswer(stats.get(a.questionId), a.correct) });
    }
    await this.storage.saveIndexedDB('questionStats', [...stats.values()]);
    return attempt;
  }

  async getAttempts(bankId) {
    const list = bankId
      ? await this.storage.getAllIndexedDB('attempts', 'bankId', bankId)
      : await this.storage.getAllIndexedDB('attempts');
    return list.sort(byDate);
  }

  async getStats(bankId) {
    const list = await this.storage.getAllIndexedDB('questionStats', 'bankId', bankId);
    return new Map(list.map((s) => [s.questionId, s]));
  }

  async getFailedQuestionIds(bankId) {
    const threshold = Number(this.getSettings().exitThreshold) || 1;
    const stats = await this.getStats(bankId);
    return new Set([...stats.values()].filter((s) => isFailed(s, threshold)).map((s) => s.questionId));
  }

  async getDomainAccuracy(bankId) {
    const acc = {};
    for (const at of await this.getAttempts(bankId)) {
      for (const a of at.answers) {
        const d = (acc[a.domainId] ||= { correct: 0, total: 0 });
        d.total += 1;
        if (a.correct) d.correct += 1;
      }
    }
    return acc;
  }

  // Stats are derivable from attempts: rebuild them in chronological order.
  async recomputeStats() {
    const stats = new Map();
    for (const at of await this.getAttempts()) {
      for (const a of at.answers) {
        const key = `${at.bankId}\u0000${a.questionId}`;
        stats.set(key, { bankId: at.bankId, questionId: a.questionId, ...applyAnswer(stats.get(key), a.correct) });
      }
    }
    await this.storage.clearIndexedDB('questionStats');
    if (stats.size) await this.storage.saveIndexedDB('questionStats', [...stats.values()]);
  }

  async clearHistory() {
    await this.storage.clearIndexedDB('attempts');
    await this.storage.clearIndexedDB('questionStats');
    this.clearSession();
  }

  // ----- export / import -----
  async exportData() {
    return {
      schema_version: PROGRESS_SCHEMA,
      type: PROGRESS_TYPE,
      exported_at: new Date().toISOString(),
      attempts: await this.getAttempts(),
      favorites: this.getAllFavorites(),
      settings: this.getSettings(),
    };
  }

  // Returns an error message or null.
  validateImport(obj) {
    if (!obj || typeof obj !== 'object') return 'El archivo no contiene un objeto JSON.';
    if (obj.type !== PROGRESS_TYPE) return `No es un archivo de progreso de CertQuiz (type debe ser "${PROGRESS_TYPE}").`;
    if (!Array.isArray(obj.attempts)) return 'Falta la lista "attempts".';
    const bad = obj.attempts.findIndex((a) => !a || typeof a.id !== 'string' || typeof a.bankId !== 'string' || !Array.isArray(a.answers)
      || a.answers.some((x) => !x || typeof x.questionId !== 'string' || typeof x.correct !== 'boolean'));
    if (bad !== -1) return `attempts[${bad}] no tiene la forma esperada (id, bankId, answers[]).`;
    if (obj.favorites != null && (typeof obj.favorites !== 'object' || Array.isArray(obj.favorites))) return '"favorites" debe ser un objeto.';
    return null;
  }

  async importData(obj) {
    const existing = new Set((await this.getAttempts()).map((a) => a.id));
    const fresh = obj.attempts.filter((a) => !existing.has(a.id)).map((a) => ({
      ...a,
      answers: a.answers.map((x) => ({ ...x, selected: Array.isArray(x.selected) ? x.selected : [] })),
    }));
    if (fresh.length) await this.storage.saveIndexedDB('attempts', fresh);
    const favs = this.getAllFavorites();
    for (const [bankId, ids] of Object.entries(obj.favorites || {})) {
      if (Array.isArray(ids)) favs[bankId] = [...new Set([...(favs[bankId] || []), ...ids.filter((i) => typeof i === 'string')])];
    }
    this.storage.saveLocal('favorites', favs);
    if (obj.settings && typeof obj.settings === 'object') {
      const allowed = Object.fromEntries(Object.entries(obj.settings).filter(([k]) => k in DEFAULT_SETTINGS));
      this.saveSettings(allowed);
    }
    await this.recomputeStats();
    return { added: fresh.length, skipped: obj.attempts.length - fresh.length };
  }
}
