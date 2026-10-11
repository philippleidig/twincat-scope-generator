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
import type { ChannelStyle } from './channelStyle'
import { normalizeChannelStyle } from './channelStyle'
import type { ScopeDataType } from './dataTypes'
import { expansionCount, validateTemplate } from './pattern'

export interface Target {
    id: string
    name: string
    amsNetId: string
}

/** A channel; its optional display name and colour are the `ChannelStyle` fields. */
export interface Channel extends ChannelStyle {
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
        ...normalizeChannelStyle(init),
    }
}

/** A channel with a patch applied; the style fields are re-normalised (undefined or '' removes one). */
function patchChannel(c: Channel, patch: Patch<Channel>): Channel {
    const { name, color, colorMode, ...rest } = { ...c, ...patch }
    return { ...rest, ...normalizeChannelStyle({ name, color, colorMode }) }
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

/** Where an entity sits: its parent and its index in the parent's list. */
export interface Located<P> {
    parent: P
    index: number
}

function locateIn<P, I extends { id: string }>(parents: P[], items: (parent: P) => I[], id: string): Located<P> | undefined {
    for (const parent of parents) {
        const index = items(parent).findIndex((x) => x.id === id)
        if (index !== -1) return { parent, index }
    }
    return undefined
}

const allAxisGroups = (p: Project): AxisGroup[] => p.scopeFiles.flatMap((f) => f.axisGroups)

/** The axis group holding a channel, and the channel's index there. */
export const locateChannel = (p: Project, id: string): Located<AxisGroup> | undefined =>
    locateIn(allAxisGroups(p), (a) => a.channels, id)

/** The scope file holding an axis group, and the group's index there. */
export const locateAxisGroup = (p: Project, id: string): Located<ScopeFile> | undefined =>
    locateIn(p.scopeFiles, (f) => f.axisGroups, id)

/** A scope file's name as shown in tabs and menus. */
export const scopeFileLabel = (file: ScopeFile): string => file.name || 'Untitled'

export function findAxisGroup(project: Project, axisGroupId: string): AxisGroup | undefined {
    const at = locateAxisGroup(project, axisGroupId)
    return at && at.parent.axisGroups[at.index]
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

/** A slot `0..length` in a list; omitted or not a number means the end. */
const clampSlot = (index: number | undefined, length: number): number =>
    index === undefined || Number.isNaN(index) ? length : Math.max(0, Math.min(Math.trunc(index), length))

/** `items` inserted before `index` (clamped); appended when `index` is omitted. */
function insertAt<T>(list: T[], items: T[], index?: number): T[] {
    const i = clampSlot(index, list.length)
    return [...list.slice(0, i), ...items, ...list.slice(i)]
}

/**
 * Where a moved item lands in its destination list once it has been taken out, given the slot
 * it was dropped on (`0..length` of the list as shown, appended when omitted). `fromIndex` is the
 * item's index when it stays in the same list, else -1. Null when the move changes nothing.
 */
function moveSlot(fromIndex: number, length: number, index?: number): number | null {
    let slot = clampSlot(index, length)
    if (fromIndex === -1) return slot
    if (slot > fromIndex) slot--
    return slot === fromIndex ? null : slot
}

const cloneChannel = (c: Channel): Channel => ({ ...c, id: uuid() })
const cloneAxisGroup = (a: AxisGroup, name = a.name): AxisGroup => ({
    id: uuid(),
    name,
    channels: a.channels.map(cloneChannel),
})

/** One parent → children level of the tree, as `relocate` needs it. */
interface Level<P extends { id: string }, I extends { id: string }> {
    parents: (p: Project) => P[]
    mapParents: (p: Project, fn: (parent: P) => P) => Project
    items: (parent: P) => I[]
    withItems: (parent: P, items: I[]) => P
    /** A copy with new ids; `sameParent` when it lands next to the original. */
    clone: (item: I, sameParent: boolean) => I
}

const channelLevel: Level<AxisGroup, Channel> = {
    parents: allAxisGroups,
    mapParents: (p, fn) => mapAxisGroups(p, fn),
    items: (a) => a.channels,
    withItems: (a, channels) => ({ ...a, channels }),
    clone: (c) => cloneChannel(c),
}

const axisGroupLevel: Level<ScopeFile, AxisGroup> = {
    parents: (p) => p.scopeFiles,
    mapParents: (p, fn) => mapFiles(p, fn),
    items: (f) => f.axisGroups,
    withItems: (f, axisGroups) => ({ ...f, axisGroups }),
    clone: (a, sameParent) => cloneAxisGroup(a, sameParent ? `${a.name} (copy)` : a.name),
}

/**
 * Moves an item, or inserts a copy of it, at `index` of another (or its own) parent; appended
 * when `index` is omitted. `index` is a slot `0..length` in the destination as it is shown now,
 * i.e. still including the item when it stays in its parent. Returns `p` itself when unknown ids
 * are given or the move changes nothing.
 */
function relocate<P extends { id: string }, I extends { id: string }>(
    level: Level<P, I>,
    p: Project,
    id: string,
    toParentId: string,
    index: number | undefined,
    mode: 'move' | 'copy',
): Project {
    const from = locateIn(level.parents(p), level.items, id)
    const to = level.parents(p).find((x) => x.id === toParentId)
    if (!from || !to) return p
    const original = level.items(from.parent)[from.index]
    const sameParent = from.parent.id === to.id
    const length = level.items(to).length
    const slot = mode === 'move' ? moveSlot(sameParent ? from.index : -1, length, index) : clampSlot(index, length)
    if (slot === null) return p
    const item = mode === 'move' ? original : level.clone(original, sameParent)
    return level.mapParents(p, (parent) => {
        let items = level.items(parent)
        if (mode === 'move' && parent.id === from.parent.id) items = items.filter((x) => x.id !== id)
        if (parent.id === to.id) items = insertAt(items, [item], slot)
        return items === level.items(parent) ? parent : level.withItems(parent, items)
    })
}

/** A copy right after the original. */
function duplicate<P extends { id: string }, I extends { id: string }>(level: Level<P, I>, p: Project, id: string): Project {
    const at = locateIn(level.parents(p), level.items, id)
    return at ? relocate(level, p, id, at.parent.id, at.index + 1, 'copy') : p
}

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
    duplicateAxisGroup: (p: Project, id: string): Project => duplicate(axisGroupLevel, p, id),
    /** Moves an axis group to `index` of a scope file (see `relocate`). */
    moveAxisGroup: (p: Project, id: string, toFileId: string, index?: number): Project =>
        relocate(axisGroupLevel, p, id, toFileId, index, 'move'),
    /** Inserts a copy (new ids) of an axis group at `index` of a scope file; named "… (copy)" in its own file. */
    copyAxisGroup: (p: Project, id: string, toFileId: string, index?: number): Project =>
        relocate(axisGroupLevel, p, id, toFileId, index, 'copy'),

    // Channels --------------------------------------------------------------
    addChannels: (p: Project, axisGroupId: string, channels: ChannelInit[]): Project =>
        mapAxisGroups(p, (a) =>
            a.id === axisGroupId
                ? { ...a, channels: [...a.channels, ...channels.map((c) => createChannel(p, c))] }
                : a,
        ),
    /** Patching `name`, `color` or `colorMode` with undefined (or `name` with '') removes it; removing the colour removes `colorMode`. */
    updateChannel: (p: Project, id: string, patch: Patch<Channel>): Project =>
        mapChannels(p, (c) => (c.id === id ? patchChannel(c, patch) : c)),
    removeChannel: (p: Project, id: string): Project =>
        mapAxisGroups(p, (a) => ({ ...a, channels: a.channels.filter((c) => c.id !== id) })),
    duplicateChannel: (p: Project, id: string): Project => duplicate(channelLevel, p, id),
    /** Moves a channel to `index` of an axis group, possibly in another scope file (see `relocate`). */
    moveChannel: (p: Project, id: string, toAxisGroupId: string, index?: number): Project =>
        relocate(channelLevel, p, id, toAxisGroupId, index, 'move'),
    /** Inserts a copy (new id) of a channel at `index` of an axis group. */
    copyChannel: (p: Project, id: string, toAxisGroupId: string, index?: number): Project =>
        relocate(channelLevel, p, id, toAxisGroupId, index, 'copy'),
}

export interface MergeResult {
    project: Project
    added: number
    /** Specs the axis group already records (same symbol, port and target). */
    duplicates: number
}

/**
 * Add channel specs to an axis group in one step (at `index`, appended when omitted): Net IDs
 * the project does not know become new targets (named `targetName`), and specs the group
 * already records are skipped.
 */
export function mergeChannelSpecs(
    p: Project,
    axisGroupId: string,
    specs: ChannelSpec[],
    targetName = 'Target',
    index?: number,
): MergeResult {
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
    const project = mapAxisGroups({ ...p, targets }, (a) => (a.id === axisGroupId ? { ...a, channels: insertAt(a.channels, fresh, index) } : a))
    return { project, added: fresh.length, duplicates: specs.length - fresh.length }
}

/** Acquisitions of all valid channels of a scope file. */
export function fileAcquisitionCount(file: ScopeFile): number {
    return file.axisGroups.reduce((n, a) => n + acquisitionCount(a), 0)
}

/** Characters Windows does not allow in file names, plus control characters. */
// eslint-disable-next-line no-control-regex
const ILLEGAL_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g

export function sanitizeFileName(name: string): string {
    const cleaned = name.replace(ILLEGAL_FILE_CHARS, '_').trim().replace(/[. ]+$/, '')
    return cleaned || 'Scope'
}

export function projectAcquisitionCount(project: Project): number {
    return project.scopeFiles.reduce((n, f) => n + fileAcquisitionCount(f), 0)
}
