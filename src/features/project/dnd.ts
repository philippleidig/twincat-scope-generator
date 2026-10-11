/**
 * Drag & drop inside the scope project. Payloads are plain JSON under their own MIME types, so
 * everything a drop needs travels with the drag; there is no module-level drag state.
 * During `dragover` only the types are readable, the payload itself only on `drop`.
 */
import { PICK_MIME } from '@/state/browserStore'

export const CHANNEL_MIME = 'application/x-scope-channel'
export const AXIS_GROUP_MIME = 'application/x-scope-axis-group'

/** What is being dragged: a channel, an axis group, browser picks or text (TwinCAT Target Browser XML). */
export type DragKind = 'channel' | 'axis-group' | 'picks' | 'text'

export type DropEdge = 'before' | 'after'

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

function readId(data: Pick<DataTransfer, 'getData'>, mime: string, key: string): string | null {
    try {
        const parsed: unknown = JSON.parse(data.getData(mime))
        const id = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[key] : undefined
        return typeof id === 'string' ? id : null
    } catch {
        return null
    }
}

export const readChannelDrag = (data: Pick<DataTransfer, 'getData'>) => readId(data, CHANNEL_MIME, 'channelId')
export const readAxisGroupDrag = (data: Pick<DataTransfer, 'getData'>) => readId(data, AXIS_GROUP_MIME, 'axisGroupId')

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** Copy instead of move: Ctrl held (Windows/Linux) or Alt/Option (macOS), read from the drag event. */
export function isCopyDrag(e: { ctrlKey: boolean; altKey: boolean }): boolean {
    return (isMac() ? e.altKey : e.ctrlKey) === true
}

/** Whether the pointer is in the upper or lower half of `el`. */
export function dropEdge(clientY: number, el: Element): DropEdge {
    const rect = el.getBoundingClientRect()
    return clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

/** Use the whole row or card as drag image when dragging by its handle. */
export function setDragImage(dataTransfer: DataTransfer, handle: Element, selector: string): void {
    const el = handle.closest(selector)
    if (el && typeof dataTransfer.setDragImage === 'function') dataTransfer.setDragImage(el, 16, 16)
}
