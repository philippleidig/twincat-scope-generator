/**
 * Walking the symbols of a source: the one place that knows how a resolved type
 * expands into members, array elements and pointer targets. The tree, the search index and
 * the "what does adding this produce" logic are all built on it.
 */
import type { ScopeDataType } from '@/domain/dataTypes'
import { NOTE } from './access'
import type { Access, ArrayDim, AreaKind, MemberDef, ResolvedType, SymbolRoot, SymbolSource } from './model'
import type { TypeRef } from './typeTable'
import { arrayLabel, resolveDecl } from './typeTable'

export type SymbolKind = ResolvedType['kind']

/** What the UI shows about a symbol. */
export interface SymbolInfo {
    kind: SymbolKind
    typeName: string
    scopeType?: ScopeDataType
    /** Why a disabled symbol (unsupported or pointer) cannot be recorded. */
    reason?: string
    /** Caveat for a recordable symbol (via reference, TcNoSymbol 'unused'). */
    warning?: string
}

export function describe(node: PathNode): SymbolInfo {
    const r = node.resolved
    const info: SymbolInfo = { kind: r.kind, typeName: r.kind === 'array' ? arrayLabel(r.dims, r.element) : r.typeName }
    if (r.kind === 'scalar') info.scopeType = r.scopeType
    if (r.kind === 'pointer' || r.kind === 'unsupported') info.reason = r.reason
    const warnings = [node.throughReference && NOTE.viaReference, node.note].filter(Boolean)
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
    /** The path passes through a reference, here or above (no `^`; valid only while it is bound). */
    throughReference?: boolean
    /** Caveat from the declaration of this node or a parent (`TcNoSymbol 'unused'`). */
    note?: string
}

interface Decl extends TypeRef, Access {
    comment?: string
}

/** A node for `decl` at `path`, inheriting area, port, ranges, the reference flag and the note from `parent`. */
function declNode(source: SymbolSource, decl: Decl, path: string, name: string, base: Pick<PathNode, 'area' | 'port' | 'ranges'> & Partial<PathNode>): PathNode {
    const resolved = resolveDecl(source.types, decl)
    const node: PathNode = { path, name, resolved, area: base.area, port: base.port, comment: decl.comment, ranges: base.ranges }
    if (base.throughReference || resolved.viaReference) node.throughReference = true
    const note = decl.note ?? base.note
    if (note) node.note = note
    return node
}

export function rootNode(source: SymbolSource, root: SymbolRoot): PathNode {
    const path = fullPath(source, root.name)
    return declNode(source, root, path, lastSegment(path), { area: root.area, port: root.port ?? source.port, ranges: [] })
}

/** A node below `parent`. */
function childNode(source: SymbolSource, parent: PathNode, path: string, name: string, decl: Decl, ranges = parent.ranges): PathNode {
    return declNode(source, decl, path, name, { ...parent, ranges })
}

/** Struct members of a node with their declarations (none for other kinds). */
function memberEntries(source: SymbolSource, node: PathNode): Array<[MemberDef, PathNode]> {
    if (node.resolved.kind !== 'struct') return []
    return node.resolved.members.map((m) => [m, childNode(source, node, `${node.path}.${m.name}`, m.name, m)])
}

/** Struct members of a node (none for other kinds). */
export function memberNodes(source: SymbolSource, node: PathNode): PathNode[] {
    return memberEntries(source, node).map(([, n]) => n)
}

/** The pointed-to value of a pointer node: `p` → `p^` (null for other kinds). */
export function derefNode(source: SymbolSource, node: PathNode): PathNode | null {
    if (node.resolved.kind !== 'pointer') return null
    return childNode(source, node, `${node.path}^`, `${node.name}^`, { type: node.resolved.target, ns: node.resolved.ns })
}

/** Element of an array node at `index` (one value per dimension), or all elements as `*`. */
export function elementNode(source: SymbolSource, node: PathNode, index: number[] | '*'): PathNode | null {
    if (node.resolved.kind !== 'array') return null
    const { dims, element, ns } = node.resolved
    const wildcard = index === '*'
    const label = wildcard ? `[${dims.map(() => '*').join(',')}]` : `[${index.join(',')}]`
    return childNode(source, node, `${node.path}${label}`, `${node.name}${label}`, { type: element, ns }, wildcard ? [...node.ranges, ...dims] : node.ranges)
}

export const MAX_DEPTH = 16

/**
 * What the walk does with a node reached through an indirection *below* its start: a pointer's
 * target `p^`, or a member that is a reference / VAR_IN_OUT.
 * - `expand`: emit it and everything below it (default);
 * - `list`: emit it, not what is below it;
 * - `skip`: neither.
 */
export type Indirection = 'expand' | 'list' | 'skip'

export interface WalkOptions {
    pointers?: Indirection
    references?: Indirection
}

/** Where a node comes from: the declaration (member or start) plus the `[]`/`^` hops below it. */
interface Origin {
    decl: MemberDef | PathNode
    hops: string
    /** Some node above this one was reached through a followed pointer or reference. */
    below: boolean
}

/**
 * Depth-first walk over a node and everything below it. Arrays are not enumerated:
 * they continue as one wildcard element (`a[*]`), so the walk stays proportional to the
 * number of distinct member paths. Struct elements are skipped in favour of their
 * members (they add nothing searchable). Pointers continue as their `^` child.
 *
 * Indirections follow `options`. Pointers and references reached without passing another followed
 * indirection are always followed (`MAIN.m.ax1.pCfg^` and `MAIN.m.ax2.pCfg^` share a declaration
 * and both count). *Below* a followed indirection, each pointer or reference declaration (a
 * member plus the `[]`/`^` hops below it) already followed in this walk is listed, not expanded
 * again: a linked list stops after one hop and FBs pointing at each other stay linear (bounded by
 * declarations × target size). `stats.depthLimited` reports pruning by MAX_DEPTH — except below a
 * followed indirection, where cutting a chain of back pointers (a state machine's states pointing
 * at the machine) is expected and the tree goes further by hand.
 */
export function* walk(source: SymbolSource, start: PathNode, stats = { depthLimited: false }, options: WalkOptions = {}): Generator<PathNode> {
    const followed = new Map<MemberDef | PathNode, Set<string>>()
    /** Marks the declaration as followed; true if it was not before. */
    const firstTime = ({ decl, hops }: Origin) => {
        let seen = followed.get(decl)
        if (!seen) followed.set(decl, (seen = new Set()))
        if (seen.has(hops)) return false
        seen.add(hops)
        return true
    }
    const visit = function* (node: PathNode, depth: number, emitSelf: boolean, origin: Origin, via?: 'pointers' | 'references'): Generator<PathNode> {
        // Children of a node entered through an indirection are below one.
        const inside = origin.below || via !== undefined
        if (depth > MAX_DEPTH) {
            if (!inside) stats.depthLimited = true
            return
        }
        if (via) {
            const policy = options[via] ?? 'expand'
            if (policy === 'skip') return
            const first = firstTime(origin)
            if (policy === 'list' || (origin.below && !first)) {
                yield node
                return
            }
        }
        if (emitSelf) yield node
        const r = node.resolved
        if (r.kind === 'struct') {
            for (const [decl, m] of memberEntries(source, node)) {
                yield* visit(m, depth + 1, true, { decl, hops: '', below: inside }, m.resolved.viaReference ? 'references' : undefined)
            }
        } else if (r.kind === 'array') {
            const element = elementNode(source, node, '*')!
            const hop = { decl: origin.decl, hops: `${origin.hops}[]`, below: inside }
            yield* visit(element, depth + 1, element.resolved.kind !== 'struct', hop, element.resolved.viaReference ? 'references' : undefined)
        } else if (r.kind === 'pointer') {
            yield* visit(derefNode(source, node)!, depth + 1, true, { decl: origin.decl, hops: `${origin.hops}^`, below: inside }, 'pointers')
        }
    }
    yield* visit(start, 0, true, { decl: start, hops: '', below: false })
}

// ---------------------------------------------------------------------------
// Path lookup
// ---------------------------------------------------------------------------

/** Roots by lower-case full path, per source (sources are immutable). */
const rootIndex = new WeakMap<SymbolSource, Map<string, SymbolRoot>>()

function rootsByPath(source: SymbolSource): Map<string, SymbolRoot> {
    let map = rootIndex.get(source)
    if (!map) {
        // Root names are unique per source (finalizeSource).
        map = new Map(source.roots.map((root) => [fullPath(source, root.name).toLowerCase(), root]))
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

/** The member of `node` named at the start of `lower` (longest name ending at `.`, `[`, `^` or the end). */
function memberAt(source: SymbolSource, node: PathNode, lower: string): PathNode | null {
    let best: PathNode | null = null
    for (const m of memberNodes(source, node)) {
        const name = m.name.toLowerCase()
        if (!lower.startsWith(name) || (lower.length > name.length && !'.[^'.includes(lower[name.length]))) continue
        if (!best || name.length > best.name.length) best = m
    }
    return best
}

/** Element of an array node from the text between `[` and `]` (`3`, `1,2` or `*`). */
function elementAt(source: SymbolSource, node: PathNode, spec: string): PathNode | null {
    const parts = spec.split(',').map((p) => p.trim())
    if (node.resolved.kind !== 'array' || parts.length !== node.resolved.dims.length) return null
    if (parts.every((p) => p === '*')) return elementNode(source, node, '*')
    const index = parts.map(Number)
    const dims = node.resolved.dims
    if (index.some((v, i) => !Number.isInteger(v) || v < dims[i].lower || v > dims[i].upper)) return null
    return elementNode(source, node, index)
}

/**
 * Find the node for a full symbol path (`GVL.aAxis[3].fActPos`, with wildcards
 * `GVL.aAxis[*].fActPos` whose ranges are taken from the type, or through a pointer
 * `MAIN.pData^.fValue`). Matching is case-insensitive, like ADS symbol names. Member names may
 * contain dots (I/O entries such as `Current actual value Ch.1`); the longest matching member
 * wins. Returns null when the path does not exist.
 */
export function resolvePath(source: SymbolSource, path: string): PathNode | null {
    // Roots can be prefixes of each other (`MAIN.fb` and `MAIN.fb.x`): take the longest match.
    const lower = path.toLowerCase()
    const found = findRoot(source, lower)
    if (!found) return null
    let node: PathNode | null = rootNode(source, found[0])
    let pos = found[1]
    while (pos < path.length) {
        if (!node) return null
        const c = path[pos]
        if (c === '^') {
            node = derefNode(source, node)
            pos++
        } else if (c === '[') {
            const end = path.indexOf(']', pos)
            if (end === -1) return null
            node = elementAt(source, node, path.slice(pos + 1, end))
            pos = end + 1
        } else if (c === '.') {
            node = memberAt(source, node, lower.slice(pos + 1))
            if (node) pos += 1 + node.name.length
        } else {
            return null
        }
    }
    return node
}
