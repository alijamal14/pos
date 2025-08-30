import { writable } from 'svelte/store';
import { broadcast } from '$lib/p2p/webrtc';

export interface Item {
  id: string;
  text: string;
  updatedAt: string;
  deleted?: boolean;
  author?: string;
}

const DB_NAME = 'p2p-items-db';
const DB_STORE = 'items';
let db: IDBDatabase | null = null;

function openDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (db) return resolve();
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e: any) => {
      const d = e.target.result as IDBDatabase;
      const store = d.createObjectStore(DB_STORE, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt');
    };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromDB(): Promise<Item[]> {
  await openDB();
  return new Promise((resolve, reject) => {
    if (!db) return resolve([]);
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const res: Item[] = [];
    store.openCursor().onsuccess = (e: any) => {
      const c = e.target.result; if (c) { res.push(c.value); c.continue(); } else resolve(res);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function putToDB(item: Item) {
  await openDB();
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB not opened'));
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(item);
    tx.oncomplete = () => resolve(null);
    tx.onerror = () => reject(tx.error);
  });
}

// In-memory store exposed to the app
export const itemsStore = writable<Record<string, Item>>({});

export async function loadFromDB() {
  const all = await getAllFromDB();
  const map: Record<string, Item> = {};
  for (const it of all) map[it.id] = it;
  itemsStore.set(map);
}

export function makeItem(text: string, author?: string): Item {
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2,9);
  return { id, text, updatedAt: new Date().toISOString(), deleted: false, author };
}

export async function applyOp(op: { type: 'upsert' | 'delete', item?: Item, id?: string }) {
  const cur = getCurrentItems();
  if (op.type === 'upsert' && op.item) {
    const existing = cur[op.item.id];
    if (!existing || (existing.updatedAt || '') < (op.item.updatedAt || '')) {
      cur[op.item.id] = op.item;
      await putToDB(op.item);
      itemsStore.set({ ...cur });

      // Broadcast the operation to connected peers
      broadcast({ type: 'op', op });
    }
  } else if (op.type === 'delete' && op.id) {
    const existing = cur[op.id];
    const tomb: Item = { id: op.id, text: existing?.text || '', updatedAt: new Date().toISOString(), deleted: true, author: existing?.author };
    cur[op.id] = tomb;
    await putToDB(tomb);
    itemsStore.set({ ...cur });

    // Broadcast the operation to connected peers
    broadcast({ type: 'op', op });
  }
}

export function getCurrentItems() {
  let v: Record<string, Item> = {};
  itemsStore.subscribe(x => v = x)();
  return v;
}

export async function exportJSON() {
  const current = getCurrentItems();
  return JSON.stringify({ items: current }, null, 2);
}

export async function importJSON(text: string) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw new Error('Invalid JSON'); }
  if (obj && obj.items) {
    for (const it of Object.values(obj.items as Record<string, Item>)) {
      await applyOp({ type: 'upsert', item: it });
    }
  }
}
