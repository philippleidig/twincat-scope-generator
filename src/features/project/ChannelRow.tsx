import { memo, useState } from 'react'
import { ArrowRightLeft, Copy, GripVertical, Trash2 } from 'lucide-react'
import type { Channel, Target } from '@/domain/project'
import { validateTemplate } from '@/domain/pattern'
import { displayNameError, hasDisplayName } from '@/domain/channelStyle'
import { setChannelDragData } from '@/state/projectDrag'
import { useProjectStore } from '@/state/projectStore'
import { IconButton } from '@/ui/components/Button'
import { Menu } from '@/ui/components/Menu'
import { ChannelFields } from './ChannelFields'
import { ChannelStyleEditor } from './ChannelStyleEditor'
import type { DropEdge } from './dnd'
import { dropAttrs, setDragImage } from './dnd'
import { channelMoveItems } from './moveMenu'

interface ChannelRowProps {
    channel: Channel
    /** Position in its axis group; drops over the row resolve to it. */
    index: number
    targets: Target[]
    /** Drop indicator line above or below the row while something is dragged over it. */
    dropEdge?: DropEdge
    /** The pending drop copies (the indicator shows a "+"). */
    dropCopy?: boolean
}

/** One channel: drag handle, name/colour toggle, its fields, actions, the template error and the name/colour editor. */
export const ChannelRow = memo(function ChannelRow({ channel, index, targets, dropEdge, dropCopy = false }: ChannelRowProps) {
    const removeChannel = useProjectStore((s) => s.removeChannel)
    const duplicateChannel = useProjectStore((s) => s.duplicateChannel)

    const validation = channel.symbol.trim() ? validateTemplate(channel.symbol) : null
    const error = validation && !validation.valid ? validation.errors[0] : null
    const [styleOpen, setStyleOpen] = useState(false)
    const named = hasDisplayName(channel)
    const nameInvalid = named && !!displayNameError(channel.name!, channel.symbol)

    return (
        <li
            className={`channel ${error ? 'channel--error' : ''}`}
            data-channel-index={index}
            data-channel-id={channel.id}
            {...dropAttrs(dropEdge, dropCopy)}
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
                <button
                    type="button"
                    className={`channel__swatch ${channel.color ? '' : 'channel__swatch--auto'} ${nameInvalid ? 'channel__swatch--invalid' : ''}`}
                    style={channel.color ? { background: channel.color } : undefined}
                    aria-label="Name and colour"
                    aria-expanded={styleOpen}
                    title={`${named ? `Name: ${channel.name}` : 'No name'} · colour: ${channel.color ?? 'automatic'}`}
                    onClick={() => setStyleOpen((o) => !o)}
                />
                <ChannelFields channel={channel} targets={targets} error={error} />
                {named && !styleOpen && (
                    <span className={`channel__name ${nameInvalid ? 'channel__name--invalid' : ''}`} title="Display name">
                        {channel.name}
                    </span>
                )}
                <div className="channel__actions">
                    <Menu
                        trigger={(props) => (
                            <IconButton label="Move channel to…" {...props}>
                                <ArrowRightLeft size={14} />
                            </IconButton>
                        )}
                        items={() => channelMoveItems(channel.id)}
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
            {styleOpen && <ChannelStyleEditor channel={channel} />}
        </li>
    )
})
