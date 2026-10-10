import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'

interface DialogProps {
    open: boolean
    onClose: () => void
    title: string
    description?: ReactNode
    children: ReactNode
    footer?: ReactNode
    width?: number
}

/** Modal dialog on the native <dialog> element: focus trapping, Esc and the backdrop come for free. */
export function Dialog({ open, onClose, title, description, children, footer, width = 560 }: DialogProps) {
    const ref = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        if (open && !el.open) {
            // jsdom lacks showModal; fall back to the open attribute.
            if (typeof el.showModal === 'function') el.showModal()
            else el.setAttribute('open', '')
        } else if (!open && el.open) {
            if (typeof el.close === 'function') el.close()
            else el.removeAttribute('open')
        }
    }, [open])

    return (
        <dialog
            ref={ref}
            className="dialog"
            style={{ width: `min(${width}px, calc(100vw - 32px))` }}
            aria-labelledby="dialog-title"
            onClose={onClose}
            onCancel={(e) => {
                e.preventDefault()
                onClose()
            }}
            onClick={(e) => {
                if (e.target === ref.current) onClose()
            }}
        >
            {open && (
                <div className="dialog__body">
                    <header className="dialog__header">
                        <div>
                            <h2 id="dialog-title">{title}</h2>
                            {description && <p className="dialog__description">{description}</p>}
                        </div>
                        <IconButton label="Close" onClick={onClose}>
                            <X size={18} />
                        </IconButton>
                    </header>
                    <div className="dialog__content scroll">{children}</div>
                    {footer && <footer className="dialog__footer">{footer}</footer>}
                </div>
            )}
        </dialog>
    )
}
