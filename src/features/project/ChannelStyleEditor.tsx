import { useId } from 'react'
import type { Channel } from '@/domain/project'
import { templateAcquisitions } from '@/domain/project'
import { channelNameError, expandChannelAt, hasDisplayName, nameCounterHints } from '@/domain/channelStyle'
import { useProjectStore } from '@/state/projectStore'
import { ColorPicker } from './ColorPicker'

/** Name preview: the first and last display names of a pattern channel (without expanding the rest). */
function namePreview(channel: Channel, count: number): string | null {
    const first = expandChannelAt(channel, 0)?.displayName
    if (first === undefined) return null
    return count === 1 ? first : `${first} … ${expandChannelAt(channel, count - 1)!.displayName} (${count})`
}

/** The second line of a channel row: display name (with counters) and colour. */
export function ChannelStyleEditor({ channel }: { channel: Channel }) {
    const updateChannel = useProjectStore((s) => s.updateChannel)
    const hintId = useId()
    const counters = nameCounterHints(channel.symbol)
    const count = templateAcquisitions(channel.symbol)
    const named = hasDisplayName(channel)
    const error = channelNameError(channel)
    const preview = named && !error ? namePreview(channel, count) : null
    const isPattern = counters.length > 0

    return (
        <div className="channel-style">
            <div className="channel-style__name">
                <input
                    className="input channel-style__name-input"
                    value={channel.name ?? ''}
                    // Without a name the channel shows its symbol path: the effective name.
                    placeholder={expandChannelAt(channel, 0)?.symbolName ?? 'Display name'}
                    aria-label="Display name"
                    aria-invalid={!!error}
                    aria-describedby={hintId}
                    spellCheck={false}
                    onChange={(e) => updateChannel(channel.id, { name: e.target.value })}
                />
                {error ? (
                    <p id={hintId} className="channel-style__hint channel-style__hint--error" role="alert">
                        {error}
                    </p>
                ) : (
                    <p id={hintId} className="channel-style__hint">
                        {preview && <span className="channel-style__preview">→ {preview}</span>}
                        {isPattern ? `Counters: ${counters.join(', ')}` : !named && 'Empty: the symbol path'}
                    </p>
                )}
            </div>
            <ColorPicker value={channel.color} onChange={(color) => updateChannel(channel.id, { color })} />
            {isPattern && channel.color && (
                <label className="channel-style__same">
                    <input
                        type="checkbox"
                        checked={channel.colorMode === 'same'}
                        onChange={(e) => updateChannel(channel.id, { colorMode: e.target.checked ? 'same' : undefined })}
                    />
                    Same colour for all
                </label>
            )}
        </div>
    )
}
