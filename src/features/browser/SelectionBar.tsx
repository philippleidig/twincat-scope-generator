import { ArrowRight, X } from 'lucide-react'
import { findAxisGroup } from '@/domain/project'
import { useBrowserStore } from '@/state/browserStore'
import { useProjectStore } from '@/state/projectStore'
import { addPicks, describeAddResult } from '@/state/actions'
import { toast } from '@/state/toastStore'
import { Button, IconButton } from '@/ui/components/Button'

/** Sticky footer: what is selected and where "Add" will put it. */
export function SelectionBar() {
    const selection = useBrowserStore((s) => s.selection)
    const clearSelection = useBrowserStore((s) => s.clearSelection)
    const project = useProjectStore((s) => s.project)
    const activeAxisGroupId = useProjectStore((s) => s.activeAxisGroupId)

    const file = project.scopeFiles.find((f) => f.axisGroups.some((a) => a.id === activeAxisGroupId))
    const group = activeAxisGroupId ? findAxisGroup(project, activeAxisGroupId) : undefined
    if (selection.size === 0) return null

    const add = () => {
        if (!group) {
            toast.warning('Pick an axis group in the project first (click its header).')
            return
        }
        const result = addPicks(group.id, [...selection.values()])
        toast[result.added > 0 ? 'success' : 'warning'](describeAddResult(result, group.name))
        if (result.added > 0) clearSelection()
    }

    return (
        <div className="selection-bar" role="region" aria-label="Selection">
            <span className="selection-bar__count">{selection.size} selected</span>
            <span className="selection-bar__target" title="Click an axis group header in the project to change where symbols are added">
                {group && file ? (
                    <>
                        to <strong>{file.name}</strong> › <strong>{group.name}</strong>
                    </>
                ) : (
                    'no axis group selected'
                )}
            </span>
            <IconButton label="Clear selection" onClick={clearSelection}>
                <X size={16} />
            </IconButton>
            <Button variant="primary" size="sm" onClick={add} disabled={!group}>
                Add to scope <ArrowRight size={15} />
            </Button>
        </div>
    )
}
