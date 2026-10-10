import { useEffect, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'
const KEY = 'twincat-scope-theme'

function read(): Theme {
    try {
        const v = localStorage.getItem(KEY)
        return v === 'light' || v === 'dark' ? v : 'system'
    } catch {
        return 'system'
    }
}

/** Theme preference, applied as data-theme on <html> ("system" follows the OS). */
export function useTheme(): [Theme, (t: Theme) => void] {
    const [theme, setTheme] = useState<Theme>(read)
    useEffect(() => {
        const root = document.documentElement
        if (theme === 'system') root.removeAttribute('data-theme')
        else root.setAttribute('data-theme', theme)
        try {
            localStorage.setItem(KEY, theme)
        } catch {
            // Storage blocked: the choice just won't survive a reload.
        }
    }, [theme])
    return [theme, setTheme]
}
