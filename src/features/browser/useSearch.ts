import { useMemo } from 'react'
import type { SearchIndex } from '@/catalog/search'
import { search } from '@/catalog/search'
import { useBrowserStore } from '@/state/browserStore'

export const RESULT_LIMIT = 2000

export function useSearch(index: SearchIndex) {
    const query = useBrowserStore((s) => s.query)
    const scopeTypes = useBrowserStore((s) => s.scopeTypes)
    const areas = useBrowserStore((s) => s.areas)
    const recordableOnly = useBrowserStore((s) => s.recordableOnly)
    return useMemo(
        () => search(index, { text: query, scopeTypes, areas, recordableOnly }, RESULT_LIMIT),
        [index, query, scopeTypes, areas, recordableOnly],
    )
}

