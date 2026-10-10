import { create } from 'zustand'
import type { SymbolSource } from '@/catalog/model'
import type { SearchIndex } from '@/catalog/search'
import { buildIndex } from '@/catalog/search'
import { importTwinCatFile } from '@/catalog/importFile'
import { idbGet, idbSet } from './idb'

export interface ImportReport {
    fileName: string
    sources: number
    symbols: number
    error?: string
}

type SourcePatch = Partial<Pick<SymbolSource, 'title' | 'pathPrefix' | 'port' | 'amsNetId'>>

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

const STORAGE_KEY = 'sources'

/**
 * A PLC's I/O variables from a `.xti`/`.tsproj` are a subset of its `.tmc` symbols.
 * When both are present for the same port, keep the complete one.
 */
function withoutRedundantPlcIo(sources: SymbolSource[]): SymbolSource[] {
    const tmcPorts = new Set(sources.filter((s) => s.kind === 'PLC' && /\.tmc$/i.test(s.fileName)).map((s) => s.port))
    return sources.filter((s) => !(s.kind === 'PLC' && !/\.tmc$/i.test(s.fileName) && tmcPorts.has(s.port)))
}

function commit(sources: SymbolSource[]): Pick<CatalogState, 'sources' | 'index'> {
    void idbSet(STORAGE_KEY, sources)
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
                // Re-importing a file replaces what it contributed before.
                sources = [...sources.filter((s) => s.fileName !== file.name), ...imported]
                reports.push({
                    fileName: file.name,
                    sources: imported.length,
                    symbols: imported.reduce((n, s) => n + s.roots.length, 0),
                })
            } catch (e) {
                reports.push({ fileName: file.name, sources: 0, symbols: 0, error: e instanceof Error ? e.message : String(e) })
            }
        }
        set(commit(withoutRedundantPlcIo(sources)))
        return reports
    },

    updateSource: (id, patch) => set((s) => commit(s.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)))),
    removeSource: (id) => set((s) => commit(s.sources.filter((src) => src.id !== id))),
    clear: () => set(commit([])),

    hydrate: async () => {
        const stored = await idbGet<SymbolSource[]>(STORAGE_KEY)
        if (Array.isArray(stored) && get().sources.length === 0) {
            set({ sources: stored, index: buildIndex(stored), hydrated: true })
        } else {
            set({ hydrated: true })
        }
    },
}))
