/**
 * Lazily expanded symbol tree for the browser: sources → folders (`MAIN`, `GVL`, …)
 * → symbols → members → array elements with concrete indices.
 */
import type { SymbolRoot, SymbolSource } from './model'
import type { PathNode, SymbolInfo } from './walk'
import { derefNode, describe, elementNode, fullPath, memberNodes, rootNode } from './walk'

interface NodeBase {
    /** Unique across all sources. */
    key: string
    sourceId: string
    label: string
    depth: number
}

/** Roots sharing a leading path (`MAIN`, `GVL`, `Axes.Axis 1`, a TcCOM data area). */
export interface FolderNode extends NodeBase {
    kind: 'folder'
    path: string
    /** Shared root-name prefix, relative to the source's path prefix. */
    prefix: string
    roots: SymbolRoot[]
}

export interface SymbolNode extends NodeBase, SymbolInfo {
    symbol: PathNode
}

export type BrowserNode = FolderNode | SymbolNode

/** Arrays with more elements than this are truncated in the tree (search covers them as patterns). */
export const MAX_ARRAY_CHILDREN = 1000

export const sourceKey = (sourceId: string) => `source:${sourceId}`

/** Folders, structs, arrays and pointers (whose one child is the target `^`). */
export const isExpandable = (node: BrowserNode) => node.kind === 'folder' || node.kind === 'struct' || node.kind === 'array' || node.kind === 'pointer'

function symbolNode(source: SymbolSource, symbol: PathNode, label: string, depth: number): SymbolNode {
    return { key: `${source.id}|${symbol.path}`, sourceId: source.id, label, depth, symbol, ...describe(symbol) }
}

/**
 * Children of a folder level: roots below `prefix` (relative root name, '' at the top) grouped
 * by their next dotted segment, so `Axes.Axis 1.ActPos` shows as Axes › Axis 1 › ActPos.
 * A root that is also the parent of other roots (`MAIN.fb` and `MAIN.fb.x`) is shown once,
 * as the symbol; its members already cover the rest.
 */
function folderChildren(source: SymbolSource, prefix: string, roots: SymbolRoot[], depth: number): BrowserNode[] {
    const start = prefix ? prefix.length + 1 : 0
    const groups = new Map<string, SymbolRoot[]>()
    const symbols = new Map<string, SymbolRoot>()
    for (const root of roots) {
        const rest = root.name.slice(start)
        const dot = rest.indexOf('.')
        const segment = dot === -1 ? rest : rest.slice(0, dot)
        if (dot === -1) symbols.set(segment, root)
        else groups.set(segment, [...(groups.get(segment) ?? []), root])
    }
    const folders: BrowserNode[] = []
    for (const [segment, members] of groups) {
        if (symbols.has(segment)) continue
        const name = prefix ? `${prefix}.${segment}` : segment
        folders.push({ key: `${source.id}|${fullPath(source, name)}/`, sourceId: source.id, label: segment, path: fullPath(source, name), kind: 'folder', depth, prefix: name, roots: members })
    }
    const leaves = [...symbols].map(([segment, root]) => symbolNode(source, rootNode(source, root), segment, depth))
    return [...folders, ...leaves]
}

const withoutSystem = new WeakMap<SymbolSource, SymbolSource>()

/**
 * The source without its system roots (`SymbolRoot.system`) — the same object for the same input,
 * so cached children stay valid while the filter is toggled.
 */
export function withoutSystemRoots(source: SymbolSource): SymbolSource {
    if (!source.roots.some((r) => r.system)) return source
    let filtered = withoutSystem.get(source)
    if (!filtered) withoutSystem.set(source, (filtered = { ...source, roots: source.roots.filter((r) => !r.system) }))
    return filtered
}

/** Top level of a source. */
export function sourceChildren(source: SymbolSource, depth = 0): BrowserNode[] {
    return folderChildren(source, '', source.roots, depth)
}

function* indexTuples(dims: Array<{ lower: number; upper: number }>): Generator<number[]> {
    const idx = dims.map((d) => d.lower)
    const total = dims.reduce((n, d) => n * (d.upper - d.lower + 1), 1)
    for (let n = 0; n < total; n++) {
        yield [...idx]
        for (let k = dims.length - 1; k >= 0; k--) {
            if (++idx[k] <= dims[k].upper) break
            idx[k] = dims[k].lower
        }
    }
}

/** Children of an expandable node, computed on demand. */
export function childrenOf(source: SymbolSource, node: BrowserNode): BrowserNode[] {
    const depth = node.depth + 1
    if (node.kind === 'folder') return folderChildren(source, node.prefix, node.roots, depth)
    const { symbol } = node
    if (symbol.resolved.kind === 'struct') {
        return memberNodes(source, symbol).map((m) => symbolNode(source, m, m.name, depth))
    }
    if (symbol.resolved.kind === 'array') {
        const out: BrowserNode[] = []
        for (const index of indexTuples(symbol.resolved.dims)) {
            if (out.length >= MAX_ARRAY_CHILDREN) break
            out.push(symbolNode(source, elementNode(source, symbol, index)!, `[${index.join(',')}]`, depth))
        }
        return out
    }
    const target = derefNode(source, symbol)
    return target ? [symbolNode(source, target, '^', depth)] : []
}

/** Children per node key, cached per source object (sources are immutable). */
const cache = new WeakMap<SymbolSource, Map<string, BrowserNode[]>>()

export function cachedChildren(source: SymbolSource, key: string, compute: () => BrowserNode[]): BrowserNode[] {
    let perSource = cache.get(source)
    if (!perSource) cache.set(source, (perSource = new Map()))
    let list = perSource.get(key)
    if (!list) perSource.set(key, (list = compute()))
    return list
}
