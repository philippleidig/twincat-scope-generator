/**
 * Use cases that span stores: turning browser picks or dropped symbols into
 * channels of the project.
 */
import type { ScopeDataType } from '@/domain/dataTypes'
import { findAxisGroup } from '@/domain/project'
import type { BrowserPick } from './browserStore'
import { useCatalogStore } from './catalogStore'
import { useProjectStore } from './projectStore'

export interface AddResult {
    added: number
    duplicates: number
    truncated: boolean
    /** Picks that yield nothing recordable (strings, pointers, ...). */
    empty: number
}

interface ChannelSpec {
    symbol: string
    dataType: ScopeDataType
    port: number
    amsNetId?: string
}

/** Target id for a Net ID, creating the target when the project does not know it yet. */
function targetFor(amsNetId: string | undefined, label: string): string | undefined {
    if (!amsNetId) return undefined
    const store = useProjectStore.getState()
    const existing = store.project.targets.find((t) => t.amsNetId === amsNetId)
    if (existing) return existing.id
    store.addTarget({ name: label, amsNetId })
    return useProjectStore.getState().project.targets.find((t) => t.amsNetId === amsNetId)?.id
}

/** Append channels to an axis group, skipping ones it already records. */
export function addChannels(axisGroupId: string, specs: ChannelSpec[], sourceLabel = 'Target'): Omit<AddResult, 'truncated' | 'empty'> {
    const project = useProjectStore.getState().project
    const group = findAxisGroup(project, axisGroupId)
    if (!group) return { added: 0, duplicates: 0 }

    const fallbackTarget = project.targets[0].id
    const existing = new Set(group.channels.map((c) => `${c.symbol}|${c.port}|${c.targetId}`))
    const fresh = []
    let duplicates = 0
    for (const spec of specs) {
        const targetId = targetFor(spec.amsNetId, sourceLabel) ?? fallbackTarget
        const key = `${spec.symbol}|${spec.port}|${targetId}`
        if (existing.has(key)) {
            duplicates++
            continue
        }
        existing.add(key)
        fresh.push({ symbol: spec.symbol, dataType: spec.dataType, port: spec.port, targetId })
    }
    if (fresh.length > 0) useProjectStore.getState().addChannels(axisGroupId, fresh)
    return { added: fresh.length, duplicates }
}

export function addPicks(axisGroupId: string, picks: BrowserPick[]): AddResult {
    const sources = new Map(useCatalogStore.getState().sources.map((s) => [s.id, s]))
    const specs: ChannelSpec[] = []
    let truncated = false
    let empty = 0
    for (const pick of picks) {
        const { candidates, truncated: t } = pick.candidates()
        truncated ||= t
        if (candidates.length === 0) empty++
        const source = sources.get(pick.sourceId)
        for (const c of candidates) {
            specs.push({ symbol: c.template, dataType: c.scopeType, port: c.port, amsNetId: source?.amsNetId })
        }
    }
    const label = picks.length > 0 ? (sources.get(picks[0].sourceId)?.title ?? 'Target') : 'Target'
    return { ...addChannels(axisGroupId, specs, label), truncated, empty }
}

export function describeAddResult(r: AddResult, groupName: string): string {
    const parts = [`${r.added} channel${r.added === 1 ? '' : 's'} added to ${groupName}`]
    if (r.duplicates) parts.push(`${r.duplicates} already present`)
    if (r.empty) parts.push(`${r.empty} not recordable`)
    if (r.truncated) parts.push('limit reached, not everything was added')
    return parts.join(' · ')
}
