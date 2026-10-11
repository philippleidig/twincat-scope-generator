import type { ScopeFile } from '@/domain/project'
import { fileAcquisitionCount, scopeFileLabel } from '@/domain/project'
import { applyDrop } from '@/state/actions'
import { dragKind, readProjectDrag } from '@/state/projectDrag'
import { useProjectStore } from '@/state/projectStore'
import { toast } from '@/state/toastStore'
import { isCopyDrag, usePendingDrop } from './dnd'

interface FileTabProps {
    file: ScopeFile
    selected: boolean
}

const copyKey = (d: { copy: boolean }) => String(d.copy)

/**
 * One scope file tab. Channels dropped on it are appended to the file's first axis group,
 * axis groups to the file itself.
 */
export function FileTab({ file, selected }: FileTabProps) {
    const selectFile = useProjectStore((s) => s.selectFile)
    const [drop, setDrop] = usePendingDrop(copyKey)

    const accepts = (e: React.DragEvent) => {
        const kind = dragKind(e.dataTransfer.types)
        return kind === 'axis-group' || (kind === 'channel' && file.axisGroups.length > 0)
    }

    return (
        <button
            type="button"
            role="tab"
            aria-selected={selected}
            className={`file-tab ${drop ? 'file-tab--drop' : ''}`}
            onClick={() => selectFile(file.id)}
            onDragOver={(e) => {
                if (!accepts(e)) return
                e.preventDefault()
                const copy = isCopyDrag(e)
                e.dataTransfer.dropEffect = copy ? 'copy' : 'move'
                setDrop({ copy })
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null)
            }}
            onDrop={(e) => {
                setDrop(null)
                if (!accepts(e)) return
                e.preventDefault()
                const drag = readProjectDrag(e.dataTransfer)
                const outcome = drag && applyDrop(drag, { fileId: file.id }, isCopyDrag(e))
                if (outcome) toast[outcome.tone](outcome.message)
            }}
        >
            {drop?.copy && <span className="drop-badge">+</span>}
            <span className="file-tab__name">{scopeFileLabel(file)}</span>
            <span className="file-tab__count">{fileAcquisitionCount(file)}</span>
        </button>
    )
}
