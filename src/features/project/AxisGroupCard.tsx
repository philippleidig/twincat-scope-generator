import { useState } from 'react'
import { ArrowRightLeft, Copy, Crosshair, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { AxisGroup, Target } from '@/domain/project'
import { acquisitionCount } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import { describeAddResult, dropOnAxisGroup } from '@/state/actions'
import { toast } from '@/state/toastStore'
import { Button, IconButton } from '@/ui/components/Button'
import { Disclosure } from '@/ui/components/Disclosure'
import { Menu } from '@/ui/components/Menu'
import { ChannelRow } from './ChannelRow'
import type { DragKind, DropEdge } from './dnd'
import { dragKind, dropEdge, isCopyDrag, readAxisGroupDrag, readChannelDrag, setAxisGroupDragData, setDragImage } from './dnd'
import { axisGroupMoveItems } from './moveMenu'

interface AxisGroupCardProps {
    group: AxisGroup
    /** Scope file the group belongs to and its position there (target of axis group drops). */
    fileId: string
    index: number
    targets: Target[]
    active: boolean
    canRemove: boolean
}

/** A drag hovering the card: over a channel row (`row`/`edge`), or the card as a whole. */
interface DropTarget {
    kind: DragKind
    copy: boolean
    row?: number
    edge?: DropEdge
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
    a === b || (!!a && !!b && a.kind === b.kind && a.copy === b.copy && a.row === b.row && a.edge === b.edge)

/** Where a drag event over the card would drop, or null when the card does not accept it. */
function dropTargetOf(e: React.DragEvent<HTMLElement>): DropTarget | null {
    const kind = dragKind(e.dataTransfer.types)
    if (!kind) return null
    const copy = kind === 'picks' || kind === 'text' || isCopyDrag(e)
    if (kind === 'axis-group') return { kind, copy, edge: dropEdge(e.clientY, e.currentTarget) }
    const row = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-channel-index]') : null
    if (!row || !e.currentTarget.contains(row)) return { kind, copy }
    return { kind, copy, row: Number(row.dataset.channelIndex), edge: dropEdge(e.clientY, row) }
}

export function AxisGroupCard({ group, fileId, index, targets, active, canRemove }: AxisGroupCardProps) {
    const updateAxisGroup = useProjectStore((s) => s.updateAxisGroup)
    const removeAxisGroup = useProjectStore((s) => s.removeAxisGroup)
    const duplicateAxisGroup = useProjectStore((s) => s.duplicateAxisGroup)
    const addEmpty = useProjectStore((s) => s.addChannels)
    const setActiveAxisGroup = useProjectStore((s) => s.setActiveAxisGroup)
    const moveChannel = useProjectStore((s) => s.moveChannel)
    const copyChannel = useProjectStore((s) => s.copyChannel)
    const moveAxisGroup = useProjectStore((s) => s.moveAxisGroup)
    const copyAxisGroup = useProjectStore((s) => s.copyAxisGroup)
    const [open, setOpen] = useState(true)
    const [drop, setDrop] = useState<DropTarget | null>(null)
    const acquisitions = acquisitionCount(group)

    const onDrop = (e: React.DragEvent<HTMLElement>) => {
        const target = dropTargetOf(e)
        setDrop(null)
        if (!target) return
        e.preventDefault()
        const slot = target.row === undefined ? undefined : target.row + (target.edge === 'after' ? 1 : 0)
        if (target.kind === 'channel') {
            const id = readChannelDrag(e.dataTransfer)
            if (id) (target.copy ? copyChannel : moveChannel)(id, group.id, slot)
        } else if (target.kind === 'axis-group') {
            const id = readAxisGroupDrag(e.dataTransfer)
            if (id) (target.copy ? copyAxisGroup : moveAxisGroup)(id, fileId, index + (target.edge === 'after' ? 1 : 0))
        } else {
            const result = dropOnAxisGroup(group.id, e.dataTransfer, slot)
            toast[result.added > 0 ? 'success' : 'warning'](describeAddResult(result, group.name))
        }
    }

    const overlay =
        drop && drop.row === undefined && drop.kind !== 'axis-group'
            ? drop.kind === 'channel'
                ? `${drop.copy ? 'Copy' : 'Move'} to ${group.name}`
                : `Drop to add to ${group.name}`
            : null
    const groupEdge = drop?.kind === 'axis-group' ? drop.edge : undefined

    return (
        <section
            className={`axis-group ${active ? 'axis-group--active' : ''} ${overlay ? 'axis-group--drop' : ''}`}
            aria-label={`Axis group ${group.name}`}
            data-drop={groupEdge}
            data-drop-copy={groupEdge && drop?.copy ? '' : undefined}
            onDragOver={(e) => {
                const target = dropTargetOf(e)
                if (!target) return
                e.preventDefault()
                e.dataTransfer.dropEffect = target.copy ? 'copy' : 'move'
                setDrop((d) => (sameTarget(d, target) ? d : target))
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null)
            }}
            onDrop={onDrop}
        >
            <header className="axis-group__header" onClick={() => setActiveAxisGroup(group.id)}>
                <span
                    className="drag-handle"
                    draggable
                    title="Drag to reorder or onto a file tab · hold Ctrl (Option on macOS) to copy"
                    aria-hidden="true"
                    onDragStart={(e) => {
                        setAxisGroupDragData(e.dataTransfer, group.id)
                        setDragImage(e.dataTransfer, e.currentTarget, '.axis-group')
                    }}
                >
                    <GripVertical size={15} />
                </span>
                <Disclosure open={open} label={group.name} onToggle={() => setOpen((o) => !o)} />
                <input
                    className="axis-group__name"
                    value={group.name}
                    aria-label="Axis group name"
                    onChange={(e) => updateAxisGroup(group.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => setActiveAxisGroup(group.id)}
                />
                <span className="badge" title="Channels">
                    {group.channels.length} ch
                </span>
                <span className="badge badge--accent" title="Acquisitions after pattern expansion">
                    {acquisitions} acq
                </span>
                <button
                    type="button"
                    className={`target-pill ${active ? 'target-pill--on' : ''}`}
                    aria-pressed={active}
                    title="Symbols added from the browser go here"
                    onClick={(e) => {
                        e.stopPropagation()
                        setActiveAxisGroup(group.id)
                    }}
                >
                    <Crosshair size={13} /> {active ? 'Adding here' : 'Add here'}
                </button>
                <div className="axis-group__actions" onClick={(e) => e.stopPropagation()}>
                    <Menu
                        trigger={(props) => (
                            <IconButton label="Move axis group to…" {...props}>
                                <ArrowRightLeft size={14} />
                            </IconButton>
                        )}
                        items={() => axisGroupMoveItems(useProjectStore.getState().project, group.id, { moveAxisGroup })}
                    />
                    <IconButton label="Duplicate axis group" onClick={() => duplicateAxisGroup(group.id)}>
                        <Copy size={14} />
                    </IconButton>
                    <IconButton label="Remove axis group" variant="danger" disabled={!canRemove} onClick={() => removeAxisGroup(group.id)}>
                        <Trash2 size={14} />
                    </IconButton>
                </div>
            </header>
            {open && (
                <div className="axis-group__body">
                    {group.channels.length === 0 ? (
                        <p className="axis-group__empty">
                            Drag symbols here from the browser or the TwinCAT Target Browser — or add a channel manually.
                        </p>
                    ) : (
                        <ul className="channel-list">
                            {group.channels.map((c, i) => (
                                <ChannelRow
                                    key={c.id}
                                    channel={c}
                                    index={i}
                                    targets={targets}
                                    dropEdge={drop?.row === i ? drop.edge : undefined}
                                    dropCopy={drop?.row === i && drop.copy}
                                />
                            ))}
                        </ul>
                    )}
                    <Button variant="ghost" size="sm" icon={<Plus size={15} />} onClick={() => addEmpty(group.id, [{}])}>
                        Add channel
                    </Button>
                </div>
            )}
            {overlay && (
                <div className="axis-group__drop">
                    <span>
                        {drop?.copy && drop.kind === 'channel' && <span className="drop-badge">+</span>}
                        {overlay}
                    </span>
                </div>
            )}
        </section>
    )
}
