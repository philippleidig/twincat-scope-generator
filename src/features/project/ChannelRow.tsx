import { memo } from 'react'
import { ArrowRightLeft, Copy, GripVertical, Trash2 } from 'lucide-react'
import type { Channel, Target } from '@/domain/project'
import { SCOPE_DATA_TYPES, SCOPE_DATA_TYPE_IEC } from '@/domain/dataTypes'
import type { ScopeDataType } from '@/domain/dataTypes'
import { validateTemplate } from '@/domain/pattern'
import { templateAcquisitions } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import { IconButton } from '@/ui/components/Button'
import { Menu } from '@/ui/components/Menu'
import { useNumberDraft } from '@/ui/components/useNumberDraft'
import type { DropEdge } from './dnd'
import { setChannelDragData, setDragImage } from './dnd'
import { channelMoveItems } from './moveMenu'

const TYPE_OPTIONS = SCOPE_DATA_TYPES.map((t) => ({ value: t, label: `${SCOPE_DATA_TYPE_IEC[t]}` }))

interface ChannelRowProps {
    channel: Channel
    /** Position in its axis group; drops on the row resolve to it. */
    index: number
    targets: Target[]
    /** Drop indicator line above or below the row while something is dragged over it. */
    dropEdge?: DropEdge
    /** The pending drop copies (the indicator shows a "+"). */
    dropCopy?: boolean
}

/** One channel: symbol template, type, port and target, edited in place. */
export const ChannelRow = memo(function ChannelRow({ channel, index, targets, dropEdge, dropCopy }: ChannelRowProps) {
    const updateChannel = useProjectStore((s) => s.updateChannel)
    const removeChannel = useProjectStore((s) => s.removeChannel)
    const duplicateChannel = useProjectStore((s) => s.duplicateChannel)
    const moveChannel = useProjectStore((s) => s.moveChannel)

    const portInput = useNumberDraft(channel.port, (port) => port > 0 && updateChannel(channel.id, { port: Math.round(port) }))
    const validation = channel.symbol.trim() ? validateTemplate(channel.symbol) : null
    const count = templateAcquisitions(channel.symbol)
    const error = validation && !validation.valid ? validation.errors[0] : null

    return (
        <li
            className={`channel ${error ? 'channel--error' : ''}`}
            data-channel-index={index}
            data-drop={dropEdge}
            data-drop-copy={dropEdge && dropCopy ? '' : undefined}
        >
            <div className="channel__main">
                <span
                    className="drag-handle"
                    draggable
                    title="Drag to move · hold Ctrl (Option on macOS) to copy"
                    aria-hidden="true"
                    onDragStart={(e) => {
                        setChannelDragData(e.dataTransfer, channel.id)
                        setDragImage(e.dataTransfer, e.currentTarget, '.channel')
                    }}
                >
                    <GripVertical size={14} />
                </span>
                <input
                    className="input mono channel__symbol"
                    value={channel.symbol}
                    placeholder="MAIN.fbAxis[{i:1:4}].fActPos"
                    aria-label="Symbol path"
                    aria-invalid={!!error}
                    spellCheck={false}
                    onChange={(e) => updateChannel(channel.id, { symbol: e.target.value })}
                />
                {count > 1 && (
                    <span className="badge badge--accent channel__count" title={`Expands to ${count} acquisitions`}>
                        ×{count}
                    </span>
                )}
                <select
                    className="input select channel__type"
                    aria-label="Data type"
                    value={channel.dataType}
                    onChange={(e) => updateChannel(channel.id, { dataType: e.target.value as ScopeDataType })}
                >
                    {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <input
                    className="input mono channel__port"
                    min={1}
                    aria-label="ADS port"
                    list="port-presets"
                    {...portInput}
                />
                {targets.length > 1 && (
                    <select
                        className="input select channel__target"
                        aria-label="Target"
                        value={channel.targetId}
                        onChange={(e) => updateChannel(channel.id, { targetId: e.target.value })}
                    >
                        {targets.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                )}
                <div className="channel__actions">
                    <Menu
                        trigger={(props) => (
                            <IconButton label="Move channel to…" {...props}>
                                <ArrowRightLeft size={14} />
                            </IconButton>
                        )}
                        items={() => channelMoveItems(useProjectStore.getState().project, channel.id, { moveChannel })}
                    />
                    <IconButton label="Duplicate channel" onClick={() => duplicateChannel(channel.id)}>
                        <Copy size={14} />
                    </IconButton>
                    <IconButton label="Remove channel" variant="danger" onClick={() => removeChannel(channel.id)}>
                        <Trash2 size={14} />
                    </IconButton>
                </div>
            </div>
            {error && (
                <p className="channel__error" role="alert">
                    {error}
                </p>
            )}
        </li>
    )
})
