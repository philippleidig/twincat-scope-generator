import { useBrowserStore } from '@/state/browserStore'
import { useCatalogStore } from '@/state/catalogStore'

/** Details of the focused symbol: full path, what adding it produces. */
export function Inspector() {
    const focused = useBrowserStore((s) => s.focused)
    const source = useCatalogStore((s) => s.sources.find((x) => x.id === focused?.sourceId))
    if (!focused || !source) {
        return <div className="inspector inspector--empty">Select a symbol to see its details. Double-click folders and structs to expand.</div>
    }
    const { candidates, truncated } = focused.candidates()
    return (
        <div className="inspector">
            <code className="inspector__path" title={focused.path}>
                {focused.path}
            </code>
            <span className="inspector__meta">
                {source.title} · port {candidates[0]?.port ?? source.port} ·{' '}
                {candidates.length === 0
                    ? 'nothing recordable'
                    : `${candidates.length}${truncated ? '+' : ''} channel${candidates.length === 1 ? '' : 's'} when added`}
            </span>
        </div>
    )
}
