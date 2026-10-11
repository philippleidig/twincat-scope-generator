import { create } from 'zustand'
import type { SymbolSource } from '@/catalog/model'
import type { SearchIndex } from '@/catalog/search'
import { buildIndex } from '@/catalog/search'
import { importTwinCatFile, mergeSources } from '@/catalog/importFile'
import { useBrowserStore } from './browserStore'
import { idbGet, idbSet } from './idb'
import { toast } from './toastStore'

export interface ImportReport {
    fileName: string
    sourceIds: string[]
    symbols: number
    error?: string
}

export type SourcePatch = Partial<Pick<SymbolSource, 'title' | 'pathPrefix' | 'port' | 'amsNetId'>>

interface CatalogState {
    sources: SymbolSource[]
    index: SearchIndex
    /** True once persisted sources have been restored (or restoring failed). */
    hydrated: boolean
    importFiles: (files: Array<{ name: string; text: string }>) => ImportReport[]
    updateSource: (id: string, patch: SourcePatch) => void
    removeSource: (id: string) => void
    clear: () => void
    hydrate: () => Promise<void>
}

/**
 * Versioned: V2.1 reads pointers, references and access flags into the stored sources, so sources
 * stored by V2.0 (under `sources`) would produce wrong paths. They are dropped with a hint.
 */
const STORAGE_KEY = 'sources@2.1'
const OUTDATED_KEYS = ['sources']

/** New sources: rebuild the index, persist, and drop picks that may point at changed paths. */
function commit(sources: SymbolSource[]): Pick<CatalogState, 'sources' | 'index'> {
    void idbSet(STORAGE_KEY, sources)
    useBrowserStore.getState().resetPicks()
    return { sources, index: buildIndex(sources) }
}

export const useCatalogStore = create<CatalogState>()((set, get) => ({
    sources: [],
    index: { entries: [], truncated: false },
    hydrated: false,

    importFiles: (files) => {
        const reports: ImportReport[] = []
        let sources = get().sources
        for (const file of files) {
            try {
                const imported = importTwinCatFile(file.name, file.text)
                sources = mergeSources(sources, imported)
                reports.push({
                    fileName: file.name,
                    sourceIds: imported.map((s) => s.id),
                    symbols: imported.reduce((n, s) => n + s.roots.length, 0),
                })
            } catch (e) {
                reports.push({ fileName: file.name, sourceIds: [], symbols: 0, error: e instanceof Error ? e.message : String(e) })
            }
        }
        set(commit(sources))
        return reports
    },

    updateSource: (id, patch) => set((s) => commit(s.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)))),
    removeSource: (id) => set((s) => commit(s.sources.filter((src) => src.id !== id))),
    clear: () => set(commit([])),

    hydrate: async () => {
        const stored = await idbGet<SymbolSource[]>(STORAGE_KEY)
        // Files imported while restoring win; stored sources from older versions are dropped.
        if (Array.isArray(stored) && get().sources.length === 0 && stored.every((s) => typeof s?.complete === 'boolean')) {
            set({ sources: stored, index: buildIndex(stored), hydrated: true })
        } else {
            set({ hydrated: true })
        }
        for (const key of OUTDATED_KEYS) {
            const outdated = await idbGet<unknown[]>(key)
            if (!Array.isArray(outdated)) continue
            void idbSet(key, undefined)
            if (outdated.length > 0) toast.info('Imported TwinCAT files from an older version were removed — import them again to browse them.')
        }
    },
}))
