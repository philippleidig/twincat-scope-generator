import type { AreaKind, SymbolSource } from '@/catalog/model'
import type { SearchEntry, SearchIndex } from '@/catalog/search'
import type { BrowserNode } from '@/catalog/tree'
import { candidatesForEntry, candidatesForNode } from '@/catalog/candidates'
import { entryTemplate } from '@/catalog/search'
import type { BrowserPick } from '@/state/browserStore'

export function nodePick(source: SymbolSource, node: BrowserNode): BrowserPick {
    return { key: node.key, sourceId: source.id, path: node.path, kind: node.kind, candidates: () => candidatesForNode(source, node) }
}

export function entryPick(index: SearchIndex, entry: SearchEntry): BrowserPick {
    return {
        key: entry.key,
        sourceId: entry.sourceId,
        path: entryTemplate(entry),
        kind: entry.kind,
        candidates: () => candidatesForEntry(index, entry),
    }
}

/** Folders and unsupported types cannot become channels. */
export const isPickable = (kind: string) => kind === 'scalar' || kind === 'struct' || kind === 'array'

export const AREA_LABEL: Record<AreaKind, string> = {
    input: 'Input',
    output: 'Output',
    internal: 'Internal',
    parameter: 'Parameter',
}

/** MIME type marking a drag of browser symbols onto an axis group. */
export const PICK_MIME = 'application/x-scope-picks'

/** Picks being dragged right now (drag data itself can only carry strings). */
let dragged: BrowserPick[] | null = null
export const setDraggedPicks = (picks: BrowserPick[] | null) => {
    dragged = picks
}
export const draggedPicks = () => dragged
