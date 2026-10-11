import { beforeEach, describe, expect, it, vi } from 'vitest'

const stored = new Map<string, unknown>()
vi.mock('./idb', () => ({
    idbGet: async (key: string) => stored.get(key),
    idbSet: async (key: string, value: unknown) => void stored.set(key, value),
}))

const { useCatalogStore } = await import('./catalogStore')
const { useToasts } = await import('./toastStore')

beforeEach(() => {
    stored.clear()
    useCatalogStore.setState({ sources: [], hydrated: false })
    useToasts.setState({ toasts: [] })
})

describe('catalog persistence', () => {
    it('drops sources stored by V2.0 and says so', async () => {
        stored.set('sources', [{ id: 'old', complete: true }])
        await useCatalogStore.getState().hydrate()
        expect(useCatalogStore.getState()).toMatchObject({ sources: [], hydrated: true })
        expect(stored.get('sources')).toBeUndefined()
        expect(useToasts.getState().toasts[0].message).toMatch(/import them again/)
    })
    it('restores sources stored by this version', async () => {
        const source = { id: 'a', complete: true, roots: [], types: {}, pathPrefix: '', port: 851 }
        stored.set('sources@2.1', [source])
        await useCatalogStore.getState().hydrate()
        expect(useCatalogStore.getState().sources).toEqual([source])
        expect(useToasts.getState().toasts).toEqual([])
    })
})
