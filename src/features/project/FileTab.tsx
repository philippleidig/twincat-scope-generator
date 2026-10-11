import { useState } from 'react'
import type { ScopeFile } from '@/domain/project'
import { fileAcquisitionCount } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import { toast } from '@/state/toastStore'
import { dragKind, isCopyDrag, readAxisGroupDrag, readChannelDrag } from './dnd'

interface FileTabProps {
    file: ScopeFile
    selected: boolean
}

/**
 * One scope file tab. Channels dropped on it are appended to the file's first axis group,
 * axis groups to the file itself.
 */
export function FileTab({ file, selected }: FileTabProps) {
    const selectFile = useProjectStore((s) => s.selectFile)
    const moveChannel = useProjectStore((s) => s.moveChannel)
    const copyChannel = useProjectStore((s) => s.copyChannel)
    const moveAxisGroup = useProjectStore((s) => s.moveAxisGroup)
    const copyAxisGroup = useProjectStore((s) => s.copyAxisGroup)
    const [drop, setDrop] = useState<{ copy: boolean } | null>(null)
    const firstGroup = file.axisGroups[0]

    const accepts = (e: React.DragEvent) => {
        const kind = dragKind(e.dataTransfer.types)
        return kind === 'axis-group' || (kind === 'channel' && !!firstGroup) ? kind : null
    }

    const onDrop = (e: React.DragEvent) => {
        const kind = accepts(e)
        setDrop(null)
        if (!kind) return
        e.preventDefault()
        const copy = isCopyDrag(e)
        const verb = copy ? 'Copied' : 'Moved'
        if (kind === 'channel') {
            const id = readChannelDrag(e.dataTransfer)
            if (!id) return
            ;(copy ? copyChannel : moveChannel)(id, firstGroup.id)
            toast.success(`${verb} channel to ${file.name} › ${firstGroup.name}`)
        } else {
            const id = readAxisGroupDrag(e.dataTransfer)
            if (!id) return
            ;(copy ? copyAxisGroup : moveAxisGroup)(id, file.id)
            toast.success(`${verb} axis group to ${file.name}`)
        }
    }

    return (
        <button
            type="button"
            role="tab"
            aria-selected={selected}
            className={`file-tab ${drop ? 'file-tab--drop' : ''}`}
            data-drop-copy={drop?.copy ? '' : undefined}
            onClick={() => selectFile(file.id)}
            onDragOver={(e) => {
                if (!accepts(e)) return
                e.preventDefault()
                const copy = isCopyDrag(e)
                e.dataTransfer.dropEffect = copy ? 'copy' : 'move'
                setDrop((d) => (d?.copy === copy ? d : { copy }))
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null)
            }}
            onDrop={onDrop}
        >
            {drop?.copy && <span className="drop-badge">+</span>}
            <span className="file-tab__name">{file.name || 'Untitled'}</span>
            <span className="file-tab__count">{fileAcquisitionCount(file)}</span>
        </button>
    )
}
