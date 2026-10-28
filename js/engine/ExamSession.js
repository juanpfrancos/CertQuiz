// State of the running test. Emits events on the bus; never touches the DOM.
// Events: question:changed, answer:checked, clock:tick, session:finished
export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export class ExamSession {
  constructor(bank, state, bus) {
    this.bank = bank;
    this.state = state;
    this.bus = bus;
    this.questions = state.questionIds.map((id) => bank.byId.get(id));
    this.runStart = null;
    this.timer = null;
    this.finished = false;
  }

  static create(bank, config, built, bus) {
    const limit = config.simulacro && Number(config.timeLimitMin) > 0 ? Math.round(Number(config.timeLimitMin) * 60) : 0;
    return new ExamSession(bank, {
      v: 1,
      bankId: bank.id,
      config: { ...config, mode: built.effectiveMode },
      questionIds: built.questionIds,
      optionOrder: built.optionOrder,
      answers: {},
      index: 0,
      elapsedMs: 0,
      timeLimitSec: limit,
      startedAt: new Date().toISOString(),
    }, bus);
  }

  // Throws if the bank or any question is gone, so the caller can discard the session.
  static restore(bank, saved, bus) {
    if (!bank) throw new Error('El banco de este test ya no está disponible');
    if (!Array.isArray(saved?.questionIds) || !saved.questionIds.length) throw new Error('Sesión guardada no válida');
    const missing = saved.questionIds.filter((id) => !bank.byId.has(id));
    if (missing.length) throw new Error(`Faltan ${missing.length} pregunta(s) en el banco`);
    const optionOrder = {};
    for (const id of saved.questionIds) {
      const ids = bank.byId.get(id).options.map((o) => o.id);
      const stored = saved.optionOrder?.[id];
      const valid = Array.isArray(stored) && stored.length === ids.length && ids.every((o) => stored.includes(o));
      optionOrder[id] = valid ? stored : ids;
    }
    const index = Math.min(Math.max(0, Number(saved.index) || 0), saved.questionIds.length - 1);
    return new ExamSession(bank, { ...saved, optionOrder, index, answers: saved.answers || {}, elapsedMs: Number(saved.elapsedMs) || 0 }, bus);
  }

  get total() { return this.questions.length; }
  get index() { return this.state.index; }
  get current() { return this.questions[this.state.index]; }
  get isLast() { return this.state.index === this.total - 1; }
  get isSimulacro() { return Boolean(this.state.config.simulacro); }
  get timeLimitSec() { return this.state.timeLimitSec || 0; }

  answerOf(qid) { return this.state.answers[qid] || null; }

  orderedOptions(question) {
    return this.state.optionOrder[question.id].map((id) => question.options.find((o) => o.id === id));
  }

  submitAnswer(qid, selected) {
    if (this.finished || this.state.answers[qid]) return this.state.answers[qid] || null;
    const question = this.bank.byId.get(qid);
    const result = question.evaluate(selected);
    this.state.answers[qid] = { selected: [...selected], correct: result.correct };
    this.bus.emit('answer:checked', { question, selected: [...selected], ...result, simulacro: this.isSimulacro });
    return result;
  }

  next() {
    if (this.finished) return;
    if (this.isLast) {
      this.finish('completed');
      return;
    }
    this.state.index += 1;
    this.bus.emit('question:changed', { index: this.state.index, question: this.current });
  }

  elapsedMs() {
    return this.state.elapsedMs + (this.runStart ? Date.now() - this.runStart : 0);
  }

  clockInfo() {
    const elapsedSec = Math.floor(this.elapsedMs() / 1000);
    const remainingSec = this.timeLimitSec ? Math.max(0, this.timeLimitSec - elapsedSec) : null;
    return { elapsedSec, remainingSec };
  }

  start() {
    if (this.finished || this.runStart) return;
    this.runStart = Date.now();
    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  pause() {
    if (!this.runStart) return;
    this.state.elapsedMs = this.elapsedMs();
    this.runStart = null;
    clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    const info = this.clockInfo();
    this.bus.emit('clock:tick', info);
    if (info.remainingSec === 0) this.finish('timeout');
  }

  snapshot() {
    return { ...this.state, elapsedMs: this.elapsedMs() };
  }

  calculateFinalResults(reason = 'completed') {
    const answers = this.questions.map((q) => {
      const a = this.state.answers[q.id];
      return { questionId: q.id, domainId: q.domainId, selected: a ? a.selected : [], correct: a ? a.correct : false };
    });
    const correct = answers.filter((a) => a.correct).length;
    const byDomain = this.bank.domains
      .map((d) => {
        const list = answers.filter((a) => a.domainId === d.id);
        const ok = list.filter((a) => a.correct).length;
        return { domainId: d.id, name: d.name, total: list.length, correct: ok, pct: list.length ? Math.round((ok / list.length) * 100) : 0 };
      })
      .filter((d) => d.total > 0);
    const { config } = this.state;
    return {
      id: uid(),
      bankId: this.bank.id,
      bankName: this.bank.label,
      date: new Date().toISOString(),
      mode: config.mode,
      simulacro: Boolean(config.simulacro),
      total: answers.length,
      correct,
      pct: answers.length ? Math.round((correct / answers.length) * 100) : 0,
      durationSec: Math.round(this.elapsedMs() / 1000),
      reason,
      answers,
      byDomain,
      config,
    };
  }

  finish(reason = 'completed') {
    if (this.finished) return null;
    this.pause();
    this.finished = true;
    const results = this.calculateFinalResults(reason);
    this.bus.emit('session:finished', results);
    return results;
  }
}
