import { create } from 'zustand'
import type { ScopeDataType } from '@/domain/dataTypes'
import type { AreaKind } from '@/catalog/model'
import type { SymbolKind } from '@/catalog/walk'
import { sourceKey } from '@/catalog/tree'

/**
 * Something picked in the browser — a tree node (`GVL.aAxis[3]`) or a search result
 * (`GVL.aAxis[*]`) — as plain data. It is resolved against the current catalog only when
 * it is added, so it can be serialised for drag & drop and never goes stale.
 */
export interface BrowserPick {
    key: string
    sourceId: string
    path: string
    kind: SymbolKind
}

/** MIME type of a drag carrying browser picks (JSON). */
export const PICK_MIME = 'application/x-scope-picks'

interface BrowserState {
    query: string
    scopeTypes: Set<ScopeDataType>
    areas: Set<AreaKind>
    recordableOnly: boolean
    expanded: Set<string>
    selection: Map<string, BrowserPick>
    /** Row whose details the inspector shows. */
    focused: BrowserPick | null

    setQuery: (q: string) => void
    toggleScopeType: (t: ScopeDataType) => void
    toggleArea: (a: AreaKind) => void
    setRecordableOnly: (v: boolean) => void
    clearFilters: () => void
    toggleExpanded: (key: string) => void
    collapseAll: () => void
    toggleSelected: (pick: BrowserPick) => void
    setSelection: (picks: BrowserPick[]) => void
    clearSelection: () => void
    setFocused: (pick: BrowserPick | null) => void
    /** Open these sources in the tree. */
    expandSources: (sourceIds: string[]) => void
    /** Forget selection and focus (the catalog changed under them). */
    resetPicks: () => void
}

const toggled = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
}

export const useBrowserStore = create<BrowserState>()((set) => ({
    query: '',
    scopeTypes: new Set(),
    areas: new Set(),
    recordableOnly: false,
    expanded: new Set(),
    selection: new Map(),
    focused: null,

    setQuery: (query) => set({ query }),
    toggleScopeType: (t) => set((s) => ({ scopeTypes: toggled(s.scopeTypes, t) })),
    toggleArea: (a) => set((s) => ({ areas: toggled(s.areas, a) })),
    setRecordableOnly: (recordableOnly) => set({ recordableOnly }),
    clearFilters: () => set({ query: '', scopeTypes: new Set(), areas: new Set(), recordableOnly: false }),
    toggleExpanded: (key) => set((s) => ({ expanded: toggled(s.expanded, key) })),
    collapseAll: () => set({ expanded: new Set() }),
    toggleSelected: (pick) =>
        set((s) => {
            const selection = new Map(s.selection)
            if (selection.has(pick.key)) selection.delete(pick.key)
            else selection.set(pick.key, pick)
            return { selection }
        }),
    setSelection: (picks) => set({ selection: new Map(picks.map((p) => [p.key, p])) }),
    clearSelection: () => set({ selection: new Map() }),
    setFocused: (focused) => set({ focused }),
    expandSources: (ids) => set((s) => ({ expanded: new Set([...s.expanded, ...ids.map(sourceKey)]) })),
    resetPicks: () => set({ selection: new Map(), focused: null }),
}))

export const isFiltering = (s: Pick<BrowserState, 'query' | 'scopeTypes' | 'areas' | 'recordableOnly'>) =>
    s.query.trim() !== '' || s.scopeTypes.size > 0 || s.areas.size > 0 || s.recordableOnly
