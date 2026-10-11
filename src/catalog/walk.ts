/**
 * Walking the symbols of a source: the one place that knows how a resolved type
 * expands into members and array elements. The tree, the search index and the
 * "what does adding this produce" logic are all built on it.
 */
import type { ScopeDataType } from '@/domain/dataTypes'
import type { Access, ArrayDim, AreaKind, ResolvedType, SymbolRoot, SymbolSource } from './model'
import { NOTE, arrayLabel, resolveType } from './typeTable'

export { arrayLabel }

/** Kinds the walker emits (`hidden` types are dropped before that). */
export type SymbolKind = Exclude<ResolvedType['kind'], 'hidden'>

/** What the UI shows about a symbol. */
export interface SymbolInfo {
    kind: SymbolKind
    typeName: string
    scopeType?: ScopeDataType
    /** Why a disabled symbol (unsupported or pointer) cannot be recorded. */
    reason?: string
    /** Reached through a reference (VAR_IN_OUT, REFERENCE TO): recordable while bound. */
    viaReference?: boolean
    /** Caveat for a recordable symbol (via reference, TcNoSymbol 'unused'). */
    warning?: string
}

function describeType(r: ResolvedType): SymbolInfo {
    switch (r.kind) {
        case 'scalar':
            return { kind: r.kind, typeName: r.typeName, scopeType: r.scopeType }
        case 'array':
            return { kind: r.kind, typeName: arrayLabel(r.dims, r.element) }
        case 'pointer':
        case 'unsupported':
        case 'hidden':
            return { kind: r.kind === 'hidden' ? 'unsupported' : r.kind, typeName: r.typeName, reason: r.reason }
        default:
            return { kind: r.kind, typeName: r.typeName }
    }
}

export function describe(node: PathNode): SymbolInfo {
    const info = describeType(node.resolved)
    if (node.viaReference) info.viaReference = true
    const warnings = [node.viaReference && NOTE.viaReference, node.note].filter(Boolean)
    if (warnings.length > 0) info.warning = warnings.join(' · ')
    return info
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
    /** The path passes through a reference (no `^`; valid only while the reference is bound). */
    viaReference?: boolean
    /** Caveat from the declaration of this node or a parent (`TcNoSymbol 'unused'`). */
    note?: string
}

/** Apply what the declaration says (property, static, `conditionalshow`, note) to its type. */
function withAccess(resolved: ResolvedType, access: Access): ResolvedType {
    if (resolved.kind === 'hidden') return resolved
    if (access.disabled) return { kind: 'unsupported', typeName: resolved.typeName, reason: access.disabled }
    return access.note ? { ...resolved, note: access.note } : resolved
}

export function rootNode(source: SymbolSource, root: SymbolRoot): PathNode {
    const path = fullPath(source, root.name)
    const resolved = withAccess(resolveType(source.types, root.type, root.ns, root.dims), root)
    const node: PathNode = { path, name: lastSegment(path), resolved, area: root.area, port: root.port ?? source.port, comment: root.comment, ranges: [] }
    if (resolved.viaReference) node.viaReference = true
    if (resolved.note) node.note = resolved.note
    return node
}

/** A node below `parent`, inheriting area, port, ranges and the reference flag. */
function childNode(parent: PathNode, path: string, name: string, resolved: ResolvedType, ranges = parent.ranges, comment?: string): PathNode {
    const node: PathNode = { path, name, resolved, area: parent.area, port: parent.port, comment, ranges }
    if (parent.viaReference || resolved.viaReference) node.viaReference = true
    const note = resolved.note ?? parent.note
    if (note) node.note = note
    return node
}

/** Struct members of a node (none for other kinds); members without an ADS symbol are dropped. */
export function memberNodes(source: SymbolSource, node: PathNode): PathNode[] {
    if (node.resolved.kind !== 'struct') return []
    const out: PathNode[] = []
    for (const m of node.resolved.members) {
        const resolved = withAccess(resolveType(source.types, m.type, m.ns, m.dims), m)
        if (resolved.kind !== 'hidden') out.push(childNode(node, `${node.path}.${m.name}`, m.name, resolved, node.ranges, m.comment))
    }
    return out
}

/** The pointed-to value of a pointer node: `p` → `p^` (null for other kinds). */
export function derefNode(source: SymbolSource, node: PathNode): PathNode | null {
    if (node.resolved.kind !== 'pointer') return null
    return childNode(node, `${node.path}^`, `${node.name}^`, resolveType(source.types, node.resolved.target, node.resolved.ns))
}

/** Element of an array node at `index` (one value per dimension), or all elements as `*`. */
export function elementNode(source: SymbolSource, node: PathNode, index: number[] | '*'): PathNode | null {
    if (node.resolved.kind !== 'array') return null
    const { dims, element, ns } = node.resolved
    const wildcard = index === '*'
    const label = wildcard ? `[${dims.map(() => '*').join(',')}]` : `[${index.join(',')}]`
    return childNode(node, `${node.path}${label}`, `${node.name}${label}`, resolveType(source.types, element, ns), wildcard ? [...node.ranges, ...dims] : node.ranges)
}

export const MAX_DEPTH = 16

export interface WalkOptions {
    /**
     * Continue through pointers (`p^`) and references found *below* the start node (default true).
     * Off for "Add": adding an FB should not pull in everything its pointers and VAR_IN_OUTs
     * reach; the user adds `p^` or the reference itself for that.
     */
    indirection?: boolean
    /**
     * Expand what a reference / VAR_IN_OUT points to (default true). Off for the search index: the
     * reference member is listed, its target is found under its real symbol (an MC function
     * block's `Axis` would otherwise repeat the whole AXIS_REF); the tree and "Add" expand it.
     */
    references?: boolean
}

/** A node entered through a pointer or a reference, keyed by the type it leads to. */
function indirectionKey(node: PathNode): string | null {
    if (node.path.endsWith('^') || node.resolved.viaReference) return node.resolved.typeName.toUpperCase()
    return null
}

/**
 * Depth-first walk over a node and everything below it. Arrays are not enumerated:
 * they continue as one wildcard element (`a[*]`), so the walk stays proportional to the
 * number of distinct member paths. Struct elements are skipped in favour of their
 * members (they add nothing searchable). Pointers continue as their `^` child. A pointer or
 * reference leading to a type already entered that way further up is listed but not expanded
 * again (linked lists, back references). `stats.depthLimited` reports pruning.
 */
export function* walk(source: SymbolSource, start: PathNode, stats = { depthLimited: false }, options: WalkOptions = {}): Generator<PathNode> {
    const indirection = options.indirection ?? true
    const references = options.references ?? true
    const visit = function* (node: PathNode, depth: number, emitSelf: boolean, entered: string[]): Generator<PathNode> {
        if (depth > MAX_DEPTH) {
            stats.depthLimited = true
            return
        }
        if (node.resolved.kind === 'hidden') return
        if (!references && node.resolved.viaReference) {
            yield node
            return
        }
        let path = entered
        if (depth > 0) {
            const key = indirectionKey(node)
            if (key !== null) {
                if (!indirection) return
                if (entered.includes(key)) {
                    yield node
                    return
                }
                path = [...entered, key]
            }
        }
        if (emitSelf) yield node
        const r = node.resolved
        if (r.kind === 'struct') {
            for (const m of memberNodes(source, node)) yield* visit(m, depth + 1, true, path)
        } else if (r.kind === 'array') {
            const element = elementNode(source, node, '*')!
            yield* visit(element, depth + 1, element.resolved.kind !== 'struct', path)
        } else if (r.kind === 'pointer') {
            yield* visit(derefNode(source, node)!, depth + 1, true, path)
        }
    }
    yield* visit(start, 0, true, [])
}

// ---------------------------------------------------------------------------
// Path lookup
// ---------------------------------------------------------------------------

const SEGMENT = /\.([^.[\]^]+)|\[([^\]]+)\]|(\^)/gy

/** Roots by lower-case full path, per source (sources are immutable). */
const rootIndex = new WeakMap<SymbolSource, Map<string, SymbolRoot>>()

function rootsByPath(source: SymbolSource): Map<string, SymbolRoot> {
    let map = rootIndex.get(source)
    if (!map) {
        map = new Map()
        // First declaration wins, like the tree and the search index.
        for (const root of source.roots) {
            const key = fullPath(source, root.name).toLowerCase()
            if (!map.has(key)) map.set(key, root)
        }
        rootIndex.set(source, map)
    }
    return map
}

/** The longest root whose path is `lower` or a prefix of it ending at `.`, `[` or `^`. */
function findRoot(source: SymbolSource, lower: string): [SymbolRoot, number] | null {
    const roots = rootsByPath(source)
    for (let end = lower.length; end > 0; end--) {
        if (end < lower.length && !'.[^'.includes(lower[end])) continue
        const root = roots.get(lower.slice(0, end))
        if (root) return [root, end]
    }
    return null
}

/**
 * Find the node for a full symbol path (`GVL.aAxis[3].fActPos`, with wildcards
 * `GVL.aAxis[*].fActPos` whose ranges are taken from the type, or through a pointer
 * `MAIN.pData^.fValue`). Matching is case-insensitive, like ADS symbol names. Returns null
 * when the path does not exist or has no ADS symbol.
 */
export function resolvePath(source: SymbolSource, path: string): PathNode | null {
    // Roots can be prefixes of each other (`MAIN.fb` and `MAIN.fb.x`): take the longest match.
    const found = findRoot(source, path.toLowerCase())
    if (!found) return null
    let node: PathNode | null = rootNode(source, found[0])
    if (node.resolved.kind === 'hidden') return null
    const rest = path.slice(found[1])
    SEGMENT.lastIndex = 0
    let consumed = 0
    for (const m of rest.matchAll(SEGMENT)) {
        consumed += m[0].length
        if (!node) return null
        if (m[3] !== undefined) {
            node = derefNode(source, node)
        } else if (m[1] !== undefined) {
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
        if (node?.resolved.kind === 'hidden') return null
    }
    return consumed === rest.length ? node : null
}
