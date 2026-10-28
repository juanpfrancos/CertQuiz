// Validates a question bank (schema_version "1.0") without dependencies.
// Returns { errors[], warnings[], data } — data is the parsed object (or null).
export const SCHEMA_VERSION = '1.0';

// Per-type rule on the number of correct answers (keep in sync with Evaluator strategies).
const TYPE_RULES = {
  single_choice: (n) => (n === 1 ? null : `single_choice requiere exactamente 1 respuesta correcta (tiene ${n})`),
  multiple_choice: (n) => (n >= 2 ? null : `multiple_choice requiere al menos 2 respuestas correctas (tiene ${n})`),
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const q = (v) => JSON.stringify(v);

export function validateBank(input) {
  const errors = [];
  const warnings = [];
  let data = input;

  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (e) {
      return { errors: [`JSON no parseable: ${e.message}`], warnings, data: null };
    }
  }
  if (!isObj(data)) return { errors: ['La raíz del archivo debe ser un objeto JSON'], warnings, data: null };

  if (data.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version: se esperaba "${SCHEMA_VERSION}" y se encontró ${q(data.schema_version ?? null)}`);
  }

  const cert = data.certification;
  if (!isObj(cert)) errors.push('certification: falta el objeto obligatorio');
  else {
    for (const f of ['id', 'name', 'exam_code', 'provider', 'language']) {
      if (!isStr(cert[f])) errors.push(`certification.${f}: campo obligatorio ausente o vacío`);
    }
  }

  if (!Array.isArray(data.domains)) {
    errors.push('domains: campo obligatorio ausente (debe ser una lista)');
    return { errors, warnings, data };
  }
  if (data.domains.length === 0) errors.push('domains: la lista está vacía');

  const domainIds = new Map();
  const questionIds = new Map();
  const stems = new Map();

  data.domains.forEach((d, di) => {
    const dp = `domains[${di}]`;
    if (!isObj(d)) {
      errors.push(`${dp}: debe ser un objeto`);
      return;
    }
    const dl = isStr(d.id) ? `${dp} (${d.id})` : dp;
    if (!isStr(d.id)) errors.push(`${dp}: falta el campo obligatorio id`);
    else if (domainIds.has(d.id)) errors.push(`${dl}: id de dominio repetido (ya usado en ${domainIds.get(d.id)})`);
    else domainIds.set(d.id, dp);
    if (!isStr(d.name)) errors.push(`${dl}: falta el campo obligatorio name`);
    if (!Array.isArray(d.questions)) {
      errors.push(`${dl}: falta el campo obligatorio questions (debe ser una lista)`);
      return;
    }
    if (d.questions.length === 0) errors.push(`${dl}: el dominio no tiene preguntas`);
    d.questions.forEach((question, qi) =>
      validateQuestion(question, `${dp}.questions[${qi}]`, { errors, warnings, questionIds, stems }));
  });

  return { errors, warnings, data };
}

function validateQuestion(qn, qp, ctx) {
  const { errors, warnings, questionIds, stems } = ctx;
  if (!isObj(qn)) {
    errors.push(`${qp}: debe ser un objeto`);
    return;
  }
  const ql = isStr(qn.id) ? `${qp} (${qn.id})` : qp;
  const err = (msg) => errors.push(`${ql}: ${msg}`);

  if (!isStr(qn.id)) err('falta el campo obligatorio id');
  else if (questionIds.has(qn.id)) err(`id de pregunta repetido (ya usado en ${questionIds.get(qn.id)})`);
  else questionIds.set(qn.id, qp);

  if (!isStr(qn.question)) err('falta el campo obligatorio question');
  else {
    const key = qn.question.trim().toLowerCase();
    if (stems.has(key)) warnings.push(`${ql}: enunciado duplicado de ${stems.get(key)}`);
    else stems.set(key, ql);
  }
  if (typeof qn.explanation !== 'string') err('falta el campo obligatorio explanation');

  const typeRule = TYPE_RULES[qn.type];
  if (!isStr(qn.type)) err('falta el campo obligatorio type');
  else if (!typeRule) err(`type ${q(qn.type)} no válido (se admite single_choice | multiple_choice)`);

  let optionIds = null;
  if (!Array.isArray(qn.options)) err('falta el campo obligatorio options (debe ser una lista)');
  else {
    if (qn.options.length < 2) err(`options debe tener al menos 2 opciones (tiene ${qn.options.length})`);
    optionIds = new Set();
    const texts = new Set();
    qn.options.forEach((o, oi) => {
      if (!isObj(o) || !isStr(o.id) || typeof o.text !== 'string') {
        err(`options[${oi}] debe tener id y text`);
        return;
      }
      if (optionIds.has(o.id)) err(`id de opción repetido ${q(o.id)}`);
      optionIds.add(o.id);
      const t = o.text.trim().toLowerCase();
      if (texts.has(t)) warnings.push(`${ql}: texto de opción repetido ${q(o.text)}`);
      texts.add(t);
    });
  }

  if (!Array.isArray(qn.correct_answers)) err('falta el campo obligatorio correct_answers (debe ser una lista)');
  else {
    const seen = new Set();
    for (const a of qn.correct_answers) {
      if (seen.has(a)) err(`correct_answers contiene ${q(a)} repetido`);
      seen.add(a);
      if (optionIds && !optionIds.has(a)) err(`correct_answers contiene ${q(a)}, que no existe en options`);
    }
    if (typeRule) {
      const msg = typeRule(seen.size);
      if (msg) err(msg);
    }
    if (optionIds && optionIds.size >= 2 && [...optionIds].every((id) => seen.has(id))) {
      err('todas las opciones están marcadas como correctas');
    }
  }

  if (qn.references !== undefined && !Array.isArray(qn.references)) {
    warnings.push(`${ql}: references no es una lista; se ignora`);
  }
}
