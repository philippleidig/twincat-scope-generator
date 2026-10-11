import { beforeEach, describe, expect, it, vi } from 'vitest'

const stored = new Map<string, unknown>()
vi.mock('./idb', () => ({
    idbGet: async (key: string) => stored.get(key),
    idbSet: async (key: string, value: unknown) => void stored.set(key, value),
    idbDelete: async (key: string) => void stored.delete(key),
}))

/** Fresh stores per test: hydration runs once per page load (module). */
async function load() {
    vi.resetModules()
    const { useCatalogStore } = await import('./catalogStore')
    const { useToasts } = await import('./toastStore')
    return { useCatalogStore, useToasts }
}

beforeEach(() => stored.clear())

describe('catalog persistence', () => {
    it('drops sources stored by V2.0 and says so once, however often hydrate is called', async () => {
        const { useCatalogStore, useToasts } = await load()
        stored.set('sources', [{ id: 'old', complete: true }])
        await Promise.all([useCatalogStore.getState().hydrate(), useCatalogStore.getState().hydrate()])
        expect(useCatalogStore.getState()).toMatchObject({ sources: [], hydrated: true })
        expect(stored.has('sources')).toBe(false)
        expect(useToasts.getState().toasts.map((t) => t.message)).toEqual([expect.stringMatching(/import them again/)])
    })
    it('restores sources stored by this version', async () => {
        const { useCatalogStore, useToasts } = await load()
        const source = { id: 'a', complete: true, roots: [], types: {}, pathPrefix: '', port: 851 }
        stored.set('sources@2.1', [source])
        await useCatalogStore.getState().hydrate()
        expect(useCatalogStore.getState().sources).toEqual([source])
        expect(useToasts.getState().toasts).toEqual([])
    })
})
