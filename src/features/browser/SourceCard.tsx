import { useState } from 'react'
import { AlertTriangle, Settings2, Trash2 } from 'lucide-react'
import type { SymbolSource } from '@/catalog/model'
import { amsNetIdError } from '@/domain/project'
import { useCatalogStore } from '@/state/catalogStore'
import { IconButton } from '@/ui/components/Button'
import { TextField } from '@/ui/components/Field'
import { useDraft } from '@/ui/components/useDraft'
import { SourceIcon } from './symbolIcons'

/**
 * One imported source with its ADS settings (port, path prefix, Net ID). Changes apply on
 * blur or Enter: each one re-indexes the source.
 */
export function SourceCard({ source }: { source: SymbolSource }) {
    const updateSource = useCatalogStore((s) => s.updateSource)
    const removeSource = useCatalogStore((s) => s.removeSource)
    const [editing, setEditing] = useState(false)
    const port = useDraft(String(source.port), (text) => {
        const n = Number(text)
        if (Number.isInteger(n) && n > 0) updateSource(source.id, { port: n })
    })
    const prefix = useDraft(source.pathPrefix, (text) => updateSource(source.id, { pathPrefix: text.trim() }))
    const netId = useDraft(source.amsNetId ?? '', (text) => updateSource(source.id, { amsNetId: text.trim() || undefined }))

    return (
        <li className="source-card">
            <div className="source-card__head">
                <span className={`source-card__icon source-card__icon--${source.kind}`}>
                    <SourceIcon kind={source.kind} />
                </span>
                <div className="source-card__titles">
                    <span className="source-card__title">{source.title}</span>
                    <span className="source-card__sub" title={source.fileName}>
                        {source.kind} · port {source.port}
                        {source.amsNetId ? ` · ${source.amsNetId}` : ''} · {source.roots.length.toLocaleString()} symbols
                    </span>
                </div>
                {source.warnings.length > 0 && (
                    <span className="source-card__warn" title={source.warnings.join('\n')} aria-label={`${source.warnings.length} notes`}>
                        <AlertTriangle size={15} />
                    </span>
                )}
                <IconButton label={`Settings for ${source.title}`} aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
                    <Settings2 size={15} />
                </IconButton>
                <IconButton label={`Remove ${source.title}`} variant="danger" onClick={() => removeSource(source.id)}>
                    <Trash2 size={15} />
                </IconButton>
            </div>
            {editing && (
                <div className="source-card__settings">
                    <TextField label="ADS port" inputMode="numeric" {...port} />
                    <TextField
                        label="Path prefix"
                        mono
                        placeholder="(none)"
                        hint={source.kind === 'TcCOM' ? "The TcCOM object's name" : 'Prepended to every symbol path'}
                        {...prefix}
                    />
                    <TextField
                        label="Target AMS Net ID"
                        mono
                        placeholder="Project default"
                        error={netId.value.trim() ? amsNetIdError(netId.value) : null}
                        {...netId}
                    />
                    {source.warnings.length > 0 && (
                        <ul className="source-card__notes">
                            {source.warnings.map((w) => (
                                <li key={w}>{w}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </li>
    )
}
