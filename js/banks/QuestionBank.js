// Domain model: an immutable, flattened view of a validated bank.
import { validateBank } from './BankValidator.js';
import { evaluate } from '../engine/Evaluator.js';

export function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

// Accepts [{title, url?}] (current format) and ["https://..."] (legacy format).
function normalizeReferences(refs) {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((r) => {
      if (typeof r === 'string') return { title: r, url: safeUrl(r) };
      if (r && typeof r === 'object') {
        const url = typeof r.url === 'string' ? safeUrl(r.url) : null;
        const title = typeof r.title === 'string' && r.title.trim() ? r.title : (url || '');
        return { title, url };
      }
      return null;
    })
    .filter((r) => r && r.title);
}

export class Question {
  constructor(raw, domainId) {
    this.id = raw.id;
    this.domainId = domainId;
    this.type = raw.type;
    this.question = raw.question;
    this.options = raw.options.map((o) => ({ id: o.id, text: o.text }));
    this.correct_answers = [...raw.correct_answers];
    this.explanation = raw.explanation;
    this.references = normalizeReferences(raw.references);
    Object.freeze(this);
  }

  evaluate(selectedIds) {
    return evaluate(this, selectedIds);
  }

  optionText(id) {
    return this.options.find((o) => o.id === id)?.text ?? id;
  }
}

export class QuestionBank {
  constructor(data, meta = {}) {
    this.id = data.certification.id;
    this.certification = { ...data.certification };
    this.source = meta.source || 'builtin';
    this.file = meta.file || null;
    this.questions = [];
    this.domains = data.domains.map((d) => {
      for (const q of d.questions) this.questions.push(new Question(q, d.id));
      return { id: d.id, name: d.name, examWeight: d.exam_weight ?? null, count: d.questions.length };
    });
    this.byId = new Map(this.questions.map((q) => [q.id, q]));
    this.domainById = new Map(this.domains.map((d) => [d.id, d]));
  }

  get name() {
    return this.certification.name;
  }

  get label() {
    return `${this.certification.name} (${this.certification.exam_code})`;
  }

  static validateSchema(input) {
    return validateBank(input);
  }
}
