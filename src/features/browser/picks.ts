import type { AreaKind } from '@/catalog/model'
import type { SearchEntry } from '@/catalog/search'
import type { SymbolNode } from '@/catalog/tree'
import type { BrowserPick } from '@/state/browserStore'

export const nodePick = (node: SymbolNode): BrowserPick => ({ key: node.key, sourceId: node.sourceId, path: node.symbol.path, kind: node.kind })

export const entryPick = (entry: SearchEntry): BrowserPick => ({ key: entry.key, sourceId: entry.sourceId, path: entry.path, kind: entry.kind })

/** Unsupported types (strings, pointers, …) cannot become channels. */
export const isPickable = (kind: string) => kind === 'scalar' || kind === 'struct' || kind === 'array'

export const AREA_LABEL: Record<AreaKind, string> = {
    input: 'Input',
    output: 'Output',
    internal: 'Internal',
    parameter: 'Parameter',
}
