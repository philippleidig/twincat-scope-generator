/**
 * Pointer-side helpers for drag & drop in the scope project: where a drop lands and how the
 * pending drop is shown. Payloads and the drop itself live in `state/projectDrag` and `state/actions`.
 */
import { useCallback, useEffect, useState } from 'react'

export type DropEdge = 'before' | 'after'

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

/**
 * The channel row a drop over `list` refers to, by the pointer's height: before the first row
 * whose middle is below the pointer, else after the last row. Works in the gaps between rows too.
 */
export function rowAt(list: Element, clientY: number): { row: number; edge: DropEdge } | null {
    const rows = [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.channelIndex !== undefined)
    if (rows.length === 0) return null
    const before = rows.find((row) => dropEdge(clientY, row) === 'before')
    const row = before ?? rows[rows.length - 1]
    return { row: Number(row.dataset.channelIndex), edge: before ? 'before' : 'after' }
}

/** Attributes that draw the drop indicator line (and the "+" while copying) on a row or card. */
export function dropAttrs(edge: DropEdge | undefined, copy: boolean) {
    return { 'data-drop': edge, 'data-drop-copy': edge && copy ? '' : undefined }
}

/** Use the whole row or card as drag image when dragging by its handle. */
export function setDragImage(dataTransfer: DataTransfer, handle: Element, selector: string): void {
    const el = handle.closest(selector)
    if (el && typeof dataTransfer.setDragImage === 'function') dataTransfer.setDragImage(el, 16, 16)
}

/**
 * State of a drag hovering a drop target. `update` keeps the previous object while `key` is
 * unchanged (dragover fires continuously); the state clears when any drag ends or drops anywhere,
 * so a cancelled drag (Escape) leaves no indicator behind.
 */
export function usePendingDrop<T>(key: (t: T) => string) {
    const [drop, setDrop] = useState<T | null>(null)
    const pending = drop !== null

    useEffect(() => {
        if (!pending) return
        const clear = () => setDrop(null)
        document.addEventListener('dragend', clear)
        document.addEventListener('drop', clear)
        return () => {
            document.removeEventListener('dragend', clear)
            document.removeEventListener('drop', clear)
        }
    }, [pending])

    const update = useCallback(
        (next: T | null) => setDrop((d) => (d !== null && next !== null && key(d) === key(next) ? d : next)),
        [key],
    )
    return [drop, update] as const
}
