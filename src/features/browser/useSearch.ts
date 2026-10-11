import { useDeferredValue, useMemo } from 'react'
import type { SearchIndex, SearchQuery } from '@/catalog/search'
import { search } from '@/catalog/search'
import { useBrowserStore } from '@/state/browserStore'

export const RESULT_LIMIT = 2000

export function useSearch(index: SearchIndex, order: SearchQuery['order']) {
    // Typing stays responsive on large indexes: results catch up a frame later.
    const query = useDeferredValue(useBrowserStore((s) => s.query))
    const kinds = useBrowserStore((s) => s.kinds)
    const plcScopes = useBrowserStore((s) => s.plcScopes)
    const areas = useBrowserStore((s) => s.areas)
    const hideSystem = useBrowserStore((s) => s.hideSystem)
    return useMemo(
        () => search(index, { text: query, kinds, plcScopes, areas, hideSystem, order }, RESULT_LIMIT),
        [index, query, kinds, plcScopes, areas, hideSystem, order],
    )
}

