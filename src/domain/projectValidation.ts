/**
 * Validation of a scope project and loading it from untrusted JSON (project files, persisted state).
 */
import { v4 as uuid } from 'uuid'
import { channelNameError, normalizeChannelStyle } from './channelStyle'
import { isScopeDataType } from './dataTypes'
import { validateTemplate } from './pattern'
import type { Project, ProjectSettings } from './project'
import { allChannels, createProject, projectAcquisitionCount, sanitizeFileName } from './project'

const AMS_NET_ID = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** Error message for an invalid AMS Net ID (six bytes, dot separated), or null. */
export function amsNetIdError(value: string): string | null {
    const m = AMS_NET_ID.exec(value.trim())
    if (!m) return 'Six numbers separated by dots, e.g. 192.168.0.10.1.1'
    if (m.slice(1).some((b) => Number(b) > 255)) return 'Each part must be between 0 and 255'
    return null
}

export function fileNameError(name: string, siblings: string[]): string | null {
    if (!name.trim()) return 'Name is required'
    if (sanitizeFileName(name) !== name.trim()) return 'Contains characters not allowed in file names'
    const lower = name.trim().toLowerCase()
    if (siblings.some((s) => s.trim().toLowerCase() === lower)) return 'Another scope file has this name'
    return null
}

/**
 * Parse a project from JSON (an exported project file or persisted state).
 * Unknown or malformed parts are dropped rather than trusted, so a hand-edited
 * file can never put the store into an invalid shape.
 */
export function parseProject(json: unknown): Project {
    const base = createProject()
    if (!json || typeof json !== 'object') throw new Error('Not a project file')
    const raw = json as Record<string, unknown>
    if (raw.version !== 2) throw new Error('Unsupported project file version')

    const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)
    const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
    const arr = (v: unknown): Record<string, unknown>[] =>
        Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []

    const s = (raw.settings ?? {}) as Record<string, unknown>
    const settings: ProjectSettings = {
        name: str(s.name, base.settings.name),
        mainServer: str(s.mainServer, base.settings.mainServer),
        recordTime: num(s.recordTime, base.settings.recordTime),
        baseSampleTime: num(s.baseSampleTime, base.settings.baseSampleTime),
        defaultPort: num(s.defaultPort, base.settings.defaultPort),
    }

    const targets = arr(raw.targets).map((t) => ({
        id: str(t.id, uuid()),
        name: str(t.name, 'Target'),
        amsNetId: str(t.amsNetId, '127.0.0.1.1.1'),
    }))
    if (targets.length === 0) targets.push(...base.targets)
    const targetIds = new Set(targets.map((t) => t.id))

    const scopeFiles = arr(raw.scopeFiles).map((f) => ({
        id: str(f.id, uuid()),
        name: str(f.name, 'Scope'),
        axisGroups: arr(f.axisGroups).map((a) => ({
            id: str(a.id, uuid()),
            name: str(a.name, 'Axis Group'),
            channels: arr(a.channels).map((c) => ({
                id: str(c.id, uuid()),
                symbol: str(c.symbol, ''),
                dataType: isScopeDataType(c.dataType) ? c.dataType : 'REAL64',
                port: num(c.port, settings.defaultPort),
                targetId: typeof c.targetId === 'string' && targetIds.has(c.targetId) ? c.targetId : targets[0].id,
                // V2.1, optional: kept only when well-formed. A name the template cannot fill is kept
                // (the editor shows why, the export uses the symbol name).
                ...normalizeChannelStyle(c),
            })),
        })),
    }))

    return { version: 2, settings, targets, scopeFiles }
}

/** Above this many acquisitions the export is refused: the XML would run into hundreds of MB. */
export const MAX_PROJECT_ACQUISITIONS = 20_000

/** Why the project cannot be exported right now, or null. */
export function exportBlocker(project: Project): string | null {
    const count = projectAcquisitionCount(project)
    if (count === 0) return 'Add at least one valid channel'
    if (count > MAX_PROJECT_ACQUISITIONS) {
        return `${count.toLocaleString('en-US')} acquisitions exceed the limit of ${MAX_PROJECT_ACQUISITIONS.toLocaleString('en-US')}`
    }
    return null
}

/** Problems worth telling the user about before exporting. None of them blocks the export. */
export function projectIssues(project: Project): string[] {
    const issues: string[] = []
    const invalid = allChannels(project).filter((c) => c.symbol.trim() && !validateTemplate(c.symbol).valid).length
    if (invalid > 0) issues.push(`${invalid} channel${invalid === 1 ? ' has an' : 's have'} invalid symbol paths and will be skipped`)
    const empty = allChannels(project).filter((c) => !c.symbol.trim()).length
    if (empty > 0) issues.push(`${empty} empty channel${empty === 1 ? '' : 's'} will be skipped`)
    // Channels skipped for their symbol path are reported above, not again for their name.
    const badNames = allChannels(project).flatMap((c) => {
        const error = validateTemplate(c.symbol).valid ? channelNameError(c) : null
        return error ? [`"${c.name}": ${error}`] : []
    })
    if (badNames.length > 0) {
        const more = badNames.length > 1 ? ` (and ${badNames.length - 1} more)` : ''
        issues.push(`Channel name ${badNames[0]}${more} — the symbol path is used instead`)
    }
    const names = project.scopeFiles.map((f) => f.name)
    project.scopeFiles.forEach((f, i) => {
        const error = fileNameError(f.name, names.filter((_, j) => j !== i))
        if (error) issues.push(`Scope file "${f.name}": ${error.toLowerCase()} — it will be renamed on export`)
    })
    for (const t of project.targets) {
        if (amsNetIdError(t.amsNetId)) issues.push(`Target "${t.name}" has an invalid AMS Net ID`)
    }
    if (amsNetIdError(project.settings.mainServer)) issues.push('The scope server AMS Net ID is invalid')
    return issues
}
