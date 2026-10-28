// Hides the physical storage engines (Adapter). Failures (quota, corrupt JSON,
// private mode, IndexedDB unavailable) are reported through the bus and the app
// keeps running with an in-memory fallback.
export const LS_PREFIX = 'cq:v1:';
export const DB_NAME = 'cq-v1';
const DB_VERSION = 1;
const META_KEY = 'cq:meta';
const LS_SCHEMA = 1;

// localStorage migrations: key = target version, fn migrates from version-1.
const LS_MIGRATIONS = {
  1: () => {}, // initial schema
};

const KEY_OF = {
  banks: (v) => v.id,
  attempts: (v) => v.id,
  questionStats: (v) => JSON.stringify([v.bankId, v.questionId]),
};

export class StorageAdapter {
  constructor(bus) {
    this.bus = bus;
    this.memory = new Map(); // localStorage fallback
    this.memDB = new Map(); // IndexedDB fallback
    this.dbPromise = null;
    this.db = null;
    this.idbOk = true;
    this.warned = new Set();
  }

  warn(msg) {
    if (this.warned.has(msg)) return;
    this.warned.add(msg);
    this.bus?.emit('storage:error', msg);
  }

  migrate() {
    let meta = null;
    try {
      meta = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    } catch {
      meta = null;
    }
    let v = Number(meta?.schemaVersion) || 0;
    while (v < LS_SCHEMA) {
      v += 1;
      try {
        LS_MIGRATIONS[v]?.(this);
      } catch (e) {
        console.error('Migración fallida', v, e);
      }
    }
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ schemaVersion: LS_SCHEMA }));
    } catch {
      /* reported on first real write */
    }
  }

  // ---------- localStorage ----------
  getLocal(key, fallback = null) {
    const full = LS_PREFIX + key;
    let raw;
    try {
      raw = localStorage.getItem(full);
    } catch {
      this.warn('El almacenamiento local no está disponible (¿modo privado?). Los datos solo durarán esta sesión.');
      return this.memory.has(full) ? this.memory.get(full) : fallback;
    }
    if (raw == null) return this.memory.has(full) ? this.memory.get(full) : fallback;
    try {
      return JSON.parse(raw);
    } catch {
      this.warn(`Datos dañados en "${key}": se han restablecido.`);
      try {
        localStorage.removeItem(full);
      } catch { /* ignore */ }
      return fallback;
    }
  }

  saveLocal(key, value) {
    const full = LS_PREFIX + key;
    this.memory.set(full, value);
    try {
      localStorage.setItem(full, JSON.stringify(value));
      this.memory.delete(full);
      return true;
    } catch {
      this.warn('No se pudo guardar en el almacenamiento local (cuota llena o modo privado). Los cambios solo durarán esta sesión.');
      return false;
    }
  }

  removeLocal(key) {
    const full = LS_PREFIX + key;
    this.memory.delete(full);
    try {
      localStorage.removeItem(full);
    } catch { /* ignore */ }
  }

  // ---------- IndexedDB ----------
  openDB() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        this.idbFail();
        resolve(null);
        return;
      }
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (e.oldVersion < 1) {
          db.createObjectStore('banks', { keyPath: 'id' });
          db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('bankId', 'bankId');
          db.createObjectStore('questionStats', { keyPath: ['bankId', 'questionId'] }).createIndex('bankId', 'bankId');
        }
        // Future versions: if (e.oldVersion < 2) { ... }
      };
      req.onsuccess = () => {
        this.db = req.result;
        this.db.onversionchange = () => this.closeDB();
        resolve(this.db);
      };
      req.onerror = () => {
        this.idbFail();
        resolve(null);
      };
      req.onblocked = () => this.warn('La base de datos está bloqueada por otra pestaña de CertQuiz.');
    });
    return this.dbPromise;
  }

  closeDB() {
    try {
      this.db?.close();
    } catch { /* ignore */ }
    this.db = null;
    this.dbPromise = null;
  }

  idbFail() {
    if (!this.idbOk) return;
    this.idbOk = false;
    this.warn('IndexedDB no está disponible: el historial y los bancos subidos solo se conservarán durante esta sesión.');
  }

  mem(store) {
    if (!this.memDB.has(store)) this.memDB.set(store, new Map());
    return this.memDB.get(store);
  }

  async run(store, mode, idbFn, memFn) {
    const db = await this.openDB();
    if (!db) return memFn(this.mem(store));
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        let result;
        const req = idbFn(tx.objectStore(store));
        if (req) req.onsuccess = () => { result = req.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (e) {
      this.warn(e?.name === 'QuotaExceededError'
        ? 'Espacio de almacenamiento lleno: no se pudieron guardar algunos datos.'
        : `Error de base de datos: ${e?.message || e}`);
      return mode === 'readonly' ? memFn(this.mem(store)) : undefined;
    }
  }

  getIndexedDB(store, key) {
    return this.run(store, 'readonly', (os) => os.get(key), (m) => m.get(Array.isArray(key) ? JSON.stringify(key) : key));
  }

  async getAllIndexedDB(store, indexName, value) {
    const res = await this.run(
      store, 'readonly',
      (os) => (indexName ? os.index(indexName).getAll(value) : os.getAll()),
      (m) => [...m.values()].filter((v) => !indexName || v[indexName] === value),
    );
    return res || [];
  }

  saveIndexedDB(store, valueOrList) {
    const list = Array.isArray(valueOrList) ? valueOrList : [valueOrList];
    return this.run(store, 'readwrite', (os) => { for (const v of list) os.put(v); }, (m) => {
      for (const v of list) m.set(KEY_OF[store](v), v);
    });
  }

  deleteIndexedDB(store, key) {
    return this.run(store, 'readwrite', (os) => os.delete(key), (m) => m.delete(key));
  }

  clearIndexedDB(store) {
    return this.run(store, 'readwrite', (os) => os.clear(), (m) => m.clear());
  }

  // Full wipe, in the documented order. The caller reloads the page afterwards.
  async purgeAllData() {
    const report = { idb: 'skipped', localKeys: 0, caches: 0, workers: 0 };
    this.closeDB();
    this.dbPromise = Promise.resolve(null);
    report.idb = await new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.deleteDatabase(DB_NAME);
      } catch {
        resolve('unavailable');
        return;
      }
      const timeout = setTimeout(() => resolve('timeout'), 8000);
      req.onsuccess = () => { clearTimeout(timeout); resolve('deleted'); };
      req.onerror = () => { clearTimeout(timeout); resolve('error'); };
      req.onblocked = () => this.warn('Cierra las demás pestañas de CertQuiz para completar el borrado.');
    });
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('cq:')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      report.localKeys = keys.length;
    } catch { /* ignore */ }
    try {
      sessionStorage.clear();
    } catch { /* ignore */ }
    this.memory.clear();
    this.memDB.clear();
    if ('caches' in self) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      report.caches = names.length;
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      report.workers = regs.length;
    }
    return report;
  }
}
