import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

export interface MenuItem {
    label: string
    icon?: ReactNode
    onSelect: () => void
    danger?: boolean
    disabled?: boolean
}

interface MenuProps {
    /** Renders the trigger; spread the props onto a button. */
    trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode
    items: MenuItem[]
    align?: 'start' | 'end'
}

export function Menu({ trigger, items, align = 'end' }: MenuProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const close = (e: Event) => {
            if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', close)
        document.addEventListener('keydown', close)
        return () => {
            document.removeEventListener('mousedown', close)
            document.removeEventListener('keydown', close)
        }
    }, [open])

    return (
        <div className="menu" ref={ref}>
            {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
            {open && (
                <div className={`menu__list menu__list--${align}`} role="menu">
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            className={`menu__item ${item.danger ? 'menu__item--danger' : ''}`}
                            onClick={() => {
                                setOpen(false)
                                item.onSelect()
                            }}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
