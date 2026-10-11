/**
 * Use cases that span stores: turning browser picks, dropped symbols and project files
 * into project changes.
 */
import type { ChannelSpec } from '@/domain/project'
import { mergeChannelSpecs, parseProject, sanitizeFileName } from '@/domain/project'
import { candidatesAt } from '@/catalog/candidates'
import { parseTargetBrowserDrop } from '@/catalog/targetBrowserDrop'
import { downloadText } from '@/export/bundle'
import type { BrowserPick } from './browserStore'
import { PICK_MIME } from './browserStore'
import { useCatalogStore } from './catalogStore'
import { useProjectStore } from './projectStore'

export interface AddResult {
    added: number
    duplicates: number
    /** Picks or dropped symbols that yield nothing recordable (strings, pointers, unknown paths). */
    empty: number
    truncated: boolean
    /** Array members skipped because one channel would expand to too many acquisitions. */
    tooLarge: number
}

/**
 * Add channel specs to an axis group as one change (at `index`, appended when omitted);
 * unknown Net IDs become targets named `targetName`.
 */
export function addSpecs(
    axisGroupId: string,
    specs: ChannelSpec[],
    targetName?: string,
    index?: number,
): Pick<AddResult, 'added' | 'duplicates'> {
    const { project, commit } = useProjectStore.getState()
    const result = mergeChannelSpecs(project, axisGroupId, specs, targetName, index)
    if (result.added > 0) commit(result.project)
    return { added: result.added, duplicates: result.duplicates }
}

/** What adding picks would produce, resolved against the current catalog. */
export function resolvePicks(picks: BrowserPick[]): Omit<AddResult, 'added' | 'duplicates'> & { specs: ChannelSpec[]; targetName?: string } {
    const sources = new Map(useCatalogStore.getState().sources.map((s) => [s.id, s]))
    const specs: ChannelSpec[] = []
    let empty = 0
    let truncated = false
    let tooLarge = 0
    for (const pick of picks) {
        const source = sources.get(pick.sourceId)
        const result = source ? candidatesAt(source, pick.path) : { specs: [], truncated: false, tooLarge: 0 }
        if (result.specs.length === 0 && result.tooLarge === 0) empty++
        truncated ||= result.truncated
        tooLarge += result.tooLarge
        specs.push(...result.specs)
    }
    return { specs, empty, truncated, tooLarge, targetName: picks[0] && sources.get(picks[0].sourceId)?.title }
}

export function addPicks(axisGroupId: string, picks: BrowserPick[], index?: number): AddResult {
    const { specs, targetName, ...rest } = resolvePicks(picks)
    return { ...addSpecs(axisGroupId, specs, targetName, index), ...rest }
}

/** Serialise picks for a drag. */
export function setPickDragData(dataTransfer: DataTransfer, picks: BrowserPick[]): void {
    dataTransfer.setData(PICK_MIME, JSON.stringify(picks))
    dataTransfer.effectAllowed = 'copy'
}

/**
 * Drop on an axis group (at `index`, appended when omitted): picks dragged from the symbol
 * browser, or the XML the TwinCAT Target Browser puts on the clipboard.
 */
export function dropOnAxisGroup(axisGroupId: string, data: Pick<DataTransfer, 'types' | 'getData'>, index?: number): AddResult {
    if (data.types.includes(PICK_MIME)) {
        let picks: BrowserPick[] = []
        try {
            const parsed: unknown = JSON.parse(data.getData(PICK_MIME))
            if (Array.isArray(parsed)) picks = parsed.filter((p): p is BrowserPick => typeof p?.sourceId === 'string' && typeof p?.path === 'string')
        } catch {
            // Not ours after all: nothing to add.
        }
        return addPicks(axisGroupId, picks, index)
    }
    const dropped = parseTargetBrowserDrop(data.getData('text/plain'))
    return { ...addSpecs(axisGroupId, dropped.symbols, 'Target Browser', index), empty: dropped.skipped.length, truncated: false, tooLarge: 0 }
}

export function describeAddResult(r: AddResult, groupName: string): string {
    if (r.added === 0 && r.duplicates === 0 && r.empty === 0 && r.tooLarge === 0) {
        return 'Nothing to add: drop symbols from the symbol browser or the TwinCAT Target Browser.'
    }
    const parts = [`${r.added} channel${r.added === 1 ? '' : 's'} added to ${groupName}`]
    if (r.duplicates) parts.push(`${r.duplicates} already present`)
    if (r.empty) parts.push(`${r.empty} not recordable`)
    if (r.tooLarge) parts.push(`${r.tooLarge} array${r.tooLarge === 1 ? '' : 's'} too large for one channel — pick elements in the tree`)
    if (r.truncated) parts.push('limit reached, not everything was added')
    return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Project files
// ---------------------------------------------------------------------------

export function saveProjectFile(): void {
    const { project } = useProjectStore.getState()
    downloadText(JSON.stringify(project, null, 2), `${sanitizeFileName(project.settings.name.replace(/\s+/g, '_'))}.scope.json`)
}

/** Replace the project with a project file; throws with a readable message on invalid files. */
export async function openProjectFile(file: File): Promise<void> {
    let json: unknown
    try {
        json = JSON.parse(await file.text())
    } catch {
        throw new Error('not a JSON file')
    }
    useProjectStore.getState().commit(parseProject(json))
}
