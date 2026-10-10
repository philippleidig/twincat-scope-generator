import { useState } from 'react'
import { AlertTriangle, Settings2, Trash2 } from 'lucide-react'
import type { SymbolSource } from '@/catalog/model'
import { useCatalogStore } from '@/state/catalogStore'
import { IconButton } from '@/ui/components/Button'
import { NumberField, TextField } from '@/ui/components/Field'
import { SourceIcon } from './symbolIcons'

/** One imported source with its ADS settings (port, path prefix, Net ID) editable in place. */
export function SourceCard({ source }: { source: SymbolSource }) {
    const updateSource = useCatalogStore((s) => s.updateSource)
    const removeSource = useCatalogStore((s) => s.removeSource)
    const [editing, setEditing] = useState(false)

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
                    <NumberField
                        label="ADS port"
                        value={source.port}
                        min={1}
                        onValueChange={(port) => port > 0 && updateSource(source.id, { port })}
                    />
                    <TextField
                        label="Path prefix"
                        mono
                        value={source.pathPrefix}
                        placeholder="(none)"
                        hint={source.kind === 'TcCOM' ? 'Instance name of the TcCOM object' : 'Prepended to every symbol path'}
                        onChange={(e) => updateSource(source.id, { pathPrefix: e.target.value.trim() })}
                    />
                    <TextField
                        label="Target AMS Net ID"
                        mono
                        value={source.amsNetId ?? ''}
                        placeholder="Project default"
                        onChange={(e) => updateSource(source.id, { amsNetId: e.target.value.trim() || undefined })}
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
