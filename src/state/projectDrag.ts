/**
 * What can be dropped on the scope project, decoded from a DataTransfer. Payloads are plain JSON
 * under their own MIME types, so everything a drop needs travels with the drag; there is no
 * module-level drag state. During `dragover` only the types are readable, the data only on `drop`.
 */
import type { BrowserPick } from './browserStore'
import { PICK_MIME } from './browserStore'

export const CHANNEL_MIME = 'application/x-scope-channel'
export const AXIS_GROUP_MIME = 'application/x-scope-axis-group'

/** A channel, an axis group, browser picks or text (the XML the TwinCAT Target Browser drags). */
export type DragKind = 'channel' | 'axis-group' | 'picks' | 'text'

export type ProjectDrag =
    | { kind: 'channel'; id: string }
    | { kind: 'axis-group'; id: string }
    | { kind: 'picks'; picks: BrowserPick[] }
    | { kind: 'text'; text: string }

/** What is being dragged, from the types alone (all `dragover` can see). */
export function dragKind(types: readonly string[]): DragKind | null {
    if (types.includes(CHANNEL_MIME)) return 'channel'
    if (types.includes(AXIS_GROUP_MIME)) return 'axis-group'
    if (types.includes(PICK_MIME)) return 'picks'
    if (types.includes('text/plain')) return 'text'
    return null
}

export function setChannelDragData(dataTransfer: DataTransfer, channelId: string): void {
    dataTransfer.setData(CHANNEL_MIME, JSON.stringify({ channelId }))
    dataTransfer.effectAllowed = 'copyMove'
}

export function setAxisGroupDragData(dataTransfer: DataTransfer, axisGroupId: string): void {
    dataTransfer.setData(AXIS_GROUP_MIME, JSON.stringify({ axisGroupId }))
    dataTransfer.effectAllowed = 'copyMove'
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

function readId(data: Pick<DataTransfer, 'getData'>, mime: string, key: string): string | null {
    const parsed = parseJson(data.getData(mime))
    const id = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[key] : undefined
    return typeof id === 'string' ? id : null
}

/** The dropped payload, or null when it is not one of ours or is malformed. */
export function readProjectDrag(data: Pick<DataTransfer, 'types' | 'getData'>): ProjectDrag | null {
    switch (dragKind(data.types)) {
        case 'channel': {
            const id = readId(data, CHANNEL_MIME, 'channelId')
            return id ? { kind: 'channel', id } : null
        }
        case 'axis-group': {
            const id = readId(data, AXIS_GROUP_MIME, 'axisGroupId')
            return id ? { kind: 'axis-group', id } : null
        }
        case 'picks': {
            const parsed = parseJson(data.getData(PICK_MIME))
            const picks = Array.isArray(parsed)
                ? parsed.filter((p): p is BrowserPick => typeof p?.sourceId === 'string' && typeof p?.path === 'string')
                : []
            return { kind: 'picks', picks }
        }
        case 'text':
            return { kind: 'text', text: data.getData('text/plain') }
        default:
            return null
    }
}
