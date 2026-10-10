import { useState } from 'react'
import { ChevronRight, Copy, Crosshair, Plus, Trash2 } from 'lucide-react'
import type { AxisGroup, Target } from '@/domain/project'
import { acquisitionCount } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import { addChannels, addPicks, describeAddResult } from '@/state/actions'
import { parseTargetBrowserDrop } from '@/catalog/targetBrowserDrop'
import { toast } from '@/state/toastStore'
import { Button, IconButton } from '@/ui/components/Button'
import { PICK_MIME, draggedPicks } from '@/features/browser/picks'
import { ChannelRow } from './ChannelRow'

interface AxisGroupCardProps {
    group: AxisGroup
    targets: Target[]
    active: boolean
    canRemove: boolean
}

export function AxisGroupCard({ group, targets, active, canRemove }: AxisGroupCardProps) {
    const updateAxisGroup = useProjectStore((s) => s.updateAxisGroup)
    const removeAxisGroup = useProjectStore((s) => s.removeAxisGroup)
    const duplicateAxisGroup = useProjectStore((s) => s.duplicateAxisGroup)
    const addEmpty = useProjectStore((s) => s.addChannels)
    const setActiveAxisGroup = useProjectStore((s) => s.setActiveAxisGroup)
    const [open, setOpen] = useState(true)
    const [dropping, setDropping] = useState(false)
    const acquisitions = acquisitionCount(group)

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDropping(false)
        const picks = e.dataTransfer.types.includes(PICK_MIME) ? draggedPicks() : null
        if (picks) {
            const r = addPicks(group.id, picks)
            toast[r.added > 0 ? 'success' : 'warning'](describeAddResult(r, group.name))
            return
        }
        // Drag & drop straight from the TwinCAT Target Browser (XML as text).
        const dropped = parseTargetBrowserDrop(e.dataTransfer.getData('text/plain'))
        if (dropped.symbols.length > 0) {
            const r = addChannels(group.id, dropped.symbols)
            toast.success(describeAddResult({ ...r, truncated: false, empty: dropped.skipped.length }, group.name))
        } else {
            toast.warning(
                dropped.skipped.length > 0
                    ? `Cannot record ${dropped.skipped.join(', ')}: only numeric and BOOL symbols can be scoped.`
                    : 'Nothing to add: drop symbols from the symbol browser or the TwinCAT Target Browser.',
            )
        }
    }

    return (
        <section
            className={`axis-group ${active ? 'axis-group--active' : ''} ${dropping ? 'axis-group--drop' : ''}`}
            aria-label={`Axis group ${group.name}`}
            onDragOver={(e) => {
                if (e.dataTransfer.types.includes(PICK_MIME) || e.dataTransfer.types.includes('text/plain')) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                    setDropping(true)
                }
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false)
            }}
            onDrop={onDrop}
        >
            <header className="axis-group__header" onClick={() => setActiveAxisGroup(group.id)}>
                <button
                    type="button"
                    className="tree-toggle"
                    aria-expanded={open}
                    aria-label={`${open ? 'Collapse' : 'Expand'} ${group.name}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        setOpen((o) => !o)
                    }}
                >
                    <ChevronRight size={15} className={open ? 'chevron chevron--open' : 'chevron'} />
                </button>
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
                            {group.channels.map((c) => (
                                <ChannelRow key={c.id} channel={c} targets={targets} />
                            ))}
                        </ul>
                    )}
                    <Button variant="ghost" size="sm" icon={<Plus size={15} />} onClick={() => addEmpty(group.id, [{}])}>
                        Add channel
                    </Button>
                </div>
            )}
            {dropping && <div className="axis-group__drop">Drop to add to {group.name}</div>}
        </section>
    )
}
