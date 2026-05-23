const DB_NAME = 'loomi'
const STORE = 'kv'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function toUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  return null
}

export async function idbSet(key: string, value: Uint8Array): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('IndexedDB write failed'))
    }
    tx.objectStore(STORE).put(value, key)
  })
}

export async function idbGet(key: string): Promise<Uint8Array | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('IndexedDB read failed'))
    }
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => {
      db.close()
      resolve(toUint8Array(req.result))
    }
    req.onerror = () => {
      db.close()
      reject(req.error ?? new Error('IndexedDB get failed'))
    }
  })
}
