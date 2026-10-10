import { ChevronRight } from 'lucide-react'

interface DisclosureProps {
    open: boolean
    /** Name of what is expanded, for the accessible label ("Expand MAIN"). */
    label: string
    onToggle: () => void
}

/** Chevron button that expands or collapses a tree row or a card. */
export function Disclosure({ open, label, onToggle }: DisclosureProps) {
    return (
        <button
            type="button"
            className="disclosure"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
            onClick={(e) => {
                e.stopPropagation()
                onToggle()
            }}
        >
            <ChevronRight size={14} className={open ? 'disclosure__chevron disclosure__chevron--open' : 'disclosure__chevron'} />
        </button>
    )
}
