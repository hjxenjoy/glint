import { getDB } from './connection.js';
import { STORES } from './schema.js';

function req(idbRequest) {
  return new Promise((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => reject(idbRequest.error);
  });
}

export async function getSetting(key, defaultValue = null) {
  const db = await getDB();
  const tx = db.transaction(STORES.SETTINGS, 'readonly');
  const record = await req(tx.objectStore(STORES.SETTINGS).get(key));
  return record !== undefined ? record.value : defaultValue;
}

export async function setSetting(key, value) {
  const db = await getDB();
  const tx = db.transaction(STORES.SETTINGS, 'readwrite');
  await req(tx.objectStore(STORES.SETTINGS).put({ key, value }));
}

export async function getAllSettings() {
  const db = await getDB();
  const tx = db.transaction(STORES.SETTINGS, 'readonly');
  const records = await req(tx.objectStore(STORES.SETTINGS).getAll());
  return Object.fromEntries(records.map((r) => [r.key, r.value]));
}
