/**
 * Focus requests across a re-render: an action that remounts or moves an element (a "Move to…"
 * menu entry) names the element that should get focus, and that element takes it when it renders.
 * Keys are plain strings (`focusKey.*`); nothing is looked up in the DOM by id.
 */
import type { RefObject } from 'react'
import { useLayoutEffect } from 'react'
import { create } from 'zustand'

const useFocusRequestStore = create<{ key: string | null }>(() => ({ key: null }))

export const focusKey = {
    channelMenu: (channelId: string) => `channel-menu:${channelId}`,
    fileTab: (fileId: string) => `file-tab:${fileId}`,
}

/**
 * Ask the element registered under `key` to take focus as the current change renders. A request
 * nobody takes up then (the element is not shown, e.g. in a collapsed axis group) is dropped, so it
 * cannot steal focus later.
 */
export function requestFocus(key: string): void {
    useFocusRequestStore.setState({ key })
    setTimeout(() => {
        if (useFocusRequestStore.getState().key === key) useFocusRequestStore.setState({ key: null })
    })
}

/** Focus `ref` when focus is requested for `key` and it renders with that change; the request is then used up. */
export function useFocusRequest(key: string, ref: RefObject<HTMLElement | null>): void {
    const requested = useFocusRequestStore((s) => s.key === key)
    // A layout effect: it runs within the render of the change, before the request is dropped.
    useLayoutEffect(() => {
        if (!requested || !ref.current) return
        ref.current.focus()
        useFocusRequestStore.setState({ key: null })
    }, [requested, ref])
}
