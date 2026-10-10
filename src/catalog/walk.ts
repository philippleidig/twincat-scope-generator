/**
 * Walking the symbols of a source: the one place that knows how a resolved type
 * expands into members and array elements. The tree, the search index and the
 * "what does adding this produce" logic are all built on it.
 */
import type { ScopeDataType } from '@/domain/dataTypes'
import type { ArrayDim, AreaKind, ResolvedType, SymbolRoot, SymbolSource } from './model'
import { resolveType } from './typeTable'

export type SymbolKind = ResolvedType['kind']

/** What the UI shows about a resolved type. */
export interface SymbolInfo {
    kind: SymbolKind
    typeName: string
    scopeType?: ScopeDataType
    /** Why an unsupported symbol cannot be recorded. */
    reason?: string
}

export function arrayLabel(dims: ArrayDim[], element: string): string {
    return `ARRAY[${dims.map((d) => `${d.lower}..${d.upper}`).join(',')}] OF ${element}`
}

export function describe(r: ResolvedType): SymbolInfo {
    switch (r.kind) {
        case 'scalar':
            return { kind: r.kind, typeName: r.typeName, scopeType: r.scopeType }
        case 'array':
            return { kind: r.kind, typeName: arrayLabel(r.dims, r.element) }
        case 'unsupported':
            return { kind: r.kind, typeName: r.typeName, reason: r.reason }
        default:
            return { kind: r.kind, typeName: r.typeName }
    }
}

export function fullPath(source: SymbolSource, name: string): string {
    return source.pathPrefix ? `${source.pathPrefix}.${name}` : name
}

const lastSegment = (path: string) => path.slice(path.lastIndexOf('.') + 1)

/** A symbol at some path below a root, with the area and port it inherits. */
export interface PathNode {
    path: string
    name: string
    resolved: ResolvedType
    area: AreaKind
    port: number
    comment?: string
    /** Ranges of the `*` wildcards in `path`, in order (empty for concrete paths). */
    ranges: ArrayDim[]
}

export function rootNode(source: SymbolSource, root: SymbolRoot): PathNode {
    const path = fullPath(source, root.name)
    return {
        path,
        name: lastSegment(path),
        resolved: resolveType(source.types, root.type, root.ns, root.dims),
        area: root.area,
        port: root.port ?? source.port,
        comment: root.comment,
        ranges: [],
    }
}

/** Struct members of a node (none for other kinds). */
export function memberNodes(source: SymbolSource, node: PathNode): PathNode[] {
    if (node.resolved.kind !== 'struct') return []
    return node.resolved.members.map((m) => ({
        path: `${node.path}.${m.name}`,
        name: m.name,
        resolved: resolveType(source.types, m.type, m.ns, m.dims),
        area: node.area,
        port: node.port,
        comment: m.comment,
        ranges: node.ranges,
    }))
}

/** Element of an array node at `index` (one value per dimension), or all elements as `*`. */
export function elementNode(source: SymbolSource, node: PathNode, index: number[] | '*'): PathNode | null {
    if (node.resolved.kind !== 'array') return null
    const { dims, element, ns } = node.resolved
    const wildcard = index === '*'
    const label = wildcard ? `[${dims.map(() => '*').join(',')}]` : `[${index.join(',')}]`
    return {
        path: `${node.path}${label}`,
        name: `${node.name}${label}`,
        resolved: resolveType(source.types, element, ns),
        area: node.area,
        port: node.port,
        ranges: wildcard ? [...node.ranges, ...dims] : node.ranges,
    }
}

export const MAX_DEPTH = 16

/**
 * Depth-first walk over a node and everything below it. Arrays are not enumerated:
 * they continue as one wildcard element (`a[*]`), so the walk stays proportional to the
 * number of distinct member paths. Struct elements are skipped in favour of their
 * members (they add nothing searchable). `stats.depthLimited` reports pruning.
 */
export function* walk(source: SymbolSource, start: PathNode, stats = { depthLimited: false }): Generator<PathNode> {
    const visit = function* (node: PathNode, depth: number, emitSelf: boolean): Generator<PathNode> {
        if (depth > MAX_DEPTH) {
            stats.depthLimited = true
            return
        }
        if (emitSelf) yield node
        if (node.resolved.kind === 'struct') {
            for (const m of memberNodes(source, node)) yield* visit(m, depth + 1, true)
        } else if (node.resolved.kind === 'array') {
            const element = elementNode(source, node, '*')!
            yield* visit(element, depth + 1, element.resolved.kind !== 'struct')
        }
    }
    yield* visit(start, 0, true)
}

// ---------------------------------------------------------------------------
// Path lookup
// ---------------------------------------------------------------------------

const SEGMENT = /\.([^.[\]]+)|\[([^\]]+)\]/gy

/**
 * Find the node for a full symbol path (`GVL.aAxis[3].fActPos`, or with wildcards
 * `GVL.aAxis[*].fActPos` whose ranges are taken from the type). Matching is
 * case-insensitive, like ADS symbol names. Returns null when the path does not exist.
 */
export function resolvePath(source: SymbolSource, path: string): PathNode | null {
    const lower = path.toLowerCase()
    // Roots can be prefixes of each other (`MAIN.fb` and `MAIN.fb.x`): take the longest match.
    let best: SymbolRoot | null = null
    let bestLength = -1
    for (const root of source.roots) {
        const rootPath = fullPath(source, root.name).toLowerCase()
        const fits = lower === rootPath || lower.startsWith(`${rootPath}.`) || lower.startsWith(`${rootPath}[`)
        if (fits && rootPath.length > bestLength) {
            best = root
            bestLength = rootPath.length
        }
    }
    if (!best) return null

    let node: PathNode | null = rootNode(source, best)
    const rest = path.slice(bestLength)
    SEGMENT.lastIndex = 0
    let consumed = 0
    for (const m of rest.matchAll(SEGMENT)) {
        consumed += m[0].length
        if (!node) return null
        if (m[1] !== undefined) {
            const name = m[1].toLowerCase()
            node = memberNodes(source, node).find((c) => c.name.toLowerCase() === name) ?? null
        } else {
            const parts = m[2].split(',').map((p) => p.trim())
            if (node.resolved.kind !== 'array' || parts.length !== node.resolved.dims.length) return null
            if (parts.every((p) => p === '*')) {
                node = elementNode(source, node, '*')
            } else {
                const index = parts.map(Number)
                const dims = node.resolved.dims
                if (index.some((v, i) => !Number.isInteger(v) || v < dims[i].lower || v > dims[i].upper)) return null
                node = elementNode(source, node, index)
            }
        }
    }
    return consumed === rest.length ? node : null
}
