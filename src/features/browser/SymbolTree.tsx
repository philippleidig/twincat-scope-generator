import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { SymbolSource } from '@/catalog/model'
import type { BrowserNode } from '@/catalog/tree'
import { childrenOf, sourceChildren } from '@/catalog/tree'
import { VirtualList } from '@/ui/components/VirtualList'
import { useBrowserStore } from '@/state/browserStore'
import { KindIcon, SourceIcon } from './symbolIcons'
import { isPickable, nodePick } from './picks'
import { SymbolRow } from './SymbolRow'

type Row = { type: 'source'; key: string; source: SymbolSource } | { type: 'node'; key: string; source: SymbolSource; node: BrowserNode }

/** Children are derived from immutable sources, so they are cached per source object. */
const cache = new WeakMap<SymbolSource, Map<string, BrowserNode[]>>()
function cached(source: SymbolSource, key: string, compute: () => BrowserNode[]): BrowserNode[] {
    let perSource = cache.get(source)
    if (!perSource) cache.set(source, (perSource = new Map()))
    let list = perSource.get(key)
    if (!list) perSource.set(key, (list = compute()))
    return list
}

function visibleRows(sources: SymbolSource[], expanded: Set<string>): Row[] {
    const rows: Row[] = []
    const addNodes = (source: SymbolSource, nodes: BrowserNode[]) => {
        for (const node of nodes) {
            rows.push({ type: 'node', key: node.key, source, node })
            if (expanded.has(node.key) && node.kind !== 'scalar' && node.kind !== 'unsupported') {
                addNodes(source, cached(source, node.key, () => childrenOf(source, node)))
            }
        }
    }
    for (const source of sources) {
        const key = `source:${source.id}`
        rows.push({ type: 'source', key, source })
        if (expanded.has(key)) addNodes(source, cached(source, key, () => sourceChildren(source, 1)))
    }
    return rows
}

export function SymbolTree({ sources }: { sources: SymbolSource[] }) {
    const expanded = useBrowserStore((s) => s.expanded)
    const toggleExpanded = useBrowserStore((s) => s.toggleExpanded)
    const rows = useMemo(() => visibleRows(sources, expanded), [sources, expanded])

    return (
        <VirtualList
            items={rows}
            rowHeight={32}
            getKey={(r) => r.key}
            role="tree"
            label="Symbols"
            className="symbol-list"
            renderRow={(row) => {
                if (row.type === 'source') {
                    const open = expanded.has(row.key)
                    return (
                        <div role="treeitem" aria-expanded={open} aria-level={1} className="tree-row tree-row--source">
                            <button type="button" className="tree-toggle" onClick={() => toggleExpanded(row.key)} aria-label={`${open ? 'Collapse' : 'Expand'} ${row.source.title}`}>
                                <ChevronRight size={14} className={open ? 'chevron chevron--open' : 'chevron'} />
                            </button>
                            <SourceIcon kind={row.source.kind} />
                            <span className="tree-row__label">{row.source.title}</span>
                            <span className="badge">{row.source.roots.length}</span>
                            <span className="tree-row__meta">port {row.source.port}</span>
                        </div>
                    )
                }
                const { node, source } = row
                const expandable = node.kind === 'folder' || node.kind === 'struct' || node.kind === 'array'
                const open = expanded.has(node.key)
                return (
                    <SymbolRow
                        role="treeitem"
                        ariaExpanded={expandable ? open : undefined}
                        ariaLevel={node.depth + 1}
                        indent={node.depth}
                        pick={isPickable(node.kind) ? nodePick(source, node) : null}
                        toggle={
                            expandable ? (
                                <button type="button" className="tree-toggle" onClick={() => toggleExpanded(node.key)} aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`}>
                                    <ChevronRight size={14} className={open ? 'chevron chevron--open' : 'chevron'} />
                                </button>
                            ) : (
                                <span className="tree-toggle" />
                            )
                        }
                        icon={<KindIcon kind={node.kind} open={open} />}
                        label={node.label}
                        title={node.path}
                        typeName={node.kind === 'folder' ? undefined : node.typeName}
                        reason={node.reason}
                        area={node.area}
                        onActivate={expandable ? () => toggleExpanded(node.key) : undefined}
                    />
                )
            }}
        />
    )
}
