/** What adding a browser node or search result to the project produces. */
import type { ChannelCandidate, SearchEntry, SearchIndex } from './search'
import { MAX_CANDIDATES, channelCandidates, entryTemplate } from './search'
import type { SymbolSource } from './model'
import type { BrowserNode } from './tree'

export interface Candidates {
    candidates: ChannelCandidate[]
    /** More channels exist than were returned (MAX_CANDIDATES). */
    truncated: boolean
}

/** A tree node: itself if scalar, otherwise every scalar below it (arrays become counters). */
export function candidatesForNode(source: SymbolSource, node: BrowserNode): Candidates {
    if (node.kind === 'scalar' && node.scopeType) {
        return { candidates: [{ template: node.path, scopeType: node.scopeType, port: node.port }], truncated: false }
    }
    if (!node.resolved || !node.area) return { candidates: [], truncated: false }
    return channelCandidates(source, { path: node.path, name: node.label, resolved: node.resolved, area: node.area, port: node.port })
}

/** A search result: itself if scalar, otherwise the scalar entries below it in the index. */
export function candidatesForEntry(index: SearchIndex, entry: SearchEntry): Candidates {
    if (entry.kind === 'scalar' && entry.scopeType) {
        return { candidates: [{ template: entryTemplate(entry), scopeType: entry.scopeType, port: entry.port }], truncated: false }
    }
    const below = index.entries.filter(
        (e) =>
            e.kind === 'scalar' &&
            e.sourceId === entry.sourceId &&
            (e.path.startsWith(`${entry.path}.`) || e.path.startsWith(`${entry.path}[`)),
    )
    return {
        candidates: below.slice(0, MAX_CANDIDATES).map((e) => ({ template: entryTemplate(e), scopeType: e.scopeType!, port: e.port })),
        truncated: below.length > MAX_CANDIDATES,
    }
}
