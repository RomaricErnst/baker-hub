// Photo bytes for the local bake journal, in IndexedDB on this device.
// Each function resolves (never rejects): a browser without IndexedDB, a
// private window or a full disk simply has no photos.
import { compressImage } from './photoUpload';

const DB_NAME = 'bh_journal';
const STORE = 'photos';

export interface JournalPhoto { id: string; entryId: string; blob: Blob; createdAt: number }

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('entryId', 'entryId');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest | void, read?: (request: IDBRequest) => T): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(request && read ? read(request) : (true as unknown as T)); };
      tx.onerror = () => { db.close(); resolve(null); };
      tx.onabort = () => { db.close(); resolve(null); };
    } catch { db.close(); resolve(null); }
  });
}

/** Downscales to about 1200 px JPEG and stores it. Returns the new photo id, or null. */
export async function addJournalPhoto(entryId: string, file: File): Promise<string | null> {
  try {
    let blob: Blob;
    try { blob = await compressImage(file); } catch { return null; }
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const photo: JournalPhoto = { id, entryId, blob, createdAt: Date.now() };
    const ok = await run('readwrite', store => { store.put(photo); });
    return ok ? id : null;
  } catch { return null; }
}

export async function readJournalPhotos(ids: string[]): Promise<JournalPhoto[]> {
  if (!ids.length) return [];
  const rows = await run('readonly', store => store.getAll(), request => request.result as JournalPhoto[]);
  if (!rows) return [];
  return ids.map(id => rows.find(row => row.id === id)).filter((row): row is JournalPhoto => !!row && row.blob instanceof Blob);
}

export async function deleteJournalPhotos(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await run('readwrite', store => { for (const id of ids) store.delete(id); });
}
