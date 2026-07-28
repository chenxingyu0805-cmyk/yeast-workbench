/*
 * db.js — 本地存储层 (IndexedDB)
 * 纯前端、离线、数据存于本机浏览器。支持 CRUD、导出/导入 JSON 备份。
 */
(function (root) {
  'use strict';

  const DB_NAME = 'yeast_workbench';
  const DB_VERSION = 1;
  const STORES = ['strains', 'experiments', 'primers'];

  let _db = null;

  function genId() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = root.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach(s => {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode) {
    return open().then(db => db.transaction(store, mode).objectStore(store));
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const DB = {
    genId, nowISO,
    STORES,

    init: open,

    getAll(store) {
      return tx(store, 'readonly').then(os => reqToPromise(os.getAll()));
    },

    get(store, id) {
      return tx(store, 'readonly').then(os => reqToPromise(os.get(id)));
    },

    put(store, obj) {
      return tx(store, 'readwrite').then(os => reqToPromise(os.put(obj))).then(() => obj);
    },

    // 自动补 id / 时间戳后写入或更新
    save(store, obj) {
      const t = nowISO();
      if (!obj.id) obj.id = genId();
      obj.updatedAt = t;
      if (!obj.createdAt) obj.createdAt = t;
      return this.put(store, obj);
    },

    remove(store, id) {
      return tx(store, 'readwrite').then(os => reqToPromise(os.delete(id)));
    },

    clear(store) {
      return tx(store, 'readwrite').then(os => reqToPromise(os.clear()));
    },

    count(store) {
      return tx(store, 'readonly').then(os => reqToPromise(os.count()));
    },

    // 导出全部数据为 JSON 对象
    async exportAll() {
      const out = { meta: { app: 'yeast-workbench', version: DB_VERSION, exportedAt: nowISO() } };
      for (const s of STORES) out[s] = await this.getAll(s);
      return out;
    },

    // 导入（覆盖式）：清空各库后批量写入
    async importAll(data) {
      for (const s of STORES) {
        if (!data[s]) continue;
        await this.clear(s);
        for (const item of data[s]) {
          await this.put(s, item);
        }
      }
    }
  };

  root.YWDB = DB;
  if (typeof module !== 'undefined' && module.exports) module.exports = DB;
})(typeof window !== 'undefined' ? window : globalThis);
