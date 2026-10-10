/**
 * The scope project being assembled: what ends up in the exported `.tcmproj`.
 *
 *   Project
 *   ├── settings          (name, scope server, timing, default port)
 *   ├── targets[]         (AMS Net IDs channels can record from)
 *   └── scopeFiles[]      → one `.tcscopex` each, holding one YT chart
 *       └── axisGroups[]  → one value axis in the chart
 *           └── channels[] → a symbol template; expands to 1..n acquisitions
 *
 * Every entity has a globally unique id, so operations address an entity by its
 * own id instead of the chain of parent ids. All functions here are pure.
 */
import { v4 as uuid } from 'uuid'
import type { ScopeDataType } from './dataTypes'
import { isScopeDataType } from './dataTypes'
import { expansionCount, validateTemplate } from './pattern'

export interface Target {
    id: string
    name: string
    amsNetId: string
}

export interface Channel {
    id: string
    /** Symbol path, optionally with counters (`MAIN.aAxis[{i:1:4}].fPos`). */
    symbol: string
    dataType: ScopeDataType
    port: number
    targetId: string
}

export interface AxisGroup {
    id: string
    name: string
    channels: Channel[]
}

export interface ScopeFile {
    id: string
    /** File name without the `.tcscopex` extension. */
    name: string
    axisGroups: AxisGroup[]
}

export interface ProjectSettings {
    name: string
    /** AMS Net ID of the scope server that records (`<MainServer>`). */
    mainServer: string
    /** Record time in 100 ns ticks. */
    recordTime: number
    /** Base sample time in 100 ns ticks. */
    baseSampleTime: number
    /** Port for new manual channels. */
    defaultPort: number
}

export interface Project {
    version: 2
    settings: ProjectSettings
    targets: Target[]
    scopeFiles: ScopeFile[]
}

export const TICKS_PER_MS = 10_000

export const DEFAULT_SETTINGS: ProjectSettings = {
    name: 'Scope Project',
    mainServer: '127.0.0.1.1.1',
    recordTime: 600_000 * TICKS_PER_MS,
    baseSampleTime: 10 * TICKS_PER_MS,
    defaultPort: 851,
}

export const LOCAL_TARGET_ID = 'local'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * A channel to add, as importers and the browser describe it: the target is given by its
 * AMS Net ID (if known), not by a project target id.
 */
export interface ChannelSpec {
    symbol: string
    dataType: ScopeDataType
    port: number
    amsNetId?: string
}

export type ChannelInit = Partial<Omit<Channel, 'id'>>

export function createChannel(project: Project, init: ChannelInit = {}): Channel {
    return {
        id: uuid(),
        symbol: init.symbol ?? '',
        dataType: init.dataType ?? 'REAL64',
        port: init.port ?? project.settings.defaultPort,
        targetId: init.targetId ?? project.targets[0]?.id ?? LOCAL_TARGET_ID,
    }
}

export function createAxisGroup(name: string, channels: Channel[] = []): AxisGroup {
    return { id: uuid(), name, channels }
}

export function createScopeFile(name: string): ScopeFile {
    return { id: uuid(), name, axisGroups: [createAxisGroup('Axis Group 1')] }
}

export function createProject(): Project {
    return {
        version: 2,
        settings: { ...DEFAULT_SETTINGS },
        targets: [{ id: LOCAL_TARGET_ID, name: 'Local', amsNetId: '127.0.0.1.1.1' }],
        scopeFiles: [createScopeFile('Scope_1')],
    }
}

/** Next free name of the form `${prefix}${n}` that is not in `taken`. */
export function nextName(prefix: string, taken: Iterable<string>): string {
    const used = new Set([...taken].map((t) => t.toLowerCase()))
    let n = 1
    while (used.has(`${prefix}${n}`.toLowerCase())) n++
    return `${prefix}${n}`
}

/** `base` if it is free, otherwise `base_2`, `base_3`, ... */
export function uniqueName(base: string, taken: Iterable<string>): string {
    const used = new Set([...taken].map((t) => t.toLowerCase()))
    if (!used.has(base.toLowerCase())) return base
    let n = 2
    while (used.has(`${base}_${n}`.toLowerCase())) n++
    return `${base}_${n}`
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function findAxisGroup(project: Project, axisGroupId: string): AxisGroup | undefined {
    for (const f of project.scopeFiles) {
        const ag = f.axisGroups.find((a) => a.id === axisGroupId)
        if (ag) return ag
    }
    return undefined
}

/** Acquisitions a template produces: its expansion count, 0 when it is invalid or empty. */
export function templateAcquisitions(symbol: string): number {
    return validateTemplate(symbol).valid ? expansionCount(symbol) : 0
}

export function acquisitionCount(group: AxisGroup): number {
    return group.channels.reduce((n, c) => n + templateAcquisitions(c.symbol), 0)
}

export function allChannels(project: Project): Channel[] {
    return project.scopeFiles.flatMap((f) => f.axisGroups.flatMap((a) => a.channels))
}

// ---------------------------------------------------------------------------
// Immutable updates
// ---------------------------------------------------------------------------

type Patch<T> = Partial<Omit<T, 'id'>>

const mapFiles = (p: Project, fn: (f: ScopeFile) => ScopeFile): Project => ({
    ...p,
    scopeFiles: p.scopeFiles.map(fn),
})

const mapAxisGroups = (p: Project, fn: (a: AxisGroup) => AxisGroup): Project =>
    mapFiles(p, (f) => ({ ...f, axisGroups: f.axisGroups.map(fn) }))

const mapChannels = (p: Project, fn: (c: Channel) => Channel): Project =>
    mapAxisGroups(p, (a) => ({ ...a, channels: a.channels.map(fn) }))

function insertAfter<T extends { id: string }>(list: T[], id: string, item: T): T[] {
    const i = list.findIndex((x) => x.id === id)
    return i === -1 ? list : [...list.slice(0, i + 1), item, ...list.slice(i + 1)]
}

const cloneChannel = (c: Channel): Channel => ({ ...c, id: uuid() })
const cloneAxisGroup = (a: AxisGroup, name = a.name): AxisGroup => ({
    id: uuid(),
    name,
    channels: a.channels.map(cloneChannel),
})

export const ops = {
    updateSettings: (p: Project, patch: Partial<ProjectSettings>): Project => ({
        ...p,
        settings: { ...p.settings, ...patch },
    }),

    // Targets ---------------------------------------------------------------
    addTarget: (p: Project, target: Omit<Target, 'id'>): Project => ({
        ...p,
        targets: [...p.targets, { ...target, id: uuid() }],
    }),
    updateTarget: (p: Project, id: string, patch: Patch<Target>): Project => ({
        ...p,
        targets: p.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }),
    /** Removes a target; its channels move to the first remaining target. The last target cannot be removed. */
    removeTarget: (p: Project, id: string): Project => {
        const targets = p.targets.filter((t) => t.id !== id)
        if (targets.length === 0 || targets.length === p.targets.length) return p
        const fallback = targets[0].id
        return mapChannels({ ...p, targets }, (c) => (c.targetId === id ? { ...c, targetId: fallback } : c))
    },

    // Scope files -----------------------------------------------------------
    /** `id` lets the caller select the new file right away. */
    addScopeFile: (p: Project, id: string = uuid()): Project => ({
        ...p,
        scopeFiles: [...p.scopeFiles, { ...createScopeFile(nextName('Scope_', p.scopeFiles.map((f) => f.name))), id }],
    }),
    updateScopeFile: (p: Project, id: string, patch: Patch<ScopeFile>): Project =>
        mapFiles(p, (f) => (f.id === id ? { ...f, ...patch } : f)),
    removeScopeFile: (p: Project, id: string): Project => ({
        ...p,
        scopeFiles: p.scopeFiles.filter((f) => f.id !== id),
    }),
    duplicateScopeFile: (p: Project, id: string): Project => {
        const f = p.scopeFiles.find((x) => x.id === id)
        if (!f) return p
        const copy: ScopeFile = {
            id: uuid(),
            name: uniqueName(`${f.name}_copy`, p.scopeFiles.map((x) => x.name)),
            axisGroups: f.axisGroups.map((a) => cloneAxisGroup(a)),
        }
        return { ...p, scopeFiles: insertAfter(p.scopeFiles, id, copy) }
    },

    // Axis groups -----------------------------------------------------------
    addAxisGroup: (p: Project, fileId: string): Project =>
        mapFiles(p, (f) =>
            f.id === fileId
                ? {
                      ...f,
                      axisGroups: [
                          ...f.axisGroups,
                          createAxisGroup(nextName('Axis Group ', f.axisGroups.map((a) => a.name))),
                      ],
                  }
                : f,
        ),
    updateAxisGroup: (p: Project, id: string, patch: Patch<AxisGroup>): Project =>
        mapAxisGroups(p, (a) => (a.id === id ? { ...a, ...patch } : a)),
    removeAxisGroup: (p: Project, id: string): Project =>
        mapFiles(p, (f) => ({ ...f, axisGroups: f.axisGroups.filter((a) => a.id !== id) })),
    duplicateAxisGroup: (p: Project, id: string): Project =>
        mapFiles(p, (f) => {
            const a = f.axisGroups.find((x) => x.id === id)
            return a ? { ...f, axisGroups: insertAfter(f.axisGroups, id, cloneAxisGroup(a, `${a.name} (copy)`)) } : f
        }),

    // Channels --------------------------------------------------------------
    addChannels: (p: Project, axisGroupId: string, channels: ChannelInit[]): Project =>
        mapAxisGroups(p, (a) =>
            a.id === axisGroupId
                ? { ...a, channels: [...a.channels, ...channels.map((c) => createChannel(p, c))] }
                : a,
        ),
    updateChannel: (p: Project, id: string, patch: Patch<Channel>): Project =>
        mapChannels(p, (c) => (c.id === id ? { ...c, ...patch } : c)),
    removeChannel: (p: Project, id: string): Project =>
        mapAxisGroups(p, (a) => ({ ...a, channels: a.channels.filter((c) => c.id !== id) })),
    duplicateChannel: (p: Project, id: string): Project =>
        mapAxisGroups(p, (a) => {
            const c = a.channels.find((x) => x.id === id)
            return c ? { ...a, channels: insertAfter(a.channels, id, cloneChannel(c)) } : a
        }),
    /** Moves a channel to another axis group (appended), possibly in another scope file. */
    moveChannel: (p: Project, id: string, toAxisGroupId: string): Project => {
        const channel = allChannels(p).find((c) => c.id === id)
        if (!channel || !findAxisGroup(p, toAxisGroupId)) return p
        return mapAxisGroups(p, (a) => {
            const rest = a.channels.filter((c) => c.id !== id)
            return { ...a, channels: a.id === toAxisGroupId ? [...rest, channel] : rest }
        })
    },
}

export interface MergeResult {
    project: Project
    added: number
    /** Specs the axis group already records (same symbol, port and target). */
    duplicates: number
}

/**
 * Append channel specs to an axis group in one step: Net IDs the project does not know
 * become new targets (named `targetName`), and specs the group already records are skipped.
 */
export function mergeChannelSpecs(p: Project, axisGroupId: string, specs: ChannelSpec[], targetName = 'Target'): MergeResult {
    const group = findAxisGroup(p, axisGroupId)
    if (!group) return { project: p, added: 0, duplicates: 0 }

    const targets = [...p.targets]
    const targetFor = (amsNetId: string | undefined): string => {
        if (!amsNetId) return targets[0].id
        let target = targets.find((t) => t.amsNetId === amsNetId)
        if (!target) targets.push((target = { id: uuid(), name: targetName, amsNetId }))
        return target.id
    }
    const keyOf = (c: { symbol: string; port: number; targetId: string }) => `${c.symbol}|${c.port}|${c.targetId}`
    const present = new Set(group.channels.map(keyOf))
    const fresh: Channel[] = []
    for (const spec of specs) {
        const channel = { id: uuid(), symbol: spec.symbol, dataType: spec.dataType, port: spec.port, targetId: targetFor(spec.amsNetId) }
        if (present.has(keyOf(channel))) continue
        present.add(keyOf(channel))
        fresh.push(channel)
    }
    const project = mapAxisGroups({ ...p, targets }, (a) => (a.id === axisGroupId ? { ...a, channels: [...a.channels, ...fresh] } : a))
    return { project, added: fresh.length, duplicates: specs.length - fresh.length }
}

/** Acquisitions of all valid channels of a scope file. */
export function fileAcquisitionCount(file: ScopeFile): number {
    return file.axisGroups.reduce((n, a) => n + acquisitionCount(a), 0)
}

// ---------------------------------------------------------------------------
// Validation & (de)serialisation
// ---------------------------------------------------------------------------

const AMS_NET_ID = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** Error message for an invalid AMS Net ID (six bytes, dot separated), or null. */
export function amsNetIdError(value: string): string | null {
    const m = AMS_NET_ID.exec(value.trim())
    if (!m) return 'Six numbers separated by dots, e.g. 192.168.0.10.1.1'
    if (m.slice(1).some((b) => Number(b) > 255)) return 'Each part must be between 0 and 255'
    return null
}

/** Characters Windows does not allow in file names, plus control characters. */
// eslint-disable-next-line no-control-regex
const ILLEGAL_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g

export function sanitizeFileName(name: string): string {
    const cleaned = name.replace(ILLEGAL_FILE_CHARS, '_').trim().replace(/[. ]+$/, '')
    return cleaned || 'Scope'
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
            })),
        })),
    }))

    return { version: 2, settings, targets, scopeFiles }
}

/** Above this many acquisitions the export is refused: the XML would run into hundreds of MB. */
export const MAX_PROJECT_ACQUISITIONS = 20_000

export function projectAcquisitionCount(project: Project): number {
    return project.scopeFiles.reduce((n, f) => n + fileAcquisitionCount(f), 0)
}

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
