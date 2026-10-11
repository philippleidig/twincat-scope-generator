import { memo } from 'react'
import { ArrowRightLeft, Copy, GripVertical, Trash2 } from 'lucide-react'
import type { Channel, Target } from '@/domain/project'
import { validateTemplate } from '@/domain/pattern'
import { setChannelDragData } from '@/state/projectDrag'
import { useProjectStore } from '@/state/projectStore'
import { IconButton } from '@/ui/components/Button'
import { Menu } from '@/ui/components/Menu'
import { ChannelFields } from './ChannelFields'
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

/** One channel: drag handle, its fields, actions and the template error. */
export const ChannelRow = memo(function ChannelRow({ channel, index, targets, dropEdge, dropCopy = false }: ChannelRowProps) {
    const removeChannel = useProjectStore((s) => s.removeChannel)
    const duplicateChannel = useProjectStore((s) => s.duplicateChannel)

    const validation = channel.symbol.trim() ? validateTemplate(channel.symbol) : null
    const error = validation && !validation.valid ? validation.errors[0] : null

    return (
        <li className={`channel ${error ? 'channel--error' : ''}`} data-channel-index={index} {...dropAttrs(dropEdge, dropCopy)}>
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
                <ChannelFields channel={channel} targets={targets} error={error} />
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
        </li>
    )
})
