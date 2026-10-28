// Builds the question list of a test from the bank + config + history context.
export const MODES = {
  normal: 'Test normal',
  failed: 'Solo falladas',
  weakest: 'Dominio más débil',
  favorites: 'Favoritas',
};

// Fisher-Yates on a copy.
export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weakestDomain(bank, domainAccuracy) {
  let best = null;
  for (const d of bank.domains) {
    const acc = domainAccuracy[d.id];
    if (!acc || acc.total === 0) continue;
    const pct = acc.correct / acc.total;
    if (!best || pct < best.pct) best = { domain: d, pct };
  }
  return best;
}

/**
 * @param bank QuestionBank
 * @param config {count, domainIds[], mode, simulacro, timeLimitMin, shuffleOptions, questionIds?}
 * @param ctx {failedIds:Set, favoriteIds:Set, domainAccuracy:{[domainId]:{correct,total}}}
 * @returns {questionIds, optionOrder, notices[], error, effectiveMode}
 */
export function buildTest(bank, config, ctx) {
  const notices = [];
  let mode = config.mode;
  const domainSet = new Set(config.domainIds?.length ? config.domainIds : bank.domains.map((d) => d.id));
  const inDomains = (q) => domainSet.has(q.domainId);
  let pool;

  if (config.questionIds?.length) {
    pool = config.questionIds.map((id) => bank.byId.get(id)).filter(Boolean);
  } else if (mode === 'failed') {
    pool = bank.questions.filter((q) => inDomains(q) && ctx.failedIds.has(q.id));
    if (!pool.length) return fail('No tienes preguntas falladas pendientes en este banco (con el filtro de dominios actual).');
  } else if (mode === 'favorites') {
    pool = bank.questions.filter((q) => inDomains(q) && ctx.favoriteIds.has(q.id));
    if (!pool.length) return fail('No tienes preguntas favoritas en este banco (con el filtro de dominios actual). Márcalas con ⭐ durante un test.');
  } else if (mode === 'weakest') {
    const weak = weakestDomain(bank, ctx.domainAccuracy);
    if (!weak) {
      notices.push('Aún no hay historial suficiente para calcular tu dominio más débil: se usa el modo normal.');
      mode = 'normal';
      pool = bank.questions.filter(inDomains);
    } else {
      notices.push(`Dominio más débil: «${weak.domain.name}» (${Math.round(weak.pct * 100)}% de acierto). Se ignora el filtro de dominio.`);
      pool = bank.questions.filter((q) => q.domainId === weak.domain.id);
    }
  } else {
    mode = 'normal';
    pool = bank.questions.filter(inDomains);
  }

  if (!pool.length) return fail('No hay preguntas disponibles con esta configuración. Selecciona al menos un dominio.');

  const requested = Math.max(1, Math.floor(Number(config.count) || pool.length));
  const count = Math.min(requested, pool.length);
  if (count < requested) notices.push(`Solo hay ${pool.length} preguntas disponibles: el test tendrá ${count}.`);

  const questions = shuffle(pool).slice(0, count);
  const optionOrder = {};
  for (const q of questions) {
    const ids = q.options.map((o) => o.id);
    optionOrder[q.id] = config.shuffleOptions ? shuffle(ids) : ids;
  }
  return { questionIds: questions.map((q) => q.id), optionOrder, notices, error: null, effectiveMode: mode };

  function fail(error) {
    return { questionIds: [], optionOrder: {}, notices, error, effectiveMode: mode };
  }
}
