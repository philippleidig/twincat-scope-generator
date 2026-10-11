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

export function SearchResults({ index }: { index: SearchIndex }) {
    const result = useSearch(index)
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
            <div className="result-summary">
                {result.total > result.entries.length
                    ? `Showing ${result.entries.length.toLocaleString()} of ${result.total.toLocaleString()} matches — refine the search to see more`
                    : `${result.total.toLocaleString()} match${result.total === 1 ? '' : 'es'}`}
            </div>
            <VirtualList
                items={result.entries}
                rowHeight={32}
                getKey={(e) => e.key}
                role="listbox"
                label="Search results"
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
