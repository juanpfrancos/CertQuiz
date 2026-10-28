// Lists banks from ./dumps/index.json plus banks uploaded by the user (IndexedDB).
import { QuestionBank } from './QuestionBank.js';
import { validateBank } from './BankValidator.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class BankRepository {
  constructor(storage) {
    this.storage = storage;
    this.banks = new Map();
  }

  // Returns a list of human-readable problems (never throws).
  async loadAll() {
    const problems = [];
    const loaded = new Map();
    let index = [];
    try {
      const res = await fetch('./dumps/index.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      index = await res.json();
      if (!Array.isArray(index)) throw new Error('formato no válido');
    } catch (e) {
      problems.push(`No se pudo leer dumps/index.json (${e.message})`);
      index = [];
    }

    const builtins = await Promise.all(index.map(async (entry) => {
      if (!entry || typeof entry.file !== 'string' || entry.file.includes('..')) return null;
      try {
        const res = await fetch(`./dumps/${entry.file}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { errors, data } = validateBank(await res.text());
        if (errors.length) {
          problems.push(`${entry.file}: ${errors.length} error(es) de validación; no se carga`);
          return null;
        }
        return new QuestionBank(data, { source: 'builtin', file: entry.file });
      } catch (e) {
        problems.push(`No se pudo cargar ${entry.file} (${e.message})`);
        return null;
      }
    }));
    for (const b of builtins) if (b) loaded.set(b.id, b);

    const uploaded = await this.storage.getAllIndexedDB('banks');
    for (const rec of uploaded || []) {
      const { errors, data } = validateBank(rec.data);
      if (errors.length) problems.push(`Banco subido "${rec.id}" no válido; se omite`);
      else loaded.set(data.certification.id, new QuestionBank(data, { source: 'uploaded', file: rec.fileName }));
    }
    this.banks = loaded;
    return problems;
  }

  list() {
    return [...this.banks.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  get(id) {
    return this.banks.get(id) || null;
  }

  has(id) {
    return this.banks.has(id);
  }

  async readFile(file) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return { fileName: file.name, errors: ['El archivo supera el límite de 10 MB'], warnings: [], data: null };
    }
    const text = await file.text();
    return { fileName: file.name, ...validateBank(text) };
  }

  async saveUploaded(data, fileName) {
    await this.storage.saveIndexedDB('banks', { id: data.certification.id, data, fileName, uploadedAt: new Date().toISOString() });
    const bank = new QuestionBank(data, { source: 'uploaded', file: fileName });
    this.banks.set(bank.id, bank);
    return bank;
  }

  async removeUploaded(id) {
    await this.storage.deleteIndexedDB('banks', id);
    return this.loadAll();
  }
}
