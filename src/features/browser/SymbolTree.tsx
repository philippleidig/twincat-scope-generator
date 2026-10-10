import { useMemo } from 'react'
import type { SymbolSource } from '@/catalog/model'
import type { BrowserNode } from '@/catalog/tree'
import { cachedChildren, childrenOf, isExpandable, sourceChildren, sourceKey } from '@/catalog/tree'
import { VirtualList } from '@/ui/components/VirtualList'
import { Disclosure } from '@/ui/components/Disclosure'
import { useBrowserStore } from '@/state/browserStore'
import { KindIcon, SourceIcon } from './symbolIcons'
import { isPickable, nodePick } from './picks'
import { SymbolRow } from './SymbolRow'

type Row =
    | { type: 'source'; key: string; source: SymbolSource }
    | { type: 'node'; key: string; node: BrowserNode }
    | { type: 'more'; key: string; depth: number; hidden: number }

function visibleRows(sources: SymbolSource[], expanded: Set<string>): Row[] {
    const rows: Row[] = []
    const addNodes = (source: SymbolSource, nodes: BrowserNode[], total?: number) => {
        for (const node of nodes) {
            rows.push({ type: 'node', key: node.key, node })
            if (expanded.has(node.key) && isExpandable(node)) {
                const children = cachedChildren(source, node.key, () => childrenOf(source, node))
                addNodes(source, children, node.kind === 'array' ? arrayElementCount(node) : undefined)
            }
        }
        if (total !== undefined && total > nodes.length) {
            rows.push({ type: 'more', key: `${nodes[0]?.key}…more`, depth: nodes[0]?.depth ?? 0, hidden: total - nodes.length })
        }
    }
    for (const source of sources) {
        const key = sourceKey(source.id)
        rows.push({ type: 'source', key, source })
        if (expanded.has(key)) addNodes(source, cachedChildren(source, key, () => sourceChildren(source, 1)))
    }
    return rows
}

function arrayElementCount(node: BrowserNode): number | undefined {
    if (node.kind !== 'array' || node.symbol.resolved.kind !== 'array') return undefined
    return node.symbol.resolved.dims.reduce((n, d) => n * (d.upper - d.lower + 1), 1)
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
                if (row.type === 'more') {
                    return (
                        <div className="tree-row tree-row--muted tree-row--more" style={{ paddingLeft: 8 + row.depth * 16 + 46 }}>
                            … {row.hidden.toLocaleString()} more elements — search adds the whole array as a pattern
                        </div>
                    )
                }
                if (row.type === 'source') {
                    const open = expanded.has(row.key)
                    return (
                        <div role="treeitem" aria-expanded={open} aria-level={1} className="tree-row tree-row--source">
                            <Disclosure open={open} label={row.source.title} onToggle={() => toggleExpanded(row.key)} />
                            <SourceIcon kind={row.source.kind} />
                            <span className="tree-row__label">{row.source.title}</span>
                            <span className="badge">{row.source.roots.length}</span>
                            <span className="tree-row__meta">port {row.source.port}</span>
                        </div>
                    )
                }
                const { node } = row
                const expandable = isExpandable(node)
                const open = expanded.has(node.key)
                const symbol = node.kind === 'folder' ? null : node
                return (
                    <SymbolRow
                        role="treeitem"
                        ariaExpanded={expandable ? open : undefined}
                        ariaLevel={node.depth + 1}
                        indent={node.depth}
                        pick={symbol && isPickable(symbol.kind) ? nodePick(symbol) : null}
                        toggle={expandable ? <Disclosure open={open} label={node.label} onToggle={() => toggleExpanded(node.key)} /> : <span className="disclosure" />}
                        icon={<KindIcon kind={node.kind} open={open} />}
                        label={node.label}
                        title={node.kind === 'folder' ? node.path : node.symbol.path}
                        typeName={symbol?.typeName}
                        reason={symbol?.reason}
                        area={symbol?.symbol.area}
                        onActivate={expandable ? () => toggleExpanded(node.key) : undefined}
                    />
                )
            }}
        />
    )
}
