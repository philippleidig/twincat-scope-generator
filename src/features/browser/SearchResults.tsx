import { useMemo } from 'react'
import { useSearch } from './useSearch'
import type { SearchIndex } from '@/catalog/search'
import { templateOf } from '@/catalog/search'
import { VirtualList } from '@/ui/components/VirtualList'
import { useBrowserStore } from '@/state/browserStore'
import { KindIcon } from './symbolIcons'
import { entryPick, isPickable } from './picks'
import { SymbolRow } from './SymbolRow'
import { Highlight } from './Highlight'
import { highlightWords } from './highlightWords'

/**
 * Search entries as a flat, virtualised list. `results` mode shows search hits ranked by
 * relevance; `list` mode is the browser's List view: every entry sorted by path, narrowed by
 * the same query and filters.
 */
export function SearchResults({ index, mode = 'results' }: { index: SearchIndex; mode?: 'results' | 'list' }) {
    const list = mode === 'list'
    const result = useSearch(index, list ? 'path' : 'relevance')
    const query = useBrowserStore((s) => s.query)
    const words = useMemo(() => highlightWords(query), [query])

    if (result.total === 0) {
        return (
            <div className="empty">
                <h3>No matching symbols</h3>
                <p>Try fewer words, a wildcard like <code>*ActPos</code>, or remove filters.</p>
            </div>
        )
    }
    return (
        <>
            <div className="result-summary">{summary(result.entries.length, result.total, list ? ['symbol', 'symbols'] : ['match', 'matches'])}</div>
            <VirtualList
                items={result.entries}
                rowHeight={32}
                getKey={(e) => e.key}
                role="listbox"
                label={list ? 'Symbol list' : 'Search results'}
                className="symbol-list"
                renderRow={(entry) => {
                    const template = templateOf(entry)
                    return (
                        <SymbolRow
                            role="option"
                            indent={0}
                            pick={isPickable(entry.kind) ? entryPick(entry) : null}
                            icon={<KindIcon kind={entry.kind} />}
                            label={<Highlight text={entry.path} words={words} />}
                            title={template}
                            typeName={entry.typeName}
                            area={entry.area}
                            port={entry.port}
                            extra={
                                entry.ranges.length > 0 ? (
                                    <span className="badge badge--accent" title={`Added as pattern ${template}`}>
                                        ×{entry.ranges.reduce((n, r) => n * (r.upper - r.lower + 1), 1).toLocaleString()}
                                    </span>
                                ) : undefined
                            }
                        />
                    )
                }}
            />
        </>
    )
}

function summary(shown: number, total: number, [one, many]: [string, string]): string {
    if (total > shown) return `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} ${many} — refine the search to see more`
    return `${total.toLocaleString()} ${total === 1 ? one : many}`
}
