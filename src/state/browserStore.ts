import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AreaKind, SourceKind } from '@/catalog/model'
import type { PlcScope } from '@/catalog/search'
import type { SymbolKind } from '@/catalog/walk'
import { sourceKey } from '@/catalog/tree'
import { safeLocalStorage } from './safeStorage'

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

/** How the browser shows symbols: the hierarchical tree or a flat list of every search entry. */
export type BrowserView = 'tree' | 'list'

interface BrowserState {
    view: BrowserView
    query: string
    kinds: Set<SourceKind>
    plcScopes: Set<PlcScope>
    areas: Set<AreaKind>
    /** On by default: TwinCAT's own symbols (system lists, frame and working counter state) are left out. */
    hideSystem: boolean
    expanded: Set<string>
    selection: Map<string, BrowserPick>
    /** Row whose details the inspector shows. */
    focused: BrowserPick | null

    setView: (view: BrowserView) => void
    setQuery: (q: string) => void
    toggleKind: (k: SourceKind) => void
    togglePlcScope: (s: PlcScope) => void
    toggleArea: (a: AreaKind) => void
    setHideSystem: (v: boolean) => void
    /** Back to no query and the default filters. */
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

export const useBrowserStore = create<BrowserState>()(
    persist(
        (set) => ({
            view: 'tree',
            query: '',
            kinds: new Set(),
            plcScopes: new Set(),
            areas: new Set(),
            hideSystem: true,
            expanded: new Set(),
            selection: new Map(),
            focused: null,

            setView: (view) => set({ view }),
            setQuery: (query) => set({ query }),
            toggleKind: (k) => set((s) => ({ kinds: toggled(s.kinds, k) })),
            togglePlcScope: (p) => set((s) => ({ plcScopes: toggled(s.plcScopes, p) })),
            toggleArea: (a) => set((s) => ({ areas: toggled(s.areas, a) })),
            setHideSystem: (hideSystem) => set({ hideSystem }),
            clearFilters: () => set({ query: '', kinds: new Set(), plcScopes: new Set(), areas: new Set(), hideSystem: true }),
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
        }),
        {
            // Only the view is a preference; query, filters, expansion and selection are per session.
            name: 'twincat-scope-browser-view',
            storage: createJSONStorage(() => safeLocalStorage),
            partialize: (s) => ({ view: s.view }),
            merge: (persisted, current) => {
                const view = (persisted as { view?: unknown } | undefined)?.view
                return view === 'list' || view === 'tree' ? { ...current, view } : current
            },
        },
    ),
)

type FilterState = Pick<BrowserState, 'query' | 'kinds' | 'plcScopes' | 'areas' | 'hideSystem'>

/**
 * A query or a narrowing filter is set. Hiding system symbols is the default and does not count:
 * the tree leaves them out itself.
 */
export const isFiltering = (s: FilterState) => s.query.trim() !== '' || s.kinds.size > 0 || s.plcScopes.size > 0 || s.areas.size > 0

/** Anything differs from the defaults, so "Clear" has something to do. */
export const hasCustomFilters = (s: FilterState) => isFiltering(s) || !s.hideSystem

/** What the browser body shows: the tree, search results (tree view while filtering) or the flat list. */
export type BrowserBody = 'tree' | 'results' | 'list'

export const browserBody = (s: FilterState & Pick<BrowserState, 'view'>): BrowserBody =>
    s.view === 'list' ? 'list' : isFiltering(s) ? 'results' : 'tree'
