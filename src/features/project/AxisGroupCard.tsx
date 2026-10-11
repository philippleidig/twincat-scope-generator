import { useState } from 'react'
import { ArrowRightLeft, Copy, Crosshair, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { AxisGroup, Target } from '@/domain/project'
import { acquisitionCount } from '@/domain/project'
import { applyDrop } from '@/state/actions'
import type { DragKind } from '@/state/projectDrag'
import { dragKind, readProjectDrag, setAxisGroupDragData } from '@/state/projectDrag'
import { useProjectStore } from '@/state/projectStore'
import { toast } from '@/state/toastStore'
import { Button, IconButton } from '@/ui/components/Button'
import { Disclosure } from '@/ui/components/Disclosure'
import { Menu } from '@/ui/components/Menu'
import { ChannelRow } from './ChannelRow'
import type { DropEdge } from './dnd'
import { dropAttrs, dropEdge, isCopyDrag, rowAt, setDragImage, usePendingDrop } from './dnd'
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

/**
 * Where a drag over the card would drop: next to a channel row, before/after the card itself
 * (axis groups), or anywhere else on the card (appended).
 */
type DropPlace = { at: 'row'; row: number; edge: DropEdge } | { at: 'card'; edge: DropEdge } | { at: 'body' }

interface DropTarget {
    kind: DragKind
    copy: boolean
    place: DropPlace
}

const dropKey = ({ kind, copy, place }: DropTarget) =>
    [kind, copy, place.at, place.at === 'row' ? place.row : '', place.at === 'body' ? '' : place.edge].join('|')

/** Where a drag event over the card would drop, or null when the card does not accept it. */
function dropTargetOf(e: React.DragEvent<HTMLElement>): DropTarget | null {
    const kind = dragKind(e.dataTransfer.types)
    if (!kind) return null
    const copy = kind === 'picks' || kind === 'text' || isCopyDrag(e)
    if (kind === 'axis-group') return { kind, copy, place: { at: 'card', edge: dropEdge(e.clientY, e.currentTarget) } }
    const list = e.target instanceof Element ? e.target.closest('.channel-list') : null
    const row = list && e.currentTarget.contains(list) ? rowAt(list, e.clientY) : null
    return { kind, copy, place: row ? { at: 'row', ...row } : { at: 'body' } }
}

/** Slot offset of a drop before/after an item. */
const after = (edge: DropEdge) => (edge === 'after' ? 1 : 0)

/** What the overlay says while a drag would append to the group. */
function overlayText(drop: DropTarget, groupName: string): string | null {
    if (drop.place.at !== 'body') return null
    if (drop.kind === 'channel') return `${drop.copy ? 'Copy' : 'Move'} to ${groupName}`
    return `Drop to add to ${groupName}`
}

export function AxisGroupCard({ group, fileId, index, targets, active, canRemove }: AxisGroupCardProps) {
    const updateAxisGroup = useProjectStore((s) => s.updateAxisGroup)
    const removeAxisGroup = useProjectStore((s) => s.removeAxisGroup)
    const duplicateAxisGroup = useProjectStore((s) => s.duplicateAxisGroup)
    const addEmpty = useProjectStore((s) => s.addChannels)
    const setActiveAxisGroup = useProjectStore((s) => s.setActiveAxisGroup)
    const [open, setOpen] = useState(true)
    const [drop, setDrop] = usePendingDrop(dropKey)
    const acquisitions = acquisitionCount(group)

    const onDrop = (e: React.DragEvent<HTMLElement>) => {
        const target = dropTargetOf(e)
        setDrop(null)
        if (!target) return
        e.preventDefault()
        const drag = readProjectDrag(e.dataTransfer)
        if (!drag) return
        const { place } = target
        const destination =
            place.at === 'card'
                ? { fileId, slot: index + after(place.edge) }
                : { fileId, axisGroupId: group.id, slot: place.at === 'row' ? place.row + after(place.edge) : undefined }
        const outcome = applyDrop(drag, destination, target.copy)
        if (outcome) toast[outcome.tone](outcome.message)
    }

    const overlay = drop && overlayText(drop, group.name)
    const rowDrop = drop?.place.at === 'row' ? drop.place : null
    const cardEdge = drop?.place.at === 'card' ? drop.place.edge : undefined

    return (
        <section
            className={`axis-group ${active ? 'axis-group--active' : ''} ${overlay ? 'axis-group--drop' : ''}`}
            aria-label={`Axis group ${group.name}`}
            data-axis-group-id={group.id}
            {...dropAttrs(cardEdge, !!drop?.copy)}
            onDragOver={(e) => {
                const target = dropTargetOf(e)
                if (!target) return
                e.preventDefault()
                e.dataTransfer.dropEffect = target.copy ? 'copy' : 'move'
                setDrop(target)
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
                        items={() => axisGroupMoveItems(group.id)}
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
                                    dropEdge={rowDrop?.row === i ? rowDrop.edge : undefined}
                                    dropCopy={rowDrop?.row === i && drop?.copy}
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
