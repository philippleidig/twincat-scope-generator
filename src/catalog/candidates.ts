/** What adding a symbol (and everything below it) to the project produces. */
import type { ChannelSpec } from '@/domain/project'
import { MAX_EXPANSION, expansionCount } from '@/domain/pattern'
import type { SymbolSource } from './model'
import { templateOf } from './search'
import type { WalkOptions } from './walk'
import { derefNode, resolvePath, walk } from './walk'

/** Upper bound of channels a single "add" may create, so adding a huge FB stays deliberate. */
export const MAX_CANDIDATES = 2_000

export interface Candidates {
    specs: ChannelSpec[]
    /** More channels exist than were returned (MAX_CANDIDATES or the walk's depth limit). */
    truncated: boolean
    /** Leaves skipped because their arrays expand to more than MAX_EXPANSION acquisitions. */
    tooLarge: number
}

/**
 * "Add" policy for indirections: the user adds what they picked, not everything it points to.
 * Pointer targets and reference members *below* the added symbol are skipped (an MC function
 * block would otherwise pull in its whole AXIS_REF); to record through them, add `p^` or the
 * reference member itself — the start is always expanded, whatever it is reached through.
 */
const ADD_WALK: WalkOptions = { pointers: 'skip', references: 'skip' }

/**
 * The channels for the symbol at `path` (concrete like `GVL.aAxis[3]` or with wildcards like
 * `GVL.aAxis[*]`): the symbol itself if it is recordable, otherwise every recordable leaf
 * below it, with array indices turned into counters (see ADD_WALK for pointers and references).
 * A pointer itself cannot be recorded, so adding it adds its target `p^`. Unknown paths yield nothing.
 */
export function candidatesAt(source: SymbolSource, path: string): Candidates {
    const found = resolvePath(source, path)
    const start = found && (derefNode(source, found) ?? found)
    if (!start) return { specs: [], truncated: false, tooLarge: 0 }
    const stats = { depthLimited: false }
    const specs: ChannelSpec[] = []
    let tooLarge = 0
    for (const node of walk(source, start, stats, ADD_WALK)) {
        if (node.resolved.kind !== 'scalar') continue
        const symbol = templateOf(node)
        if (expansionCount(symbol) > MAX_EXPANSION) {
            tooLarge++
            continue
        }
        if (specs.length === MAX_CANDIDATES) return { specs, truncated: true, tooLarge }
        specs.push({ symbol, dataType: node.resolved.scopeType, port: node.port, amsNetId: source.amsNetId })
    }
    return { specs, truncated: stats.depthLimited, tooLarge }
}
