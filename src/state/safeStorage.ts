import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage for zustand `persist` that never throws: when storage is blocked (private mode,
 * disabled site data) reads find nothing and writes are dropped, so preferences just don't survive
 * a reload.
 */
export const safeLocalStorage: StateStorage = {
    getItem: (name) => {
        try {
            return localStorage.getItem(name)
        } catch {
            return null
        }
    },
    setItem: (name, value) => {
        try {
            localStorage.setItem(name, value)
        } catch {
            // Storage blocked or full.
        }
    },
    removeItem: (name) => {
        try {
            localStorage.removeItem(name)
        } catch {
            // Storage blocked.
        }
    },
}
