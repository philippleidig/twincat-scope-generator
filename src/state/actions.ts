/**
 * Use cases that span stores: turning browser picks, dropped symbols and project files
 * into project changes.
 */
import type { ChannelSpec, Project } from '@/domain/project'
import { mergeChannelSpecs, sanitizeFileName, scopeFileLabel } from '@/domain/project'
import { parseProject } from '@/domain/projectValidation'
import { candidatesAt } from '@/catalog/candidates'
import { parseTargetBrowserDrop } from '@/catalog/targetBrowserDrop'
import { downloadText } from '@/export/bundle'
import type { BrowserPick } from './browserStore'
import { PICK_MIME } from './browserStore'
import type { ProjectDrag } from './projectDrag'
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

/** Add the symbols the TwinCAT Target Browser drags or copies (XML as text). */
export function addTargetBrowserXml(axisGroupId: string, text: string, index?: number): AddResult {
    const dropped = parseTargetBrowserDrop(text)
    return { ...addSpecs(axisGroupId, dropped.symbols, 'Target Browser', index), empty: dropped.skipped.length, truncated: false, tooLarge: 0 }
}

/** Serialise picks for a drag. */
export function setPickDragData(dataTransfer: DataTransfer, picks: BrowserPick[]): void {
    dataTransfer.setData(PICK_MIME, JSON.stringify(picks))
    dataTransfer.effectAllowed = 'copy'
}

export interface DropDestination {
    fileId: string
    /** Axis group for channels, picks and text; the file's first axis group when omitted (a file tab). */
    axisGroupId?: string
    /** Insert position in the axis group (channels, picks, text) or the file (axis groups); appended when omitted. */
    slot?: number
}

export interface DropOutcome {
    tone: 'success' | 'warning'
    message: string
}

/**
 * Apply a drop on the scope project as one change: move or copy a channel or axis group, or add
 * picks / Target Browser symbols. Null when nothing changed (unknown ids, dropped where it already is).
 */
export function applyDrop(drag: ProjectDrag, to: DropDestination, copy: boolean): DropOutcome | null {
    const store = useProjectStore.getState()
    const before = store.project
    const file = before.scopeFiles.find((f) => f.id === to.fileId)
    if (!file) return null
    const verb = copy ? 'Copied' : 'Moved'
    if (drag.kind === 'axis-group') {
        ;(copy ? store.copyAxisGroup : store.moveAxisGroup)(drag.id, file.id, to.slot)
        return changed(before) ? { tone: 'success', message: `${verb} axis group to ${scopeFileLabel(file)}` } : null
    }
    const group = to.axisGroupId ? file.axisGroups.find((a) => a.id === to.axisGroupId) : file.axisGroups[0]
    if (!group) return null
    if (drag.kind === 'channel') {
        ;(copy ? store.copyChannel : store.moveChannel)(drag.id, group.id, to.slot)
        return changed(before) ? { tone: 'success', message: `${verb} channel to ${scopeFileLabel(file)} › ${group.name}` } : null
    }
    const result = drag.kind === 'picks' ? addPicks(group.id, drag.picks, to.slot) : addTargetBrowserXml(group.id, drag.text, to.slot)
    return { tone: result.added > 0 ? 'success' : 'warning', message: describeAddResult(result, group.name) }
}

const changed = (before: Project) => useProjectStore.getState().project !== before

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
