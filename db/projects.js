import { getDB } from './connection.js';
import { STORES } from './schema.js';

function req(idbRequest) {
  return new Promise((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => reject(idbRequest.error);
  });
}

export async function getAllProjects() {
  const db = await getDB();
  const tx = db.transaction(STORES.PROJECTS, 'readonly');
  const results = await req(tx.objectStore(STORES.PROJECTS).getAll());
  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id) {
  const db = await getDB();
  const tx = db.transaction(STORES.PROJECTS, 'readonly');
  return req(tx.objectStore(STORES.PROJECTS).get(id));
}

export async function createProject({ title, notes = '', tags, color, sharedFiles, order }) {
  const db = await getDB();
  const project = {
    id: crypto.randomUUID(),
    title,
    notes,
    order: order ?? Date.now(),
    ...(sharedFiles ? { sharedFiles } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const tx = db.transaction(STORES.PROJECTS, 'readwrite');
  await req(tx.objectStore(STORES.PROJECTS).add(project));
  return project;
}

export async function updateProject(id, changes) {
  const db = await getDB();
  const tx = db.transaction(STORES.PROJECTS, 'readwrite');
  const store = tx.objectStore(STORES.PROJECTS);
  const existing = await req(store.get(id));
  if (!existing) throw new Error(`Project not found: ${id}`);
  const updated = { ...existing, ...changes, id, updatedAt: Date.now() };
  await req(store.put(updated));
  return updated;
}

export async function deleteProject(id) {
  const db = await getDB();
  const tx = db.transaction(STORES.PROJECTS, 'readwrite');
  return req(tx.objectStore(STORES.PROJECTS).delete(id));
}
