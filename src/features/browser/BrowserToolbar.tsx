import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import type { ScopeDataType } from '@/domain/dataTypes'
import type { AreaKind } from '@/catalog/model'
import { isFiltering, useBrowserStore } from '@/state/browserStore'
import { AREA_LABEL } from './picks'

const TYPE_FILTERS: Array<{ label: string; types: ScopeDataType[] }> = [
    { label: 'BOOL', types: ['BIT'] },
    { label: 'Integer', types: ['INT8', 'INT16', 'INT32', 'INT64', 'UINT8', 'UINT16', 'UINT32', 'UINT64'] },
    { label: 'Real', types: ['REAL32', 'REAL64'] },
]
const AREAS: AreaKind[] = ['input', 'output', 'internal', 'parameter']

export function BrowserToolbar() {
    const state = useBrowserStore()
    const inputRef = useRef<HTMLInputElement>(null)

    // "/" focuses the search box, as in most code browsers.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(target.tagName)) {
                e.preventDefault()
                inputRef.current?.focus()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    const typeFilterOn = (types: ScopeDataType[]) => types.every((t) => state.scopeTypes.has(t))
    const toggleTypeFilter = (types: ScopeDataType[]) => {
        const on = typeFilterOn(types)
        for (const t of types) if (state.scopeTypes.has(t) === on) state.toggleScopeType(t)
    }

    return (
        <div className="browser-toolbar">
            <div className="search-box">
                <Search size={16} className="search-box__icon" aria-hidden />
                <input
                    ref={inputRef}
                    type="search"
                    className="search-box__input"
                    placeholder="Search… e.g. ActPos, *.fActPos, type:LREAL"
                    aria-label="Search symbols"
                    value={state.query}
                    onChange={(e) => state.setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && state.setQuery('')}
                />
                <kbd className="search-box__kbd" aria-hidden>
                    /
                </kbd>
            </div>
            <div className="filter-row" role="group" aria-label="Filters">
                {TYPE_FILTERS.map((f) => (
                    <button key={f.label} type="button" className="chip" aria-pressed={typeFilterOn(f.types)} onClick={() => toggleTypeFilter(f.types)}>
                        {f.label}
                    </button>
                ))}
                <span className="filter-row__sep" />
                {AREAS.map((a) => (
                    <button key={a} type="button" className="chip" aria-pressed={state.areas.has(a)} onClick={() => state.toggleArea(a)}>
                        <span className={`area-dot area-dot--${a}`} />
                        {AREA_LABEL[a]}
                    </button>
                ))}
                <span className="filter-row__sep" />
                <button type="button" className="chip" aria-pressed={state.recordableOnly} onClick={() => state.setRecordableOnly(!state.recordableOnly)}>
                    Recordable only
                </button>
                {isFiltering(state) && (
                    <button type="button" className="chip chip--clear" onClick={state.clearFilters}>
                        <X size={13} /> Clear
                    </button>
                )}
            </div>
        </div>
    )
}
