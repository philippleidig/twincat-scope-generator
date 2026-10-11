import { useId } from 'react'
import type { Channel } from '@/domain/project'
import { displayNameError, expandChannel, hasDisplayName, nameCounterHints } from '@/domain/channelStyle'
import { expandTemplate } from '@/domain/pattern'
import { useProjectStore } from '@/state/projectStore'
import { ColorPicker } from './ColorPicker'

/** Name preview: the first and last display names of a pattern channel. */
function namePreview(channel: Channel): string | null {
    const names = expandChannel(channel).map((a) => a.displayName)
    if (names.length === 0) return null
    return names.length === 1 ? names[0] : `${names[0]} … ${names[names.length - 1]} (${names.length})`
}

/** The second line of a channel row: display name (with counters) and colour. */
export function ChannelStyleEditor({ channel }: { channel: Channel }) {
    const updateChannel = useProjectStore((s) => s.updateChannel)
    const id = useId()
    const counters = nameCounterHints(channel.symbol)
    const named = hasDisplayName(channel)
    const error = named ? displayNameError(channel.name!, channel.symbol) : null
    const preview = named && !error ? namePreview(channel) : null
    const isPattern = counters.length > 0
    const hintId = `${id}-hint`

    return (
        <div className="channel-style">
            <div className="channel-style__name">
                <input
                    className="input channel-style__name-input"
                    value={channel.name ?? ''}
                    placeholder={expandTemplate(channel.symbol)[0] ?? 'Display name'}
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
                        onChange={(e) => updateChannel(channel.id, { colorMode: e.target.checked ? 'same' : 'palette' })}
                    />
                    Same colour for all
                </label>
            )}
        </div>
    )
}
