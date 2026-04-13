// game-store.js
//
// IndexedDB wrapper for storing uploaded game files in the browser.
// One game at a time — storeGameFiles() clears any previous game first.

const DB_NAME = "scumm-game-upload";
const DB_VERSION = 1;
const STORE_NAME = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "path" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store game files, replacing any previously stored game. */
export async function storeGameFiles(files) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.clear();
  for (const f of files) store.put(f); // { path, data: ArrayBuffer, size }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Retrieve all stored game files. */
export async function getGameFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Check whether any game files are stored. */
export async function hasStoredGame() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .count();
    req.onsuccess = () => { db.close(); resolve(req.result > 0); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Delete all stored game files. */
export async function clearGameFiles() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
