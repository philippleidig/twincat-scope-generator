import { create } from 'zustand'

export type Tone = 'success' | 'warning' | 'info'
export interface Toast {
    id: number
    tone: Tone
    message: string
}

interface ToastState {
    toasts: Toast[]
    push: (tone: Tone, message: string) => void
    dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>()((set, get) => ({
    toasts: [],
    push: (tone, message) => {
        const id = nextId++
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message }] }))
        setTimeout(() => get().dismiss(id), tone === 'warning' ? 8000 : 4000)
    },
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
    success: (m: string) => useToasts.getState().push('success', m),
    warning: (m: string) => useToasts.getState().push('warning', m),
    info: (m: string) => useToasts.getState().push('info', m),
}

