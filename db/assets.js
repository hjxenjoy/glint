import { getDB } from './connection.js';
import { STORES, INDEXES } from './schema.js';

function req(idbRequest) {
  return new Promise((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => reject(idbRequest.error);
  });
}

export async function getAssetsByDemo(demoId) {
  const db = await getDB();
  const tx = db.transaction(STORES.ASSETS, 'readonly');
  const index = tx.objectStore(STORES.ASSETS).index(INDEXES.ASSETS_BY_DEMO);
  return req(index.getAll(demoId));
}

export async function getAsset(id) {
  const db = await getDB();
  const tx = db.transaction(STORES.ASSETS, 'readonly');
  return req(tx.objectStore(STORES.ASSETS).get(id));
}

export async function saveAsset({ demoId, filename, mimeType, data, size }) {
  const db = await getDB();
  // Check if an asset with this demoId+filename already exists
  const existing = (await getAssetsByDemo(demoId)).find((a) => a.filename === filename);
  const asset = {
    id: existing?.id ?? crypto.randomUUID(),
    demoId,
    filename,
    mimeType,
    data,
    size,
  };
  const tx = db.transaction(STORES.ASSETS, 'readwrite');
  await req(tx.objectStore(STORES.ASSETS).put(asset));
  return asset;
}

export async function deleteAsset(id) {
  const db = await getDB();
  const tx = db.transaction(STORES.ASSETS, 'readwrite');
  return req(tx.objectStore(STORES.ASSETS).delete(id));
}

export async function deleteAssetsByDemo(demoId) {
  const assets = await getAssetsByDemo(demoId);
  const db = await getDB();
  const tx = db.transaction(STORES.ASSETS, 'readwrite');
  await Promise.all(assets.map((a) => req(tx.objectStore(STORES.ASSETS).delete(a.id))));
}
