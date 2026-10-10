/**
 * Search over every symbol path a source can produce, including struct members.
 *
 * Array elements are not enumerated: an array contributes one wildcard path
 * (`MAIN.aAxis[*].fPos`) together with its index ranges, which keeps the index
 * proportional to the number of *distinct* member paths, independent of array
 * sizes, and maps directly onto a counter template when added to the project.
 */
import type { ScopeDataType } from '@/domain/dataTypes'
import { wildcardsToTemplate } from '@/domain/pattern'
import type { AreaKind, MemberDef, ResolvedType, SymbolSource } from './model'
import { resolveType } from './typeTable'
import { arrayLabel, fullPath } from './tree'

export interface IndexRange {
    lower: number
    upper: number
}

export interface SearchEntry {
    /** Unique within the index. */
    key: string
    sourceId: string
    /** Path with `*` for every array index. */
    path: string
    /** Last segment, for display and ranking. */
    name: string
    kind: 'struct' | 'array' | 'scalar' | 'unsupported'
    typeName: string
    scopeType?: ScopeDataType
    area: AreaKind
    port: number
    comment?: string
    /** One range per `*` in `path`, in order. */
    ranges: IndexRange[]
    /** Lower-cased path, precomputed for matching. */
    haystack: string
}

export interface SearchIndex {
    entries: SearchEntry[]
    /** True when the index stopped at MAX_ENTRIES or MAX_DEPTH and is incomplete. */
    truncated: boolean
}

export const MAX_ENTRIES = 250_000
export const MAX_DEPTH = 16

interface WalkStart {
    path: string
    name: string
    resolved: ResolvedType
    area: AreaKind
    port: number
    comment?: string
    ranges?: IndexRange[]
}

/**
 * Visit a symbol and everything below it, emitting one entry per node.
 * Returns false once `limit` entries exist (the walk stops early).
 */
function walk(source: SymbolSource, start: WalkStart, out: SearchEntry[], seen: Set<string>, limit: number): boolean {
    let complete = true
    const emit = (path: string, name: string, resolved: ResolvedType, ranges: IndexRange[], depth: number, comment?: string) => {
        if (out.length >= limit || depth > MAX_DEPTH) {
            complete = false
            return
        }
        // The same path can be reachable twice (a struct root and its separately declared member).
        const key = `${source.id}|${path}`
        if (seen.has(key)) return
        seen.add(key)
        out.push({
            key,
            sourceId: source.id,
            path,
            name,
            kind: resolved.kind,
            typeName: resolved.kind === 'array' ? arrayLabel(resolved.dims, resolved.element) : resolved.typeName,
            scopeType: resolved.kind === 'scalar' ? resolved.scopeType : undefined,
            area: start.area,
            port: start.port,
            comment,
            ranges,
            haystack: path.toLowerCase(),
        })
        below(path, name, resolved, ranges, depth)
    }
    const member = (parent: string, m: MemberDef, ranges: IndexRange[], depth: number) =>
        emit(`${parent}.${m.name}`, m.name, resolveType(source.types, m.type, m.ns, m.dims), ranges, depth + 1, m.comment)
    const below = (path: string, name: string, resolved: ResolvedType, ranges: IndexRange[], depth: number) => {
        if (resolved.kind === 'struct') {
            for (const m of resolved.members) member(path, m, ranges, depth)
        } else if (resolved.kind === 'array') {
            const wildcard = `[${resolved.dims.map(() => '*').join(',')}]`
            const element = resolveType(source.types, resolved.element, resolved.ns)
            const inner = [...ranges, ...resolved.dims.map((d) => ({ lower: d.lower, upper: d.lower + d.length - 1 }))]
            // A struct element adds nothing searchable beyond its members, so skip straight to them.
            if (element.kind === 'struct') below(`${path}${wildcard}`, name, element, inner, depth + 1)
            else emit(`${path}${wildcard}`, `${name}${wildcard}`, element, inner, depth + 1)
        }
    }
    emit(start.path, start.name, start.resolved, start.ranges ?? [], 0, start.comment)
    return complete
}

const lastSegment = (path: string) => path.slice(path.lastIndexOf('.') + 1)

export function buildIndex(sources: SymbolSource[]): SearchIndex {
    const entries: SearchEntry[] = []
    const seen = new Set<string>()
    let truncated = false
    for (const source of sources) {
        for (const root of source.roots) {
            const path = fullPath(source, root.name)
            const complete = walk(
                source,
                {
                    path,
                    name: lastSegment(path),
                    resolved: resolveType(source.types, root.type, root.ns, root.dims),
                    area: root.area,
                    port: root.port ?? source.port,
                    comment: root.comment,
                },
                entries,
                seen,
                MAX_ENTRIES,
            )
            truncated ||= !complete
        }
    }
    return { entries, truncated }
}

export interface ChannelCandidate {
    template: string
    scopeType: ScopeDataType
    port: number
}

/** Upper bound of channels a single "add" may create, so adding a huge FB stays deliberate. */
export const MAX_CANDIDATES = 2_000

/**
 * The recordable channels below a symbol (the symbol itself if it is a scalar):
 * every scalar leaf, with array indices turned into counters.
 */
export function channelCandidates(source: SymbolSource, start: WalkStart): { candidates: ChannelCandidate[]; truncated: boolean } {
    const entries: SearchEntry[] = []
    const complete = walk(source, start, entries, new Set(), MAX_ENTRIES)
    const scalars = entries.filter((e) => e.kind === 'scalar')
    return {
        candidates: scalars.slice(0, MAX_CANDIDATES).map((e) => ({ template: entryTemplate(e), scopeType: e.scopeType!, port: e.port })),
        truncated: !complete || scalars.length > MAX_CANDIDATES,
    }
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export interface SearchQuery {
    text: string
    scopeTypes?: ReadonlySet<ScopeDataType>
    areas?: ReadonlySet<AreaKind>
    sourceIds?: ReadonlySet<string>
    /** Only entries that can become channels directly (scalars). */
    recordableOnly?: boolean
}

export interface SearchResult {
    entries: SearchEntry[]
    total: number
}

interface Term {
    test: (e: SearchEntry) => boolean
}

function globToRegExp(glob: string): RegExp {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
    return new RegExp(`^${escaped}$`, 'i')
}

/**
 * Parse the free-text part of a query. Plain words must all appear somewhere in the
 * path; a word with `*` or `?` is a glob over the whole path (`*.fActPos`,
 * `MAIN.*Axis*`); `type:`, `area:` and `port:` filter by field.
 */
export function parseTerms(text: string): Term[] {
    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word): Term => {
            const field = /^(type|area|port):(.+)$/i.exec(word)
            if (field) {
                const value = field[2].toLowerCase()
                switch (field[1].toLowerCase()) {
                    case 'type':
                        return { test: (e) => e.typeName.toLowerCase().includes(value) || e.scopeType?.toLowerCase() === value }
                    case 'area':
                        return { test: (e) => e.area.startsWith(value) }
                    default:
                        return { test: (e) => String(e.port) === value }
                }
            }
            if (/[*?]/.test(word)) {
                const re = globToRegExp(word)
                return { test: (e) => re.test(e.path) }
            }
            const lower = word.toLowerCase()
            return { test: (e) => e.haystack.includes(lower) }
        })
}

function rank(e: SearchEntry, firstWord: string): number {
    const name = e.name.toLowerCase()
    if (name === firstWord) return 0
    if (name.startsWith(firstWord)) return 1
    if (name.includes(firstWord)) return 2
    return 3
}

export function search(index: SearchIndex, query: SearchQuery, limit = 500): SearchResult {
    const terms = parseTerms(query.text)
    const firstWord = query.text.trim().split(/\s+/).find((w) => !w.includes(':'))?.toLowerCase() ?? ''
    const matches = index.entries.filter(
        (e) =>
            (!query.recordableOnly || e.kind === 'scalar') &&
            (!query.scopeTypes?.size || (e.scopeType !== undefined && query.scopeTypes.has(e.scopeType))) &&
            (!query.areas?.size || query.areas.has(e.area)) &&
            (!query.sourceIds?.size || query.sourceIds.has(e.sourceId)) &&
            terms.every((t) => t.test(e)),
    )
    if (firstWord) {
        matches.sort((a, b) => rank(a, firstWord) - rank(b, firstWord) || a.path.length - b.path.length)
    }
    return { entries: matches.slice(0, limit), total: matches.length }
}

/** The channel template for an entry: wildcards become counters. */
export function entryTemplate(entry: Pick<SearchEntry, 'path' | 'ranges'>): string {
    return wildcardsToTemplate(entry.path, entry.ranges)
}
