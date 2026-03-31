import { DB_NAME, DB_VERSION, STORES, INDEXES } from './schema.js';

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // projects store
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          const projects = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
          projects.createIndex(INDEXES.PROJECTS_BY_UPDATED, 'updatedAt');
          projects.createIndex(INDEXES.PROJECTS_BY_TAG, 'tags', { multiEntry: true });
        }

        // demos store
        if (!db.objectStoreNames.contains(STORES.DEMOS)) {
          const demos = db.createObjectStore(STORES.DEMOS, { keyPath: 'id' });
          demos.createIndex(INDEXES.DEMOS_BY_PROJECT, 'projectId');
          demos.createIndex(INDEXES.DEMOS_BY_UPDATED, 'updatedAt');
          demos.createIndex(INDEXES.DEMOS_BY_TAG, 'tags', { multiEntry: true });
        }

        // assets store
        if (!db.objectStoreNames.contains(STORES.ASSETS)) {
          const assets = db.createObjectStore(STORES.ASSETS, { keyPath: 'id' });
          assets.createIndex(INDEXES.ASSETS_BY_DEMO, 'demoId');
        }

        // settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}
