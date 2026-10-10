import { useMemo } from 'react'
import { useBrowserStore } from '@/state/browserStore'
import { useCatalogStore } from '@/state/catalogStore'
import { resolvePicks } from '@/state/actions'

/** Details of the focused symbol: full path and what adding it produces. */
export function Inspector() {
    const focused = useBrowserStore((s) => s.focused)
    const sources = useCatalogStore((s) => s.sources)
    const source = sources.find((x) => x.id === focused?.sourceId)
    // Recomputed only when the focus or the catalog changes, not on every render.
    const result = useMemo(() => (focused && source ? resolvePicks([focused]) : null), [focused, source])

    if (!focused || !source || !result) {
        return <div className="inspector inspector--empty">Select a symbol to see its details. Double-click folders and structs to expand.</div>
    }
    const { specs, truncated } = result
    return (
        <div className="inspector">
            <code className="inspector__path" title={focused.path}>
                {focused.path}
            </code>
            <span className="inspector__meta">
                {source.title} · port {specs[0]?.port ?? source.port} ·{' '}
                {specs.length === 0 ? 'nothing recordable' : `${specs.length}${truncated ? '+' : ''} channel${specs.length === 1 ? '' : 's'} when added`}
            </span>
        </div>
    )
}
