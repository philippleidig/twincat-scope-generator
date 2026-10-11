import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { AreaKind } from '@/catalog/model'
import type { BrowserPick } from '@/state/browserStore'
import { useBrowserStore } from '@/state/browserStore'
import { setPickDragData } from '@/state/actions'
import { AREA_LABEL } from './picks'

interface SymbolRowProps {
    pick: BrowserPick | null
    indent: number
    toggle?: ReactNode
    icon: ReactNode
    label: ReactNode
    title: string
    typeName?: string
    reason?: string
    /** Caveat for a recordable symbol (via reference, TcNoSymbol 'unused'). */
    warning?: string
    area?: AreaKind
    port?: number
    extra?: ReactNode
    role: string
    ariaExpanded?: boolean
    ariaLevel?: number
    onActivate?: () => void
}

/** One row in the tree or the result list: selectable, draggable, focusable for the inspector. */
export function SymbolRow({ pick, indent, toggle, icon, label, title, typeName, reason, warning, area, port, extra, role, ariaExpanded, ariaLevel, onActivate }: SymbolRowProps) {
    const selected = useBrowserStore((s) => (pick ? s.selection.has(pick.key) : false))
    const focused = useBrowserStore((s) => !!pick && s.focused?.key === pick.key)
    const toggleSelected = useBrowserStore((s) => s.toggleSelected)
    const setFocused = useBrowserStore((s) => s.setFocused)

    return (
        <div
            role={role}
            aria-selected={pick ? selected : undefined}
            aria-expanded={ariaExpanded}
            aria-level={ariaLevel}
            className={`tree-row ${selected ? 'tree-row--selected' : ''} ${focused ? 'tree-row--focused' : ''} ${!pick ? 'tree-row--muted' : ''}`}
            style={{ paddingLeft: 8 + indent * 16 }}
            title={[title, reason, warning].filter(Boolean).join(' — ')}
            draggable={!!pick}
            onDragStart={(e) => {
                if (!pick) return
                const { selection } = useBrowserStore.getState()
                // Dragging a selected row drags the whole selection.
                setPickDragData(e.dataTransfer, selection.has(pick.key) ? [...selection.values()] : [pick])
            }}
            onClick={() => pick && setFocused(pick)}
            onDoubleClick={onActivate}
        >
            {toggle}
            {pick ? (
                <input
                    type="checkbox"
                    className="tree-row__check"
                    checked={selected}
                    aria-label={`Select ${title}`}
                    onChange={() => toggleSelected(pick)}
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <span className="tree-row__check" />
            )}
            {icon}
            <span className="tree-row__label mono">{label}</span>
            {extra}
            {warning && <AlertTriangle size={13} className="tree-row__warning" aria-label={warning} role="img" />}
            {typeName && <span className={`type-tag ${reason ? 'type-tag--muted' : ''}`}>{typeName}</span>}
            {area && <span className={`area-dot area-dot--${area}`} title={AREA_LABEL[area]} />}
            {port !== undefined && <span className="tree-row__meta">{port}</span>}
        </div>
    )
}
