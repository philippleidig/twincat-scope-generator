import { useDeferredValue, useMemo } from 'react'
import type { SearchIndex, SearchQuery } from '@/catalog/search'
import { search } from '@/catalog/search'
import { useBrowserStore } from '@/state/browserStore'

export const RESULT_LIMIT = 2000

export function useSearch(index: SearchIndex, order: SearchQuery['order'] = 'relevance') {
    // Typing stays responsive on large indexes: results catch up a frame later.
    const query = useDeferredValue(useBrowserStore((s) => s.query))
    const scopeTypes = useBrowserStore((s) => s.scopeTypes)
    const areas = useBrowserStore((s) => s.areas)
    const recordableOnly = useBrowserStore((s) => s.recordableOnly)
    return useMemo(
        () => search(index, { text: query, scopeTypes, areas, recordableOnly, order }, RESULT_LIMIT),
        [index, query, scopeTypes, areas, recordableOnly, order],
    )
}

