import { Fragment, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { List, ListTree, Search, X } from 'lucide-react'
import type { AreaKind, SourceKind } from '@/catalog/model'
import type { PlcScope } from '@/catalog/search'
import { facets } from '@/catalog/search'
import { useCatalogStore } from '@/state/catalogStore'
import { hasCustomFilters, useBrowserStore } from '@/state/browserStore'
import { SourceIcon } from './symbolIcons'

const KINDS: Array<{ kind: SourceKind; label: string }> = [
    { kind: 'PLC', label: 'PLC' },
    { kind: 'NC', label: 'NC' },
    { kind: 'IO', label: 'I/O' },
    { kind: 'TcCOM', label: 'TcCOM' },
]
const PLC_SCOPES: Array<{ scope: PlcScope; label: string; title: string }> = [
    { scope: 'global', label: 'Global', title: 'PLC variables of global variable lists (GVLs)' },
    { scope: 'program', label: 'Programs', title: 'PLC variables of programs (MAIN, …) and the function block instances in them' },
]
const AREAS: Array<{ area: AreaKind; label: string }> = [
    { area: 'input', label: 'Inputs' },
    { area: 'output', label: 'Outputs' },
]
const SYSTEM_TITLE =
    "Leave out TwinCAT's own symbols: TwinCAT_SystemInfoVarList, Global_Version, TwinCAT_PreventOnlineChangeGvl, TC_EVENTS, the EtherCAT frame state (Inputs.Frm0*, Outputs.Frm0*) and each box's WcState and InputToggle"

const Count = ({ n }: { n: number }) => <span className="chip__count">{n.toLocaleString()}</span>

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

    const index = useCatalogStore((s) => s.index)
    const counts = useMemo(() => facets(index, state.hideSystem), [index, state.hideSystem])

    // Only filters that can narrow what is imported, each group separated from the next.
    const groups: Array<{ key: string; chips: ReactNode[] }> = []
    const kinds = KINDS.filter((k) => counts.kinds.has(k.kind))
    if (kinds.length > 1) {
        groups.push({
            key: 'kinds',
            chips: kinds.map(({ kind, label }) => (
                <button key={kind} type="button" className="chip" aria-pressed={state.kinds.has(kind)} onClick={() => state.toggleKind(kind)}>
                    <SourceIcon kind={kind} />
                    {label}
                    <Count n={counts.kinds.get(kind) ?? 0} />
                </button>
            )),
        })
    }
    if (PLC_SCOPES.every((p) => counts.plcScopes.has(p.scope))) {
        groups.push({
            key: 'plc',
            chips: PLC_SCOPES.map(({ scope, label, title }) => (
                <button key={scope} type="button" className="chip" title={title} aria-pressed={state.plcScopes.has(scope)} onClick={() => state.togglePlcScope(scope)}>
                    {label}
                    <Count n={counts.plcScopes.get(scope) ?? 0} />
                </button>
            )),
        })
    }
    const areas = AREAS.filter((a) => counts.areas.has(a.area))
    if (areas.length > 0) {
        groups.push({
            key: 'areas',
            chips: areas.map(({ area, label }) => (
                <button key={area} type="button" className="chip" aria-pressed={state.areas.has(area)} onClick={() => state.toggleArea(area)}>
                    <span className={`area-dot area-dot--${area}`} />
                    {label}
                    <Count n={counts.areas.get(area) ?? 0} />
                </button>
            )),
        })
    }
    if (counts.system > 0) {
        groups.push({
            key: 'system',
            chips: [
                <button key="system" type="button" className="chip" title={SYSTEM_TITLE} aria-pressed={state.hideSystem} onClick={() => state.setHideSystem(!state.hideSystem)}>
                    Hide system
                    <Count n={counts.system} />
                </button>,
            ],
        })
    }

    return (
        <div className="browser-toolbar">
            <div className="browser-toolbar__row">
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
                <div className="segmented" role="group" aria-label="Browser view">
                    <button type="button" aria-pressed={state.view === 'tree'} onClick={() => state.setView('tree')} title="Hierarchical tree">
                        <ListTree size={14} aria-hidden /> <span className="narrow-hide">Tree</span>
                    </button>
                    <button
                        type="button"
                        aria-pressed={state.view === 'list'}
                        onClick={() => state.setView('list')}
                        title="Flat list of every symbol, sorted by path"
                    >
                        <List size={14} aria-hidden /> <span className="narrow-hide">List</span>
                    </button>
                </div>
            </div>
            {(groups.length > 0 || hasCustomFilters(state)) && (
                <div className="filter-row" role="group" aria-label="Filters">
                    {groups.map((g, i) => (
                        <Fragment key={g.key}>
                            {i > 0 && <span className="filter-row__sep" />}
                            {g.chips}
                        </Fragment>
                    ))}
                    {hasCustomFilters(state) && (
                        <button type="button" className="chip chip--clear" onClick={state.clearFilters}>
                            <X size={13} /> Clear
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
