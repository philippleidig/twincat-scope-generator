/**
 * Minimal IndexedDB key/value store. Imported symbol sources can be several MB, which
 * does not fit localStorage. Every failure (private mode, blocked storage, no
 * IndexedDB in tests) degrades to "nothing stored" instead of throwing.
 */
const DB = 'twincat-scope-generator'
const STORE = 'kv'

function open(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') return resolve(null)
            const req = indexedDB.open(DB, 1)
            req.onupgradeneeded = () => req.result.createObjectStore(STORE)
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => resolve(null)
        } catch {
            resolve(null)
        }
    })
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
    const db = await open()
    if (!db) return undefined
    return new Promise((resolve) => {
        try {
            const req = db.transaction(STORE).objectStore(STORE).get(key)
            req.onsuccess = () => resolve(req.result as T | undefined)
            req.onerror = () => resolve(undefined)
        } catch {
            resolve(undefined)
        }
    })
}

async function write(change: (store: IDBObjectStore) => void): Promise<void> {
    const db = await open()
    if (!db) return
    await new Promise<void>((resolve) => {
        try {
            const tx = db.transaction(STORE, 'readwrite')
            change(tx.objectStore(STORE))
            tx.oncomplete = () => resolve()
            tx.onerror = () => resolve()
        } catch {
            resolve()
        }
    })
}

export function idbSet(key: string, value: unknown): Promise<void> {
    return write((store) => store.put(value, key))
}

export function idbDelete(key: string): Promise<void> {
    return write((store) => store.delete(key))
}
