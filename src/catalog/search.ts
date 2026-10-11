/**
 * Search over every symbol path a source can produce, including struct members.
 *
 * Array elements are not enumerated: an array contributes one wildcard path
 * (`MAIN.aAxis[*].fPos`) together with its index ranges, which keeps the index
 * proportional to the number of *distinct* member paths, independent of array
 * sizes, and maps directly onto a counter template when added to the project.
 * Pointers contribute their target as `p^` paths; disabled symbols are listed too.
 */
import type { ScopeDataType } from '@/domain/dataTypes'
import { wildcardsToTemplate } from '@/domain/pattern'
import type { ArrayDim, AreaKind, SymbolSource } from './model'
import type { SymbolKind, WalkOptions } from './walk'
import { describe, rootNode, walk } from './walk'

export interface SearchEntry {
    /** Unique within the index. */
    key: string
    sourceId: string
    /** Path with `*` for every array index. */
    path: string
    /** Last segment, for display and ranking. */
    name: string
    kind: SymbolKind
    typeName: string
    scopeType?: ScopeDataType
    /** Why a disabled entry (unsupported, pointer) cannot be recorded. */
    reason?: string
    /** Caveat for a recordable entry. */
    warning?: string
    area: AreaKind
    port: number
    comment?: string
    /** One range per `*` in `path`, in order. */
    ranges: ArrayDim[]
    /** Lower-cased path, precomputed for matching. */
    haystack: string
}

export interface SearchIndex {
    /** Sorted by path: case-insensitively, then exactly, then by source. */
    entries: SearchEntry[]
    /** True when the index stopped at MAX_ENTRIES (or a source's share of it) or the walk's depth limit. */
    truncated: boolean
}

export const MAX_ENTRIES = 250_000

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const byPath = (a: SearchEntry, b: SearchEntry) => compare(a.haystack, b.haystack) || compare(a.path, b.path) || compare(a.sourceId, b.sourceId)

export function buildIndex(sources: SymbolSource[]): SearchIndex {
    const { entries, truncated } = collectEntries(sources)
    // Sorted once here, so a path-ordered list is a plain filter and relevance ties fall back to path order.
    return { entries: entries.sort(byPath), truncated }
}

/**
 * Pointer targets are indexed (that is how `p^` paths are found); a reference member is listed but
 * not expanded — its target is found under its real symbol, and an MC function block's `Axis`
 * would otherwise repeat the whole AXIS_REF.
 */
const SEARCH_WALK: WalkOptions = { pointers: 'expand', references: 'list' }

/** A source's entries, at most `limit` of them; `full` is false when it has more. */
function sourceEntries(source: SymbolSource, limit: number, stats: { depthLimited: boolean }): { entries: SearchEntry[]; full: boolean } {
    const entries: SearchEntry[] = []
    const seen = new Set<string>()
    for (const root of source.roots) {
        for (const node of walk(source, rootNode(source, root), stats, SEARCH_WALK)) {
            // The same path can be reachable twice (a struct root and its separately declared member).
            const key = `${source.id}|${node.path}`
            if (seen.has(key)) continue
            if (entries.length === limit) return { entries, full: false }
            seen.add(key)
            entries.push({
                key,
                sourceId: source.id,
                path: node.path,
                name: node.name,
                ...describe(node),
                area: node.area,
                port: node.port,
                comment: node.comment,
                ranges: node.ranges,
                haystack: node.path.toLowerCase(),
            })
        }
    }
    return { entries, full: true }
}

/**
 * Every source's entries, within MAX_ENTRIES in total. Water-filling: sources are cut only when
 * the total exceeds the cap, smallest first get what they need, and the rest is shared evenly —
 * so one huge source cannot starve the others and small ones never cost a big one its entries.
 */
function collectEntries(sources: SymbolSource[]): SearchIndex {
    const stats = { depthLimited: false }
    const perSource = sources.map((source) => sourceEntries(source, MAX_ENTRIES, stats))
    let truncated = perSource.some((p) => !p.full)
    let remaining = MAX_ENTRIES
    const order = perSource.map((_, i) => i).sort((a, b) => perSource[a].entries.length - perSource[b].entries.length)
    const entries: SearchEntry[] = []
    order.forEach((i, n) => {
        const share = Math.floor(remaining / (order.length - n))
        const own = perSource[i].entries
        if (own.length > share) truncated = true
        const taken = own.length > share ? own.slice(0, share) : own
        remaining -= taken.length
        for (const e of taken) entries.push(e)
    })
    return { entries, truncated: truncated || stats.depthLimited }
}

/** The channel template for a wildcard path: `*` become counters. */
export function templateOf(entry: Pick<SearchEntry, 'path' | 'ranges'>): string {
    return wildcardsToTemplate(entry.path, entry.ranges)
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
    /** `relevance` (default) ranks name matches of the first word first; `path` keeps the index's path order. */
    order?: 'relevance' | 'path'
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
    if (firstWord && query.order !== 'path') {
        matches.sort((a, b) => rank(a, firstWord) - rank(b, firstWord) || a.path.length - b.path.length)
    }
    return { entries: matches.slice(0, limit), total: matches.length }
}
