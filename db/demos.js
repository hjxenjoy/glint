import { getDB } from './connection.js';
import { STORES, INDEXES } from './schema.js';

function req(idbRequest) {
  return new Promise((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => reject(idbRequest.error);
  });
}

export async function getAllDemos() {
  const db = await getDB();
  const tx = db.transaction(STORES.DEMOS, 'readonly');
  const results = await req(tx.objectStore(STORES.DEMOS).getAll());
  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDemosByProject(projectId) {
  const db = await getDB();
  const tx = db.transaction(STORES.DEMOS, 'readonly');
  const index = tx.objectStore(STORES.DEMOS).index(INDEXES.DEMOS_BY_PROJECT);
  const results = await req(index.getAll(projectId));
  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getStandaloneDemos() {
  return getDemosByProject(null);
}

export async function getDemo(id) {
  const db = await getDB();
  const tx = db.transaction(STORES.DEMOS, 'readonly');
  return req(tx.objectStore(STORES.DEMOS).get(id));
}

export async function createDemo({
  projectId = null,
  title,
  notes = '',
  tags,
  entryFile = 'index.html',
  files = [],
}) {
  const db = await getDB();
  const demo = {
    id: crypto.randomUUID(),
    projectId,
    title,
    notes,
    entryFile,
    files,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const tx = db.transaction(STORES.DEMOS, 'readwrite');
  await req(tx.objectStore(STORES.DEMOS).add(demo));
  return demo;
}

export async function updateDemo(id, changes) {
  const db = await getDB();
  const tx = db.transaction(STORES.DEMOS, 'readwrite');
  const store = tx.objectStore(STORES.DEMOS);
  const existing = await req(store.get(id));
  if (!existing) throw new Error(`Demo not found: ${id}`);
  const updated = { ...existing, ...changes, id, updatedAt: Date.now() };
  await req(store.put(updated));
  return updated;
}

export async function cloneDemo(id) {
  const src = await getDemo(id);
  if (!src) throw new Error(`Demo not found: ${id}`);
  const clone = {
    ...src,
    id: crypto.randomUUID(),
    title: src.title + ' (副本)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const db = await getDB();
  const tx = db.transaction(STORES.DEMOS, 'readwrite');
  await req(tx.objectStore(STORES.DEMOS).add(clone));
  return clone;
}

export async function deleteDemo(id) {
  const db = await getDB();
  const tx = db.transaction(STORES.DEMOS, 'readwrite');
  return req(tx.objectStore(STORES.DEMOS).delete(id));
}
