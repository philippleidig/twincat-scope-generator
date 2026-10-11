import { useMemo } from 'react'
import { useSearch } from './useSearch'
import type { SearchIndex, SearchQuery } from '@/catalog/search'
import { templateOf } from '@/catalog/search'
import { VirtualList } from '@/ui/components/VirtualList'
import { isFiltering, useBrowserStore } from '@/state/browserStore'
import { KindIcon } from './symbolIcons'
import { entryPick, isPickable } from './picks'
import { SymbolRow } from './SymbolRow'
import { Highlight } from './Highlight'
import { highlightWords } from './highlightWords'

export type EntryListMode = 'results' | 'list'

const MODES = {
    // Search results in the tree view: best name matches first.
    results: { order: 'relevance', label: 'Search results', noun: ['match', 'matches'] },
    // The List view: every entry by path, narrowed by query and filters.
    list: { order: 'path', label: 'Symbol list', noun: ['symbol', 'symbols'] },
} satisfies Record<EntryListMode, { order: SearchQuery['order']; label: string; noun: [string, string] }>

/** Search entries as a flat, virtualised list of pickable rows. */
export function EntryList({ index, mode }: { index: SearchIndex; mode: EntryListMode }) {
    const { order, label, noun } = MODES[mode]
    const result = useSearch(index, order)
    const query = useBrowserStore((s) => s.query)
    const filtering = useBrowserStore(isFiltering)
    const words = useMemo(() => highlightWords(query), [query])

    if (result.total === 0) {
        return filtering ? (
            <div className="empty">
                <h3>No matching symbols</h3>
                <p>Try fewer words, a wildcard like <code>*ActPos</code>, or remove filters.</p>
            </div>
        ) : (
            <div className="empty">
                <h3>No symbols</h3>
                <p>The imported files declare no symbols.</p>
            </div>
        )
    }
    return (
        <>
            <div className="result-summary">{summary(result.entries.length, result.total, noun)}</div>
            <VirtualList
                items={result.entries}
                rowHeight={32}
                getKey={(e) => e.key}
                role="listbox"
                label={label}
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
                            reason={entry.reason}
                            warning={entry.warning}
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
