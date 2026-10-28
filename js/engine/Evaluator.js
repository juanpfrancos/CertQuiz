// Evaluation strategies keyed by question type (Strategy pattern).
// Adding a new type = registerStrategy('new_type', fn); the engine is untouched.
const strategies = new Map();

export function registerStrategy(type, fn) {
  strategies.set(type, fn);
}

export function isSupportedType(type) {
  return strategies.has(type);
}

const sameSet = (a, b) => {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size || sa.size !== a.length) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
};

// single_choice: exactly one selection, equal to the only correct answer.
registerStrategy('single_choice', (question, selected) =>
  selected.length === 1 && selected[0] === question.correct_answers[0]);

// multiple_choice: the selected set must match correct_answers exactly
// (partial or extra selections are 100% incorrect).
registerStrategy('multiple_choice', (question, selected) => sameSet(selected, question.correct_answers));

export function evaluate(question, selected) {
  const strategy = strategies.get(question.type);
  if (!strategy) throw new Error(`Tipo de pregunta no soportado: ${question.type}`);
  return { correct: Boolean(strategy(question, selected)), correctIds: [...question.correct_answers] };
}
