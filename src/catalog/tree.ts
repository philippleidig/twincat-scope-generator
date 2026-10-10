/**
 * Lazily expanded symbol tree for the browser, plus the walk that turns a node into
 * the channels it stands for.
 */
import type { ScopeDataType } from '@/domain/dataTypes'
import type { ArrayDim, AreaKind, ResolvedType, SymbolRoot, SymbolSource } from './model'
import { resolveType } from './typeTable'

export type NodeKind = 'folder' | 'struct' | 'array' | 'scalar' | 'unsupported'

export interface BrowserNode {
    /** Unique across all sources. */
    key: string
    sourceId: string
    label: string
    /** Full ADS symbol path; for folders the path prefix they group. */
    path: string
    kind: NodeKind
    depth: number
    typeName?: string
    scopeType?: ScopeDataType
    /** Why an unsupported node cannot be recorded. */
    reason?: string
    area?: AreaKind
    comment?: string
    port: number
    /** Resolved type for struct/array nodes (what `childrenOf` expands). */
    resolved?: ResolvedType
    /** Folder contents. */
    roots?: SymbolRoot[]
}

/** Arrays with more elements than this are shown truncated in the tree (search covers them as patterns). */
export const MAX_ARRAY_CHILDREN = 1000

export function fullPath(source: SymbolSource, name: string): string {
    return source.pathPrefix ? `${source.pathPrefix}.${name}` : name
}

const kindOf = (r: ResolvedType): NodeKind => r.kind

function typedNode(
    source: SymbolSource,
    resolved: ResolvedType,
    base: Omit<BrowserNode, 'kind' | 'key' | 'sourceId' | 'typeName' | 'port'> & { port?: number },
): BrowserNode {
    return {
        ...base,
        key: `${source.id}|${base.path}`,
        sourceId: source.id,
        kind: kindOf(resolved),
        port: base.port ?? source.port,
        typeName: resolved.kind === 'array' ? arrayLabel(resolved.dims, resolved.element) : resolved.typeName,
        scopeType: resolved.kind === 'scalar' ? resolved.scopeType : undefined,
        reason: resolved.kind === 'unsupported' ? resolved.reason : undefined,
        resolved: resolved.kind === 'struct' || resolved.kind === 'array' ? resolved : undefined,
    }
}

export function arrayLabel(dims: ArrayDim[], element: string): string {
    const range = dims.map((d) => `${d.lower}..${d.lower + d.length - 1}`).join(',')
    return `ARRAY[${range}] OF ${element}`
}

function rootNode(source: SymbolSource, root: SymbolRoot, label: string, depth: number): BrowserNode {
    return typedNode(source, resolveType(source.types, root.type, root.ns, root.dims), {
        label,
        path: fullPath(source, root.name),
        depth,
        area: root.area,
        comment: root.comment,
        port: root.port,
    })
}

/** Top level of a source: roots grouped by their first path segment (`MAIN`, `GVL`, `Inputs`, ...). */
export function sourceChildren(source: SymbolSource, depth = 0): BrowserNode[] {
    const folders = new Map<string, SymbolRoot[]>()
    const loose: BrowserNode[] = []
    for (const root of source.roots) {
        const dot = root.name.indexOf('.')
        if (dot === -1) {
            loose.push(rootNode(source, root, root.name, depth))
            continue
        }
        const folder = root.name.slice(0, dot)
        if (!folders.has(folder)) folders.set(folder, [])
        folders.get(folder)!.push(root)
    }
    const folderNodes: BrowserNode[] = [...folders].map(([name, roots]) => ({
        key: `${source.id}|${fullPath(source, name)}/`,
        sourceId: source.id,
        label: name,
        path: fullPath(source, name),
        kind: 'folder',
        depth,
        port: source.port,
        roots,
    }))
    return [...folderNodes, ...loose]
}

function* indexTuples(dims: ArrayDim[]): Generator<number[]> {
    const idx = dims.map((d) => d.lower)
    const total = dims.reduce((n, d) => n * d.length, 1)
    for (let n = 0; n < total; n++) {
        yield [...idx]
        for (let k = dims.length - 1; k >= 0; k--) {
            if (++idx[k] < dims[k].lower + dims[k].length) break
            idx[k] = dims[k].lower
        }
    }
}

/** Children of an expandable node, computed on demand. */
export function childrenOf(source: SymbolSource, node: BrowserNode): BrowserNode[] {
    const depth = node.depth + 1
    if (node.kind === 'folder') {
        const prefixLength = node.label.length + 1
        return (node.roots ?? []).map((r) => rootNode(source, r, r.name.slice(prefixLength), depth))
    }
    const resolved = node.resolved
    if (resolved?.kind === 'struct') {
        return resolved.members.map((m) =>
            typedNode(source, resolveType(source.types, m.type, m.ns, m.dims), {
                label: m.name,
                path: `${node.path}.${m.name}`,
                depth,
                area: node.area,
                comment: m.comment,
                port: node.port,
            }),
        )
    }
    if (resolved?.kind === 'array') {
        const element = resolveType(source.types, resolved.element, resolved.ns)
        const out: BrowserNode[] = []
        for (const tuple of indexTuples(resolved.dims)) {
            if (out.length >= MAX_ARRAY_CHILDREN) break
            const index = `[${tuple.join(',')}]`
            out.push(
                typedNode(source, element, { label: index, path: `${node.path}${index}`, depth, area: node.area, port: node.port }),
            )
        }
        return out
    }
    return []
}

export function elementCount(dims: ArrayDim[]): number {
    return dims.reduce((n, d) => n * d.length, 1)
}
