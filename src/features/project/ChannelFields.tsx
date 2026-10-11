import type { Channel, Target } from '@/domain/project'
import { SCOPE_DATA_TYPES, SCOPE_DATA_TYPE_IEC } from '@/domain/dataTypes'
import type { ScopeDataType } from '@/domain/dataTypes'
import { templateAcquisitions } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import { useNumberDraft } from '@/ui/components/useNumberDraft'

const TYPE_OPTIONS = SCOPE_DATA_TYPES.map((t) => ({ value: t, label: `${SCOPE_DATA_TYPE_IEC[t]}` }))

interface ChannelFieldsProps {
    channel: Channel
    targets: Target[]
    /** Template error, shown by the row; marks the symbol field invalid. */
    error: string | null
}

/** The editable fields of a channel: symbol template, data type, port and target. */
export function ChannelFields({ channel, targets, error }: ChannelFieldsProps) {
    const updateChannel = useProjectStore((s) => s.updateChannel)
    const portInput = useNumberDraft(channel.port, (port) => port > 0 && updateChannel(channel.id, { port: Math.round(port) }))
    const count = templateAcquisitions(channel.symbol)

    return (
        <>
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
            <input className="input mono channel__port" min={1} aria-label="ADS port" list="port-presets" {...portInput} />
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
        </>
    )
}
