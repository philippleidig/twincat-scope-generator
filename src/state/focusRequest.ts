/**
 * Focus requests across a re-render: an action that remounts or moves an element (a "Move to…"
 * menu entry) names the element that should get focus, and that element takes it when it renders.
 * Keys are plain strings (`focusKey.*`); nothing is looked up in the DOM by id.
 */
import type { RefObject } from 'react'
import { useEffect } from 'react'
import { create } from 'zustand'

const useFocusRequestStore = create<{ key: string | null }>(() => ({ key: null }))

export const focusKey = {
    channelMenu: (channelId: string) => `channel-menu:${channelId}`,
    fileTab: (fileId: string) => `file-tab:${fileId}`,
}

/** Ask the element registered under `key` to take focus once it has rendered. */
export function requestFocus(key: string): void {
    useFocusRequestStore.setState({ key })
}

/** Focus `ref` when focus is requested for `key` (now or later); the request is then used up. */
export function useFocusRequest(key: string, ref: RefObject<HTMLElement | null>): void {
    const requested = useFocusRequestStore((s) => s.key === key)
    useEffect(() => {
        if (!requested || !ref.current) return
        ref.current.focus()
        useFocusRequestStore.setState({ key: null })
    }, [requested, ref])
}
