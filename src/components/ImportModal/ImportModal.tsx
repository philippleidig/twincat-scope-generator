import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Select, CloseIcon } from '@/components/ui'
import { useConfigStore } from '@/stores/configStore'
import {
    parseTwinCatFile,
    flattenObjects,
    iterAllSymbols,
} from '@/lib/twincat'
import type {
    ParseResult,
    ParsedSymbol,
    ParsedSymbolGroup,
    ParsedTcomObject,
} from '@/lib/twincat'
import './ImportModal.css'

type ViewMode = 'tree' | 'flat'
type CreateSymbolFilter = 'true' | 'false' | 'all'

interface ImportModalProps {
    isOpen: boolean
    parseResult: ParseResult | null
    onClose: () => void
}

function SymbolIcon({ src, size = 16 }: { src: string | null; size?: number }) {
    if (!src) {
        return <span className="symbol-icon symbol-icon-fallback" style={{ width: size, height: size }} />
    }
    return <img className="symbol-icon" src={src} width={size} height={size} alt="" />
}

interface SymbolRowProps {
    symbol: ParsedSymbol
    selected: boolean
    onToggle: (id: string) => void
    showOwner?: boolean
}

function SymbolRow({ symbol, selected, onToggle, showOwner }: SymbolRowProps) {
    const scopable = symbol.dataType !== null
    return (
        <label className={`symbol-row${selected ? ' selected' : ''}${!scopable ? ' not-scopable' : ''}`}>
            <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(symbol.id)}
                disabled={!scopable}
            />
            <span className="symbol-name">
                {showOwner ? symbol.fullPath : symbol.name}
            </span>
            <span className="symbol-type">{symbol.rawType || '?'}</span>
            <span className={`symbol-create-badge ${symbol.createSymbol ? 'is-true' : 'is-false'}`}>
                CreateSymbol={symbol.createSymbol ? 'true' : 'false'}
            </span>
            {!scopable && <span className="symbol-warn" title="Type cannot be scoped directly">⚠ unsupported</span>}
        </label>
    )
}

interface GroupSectionProps {
    group: ParsedSymbolGroup
    selectedIds: Set<string>
    onToggle: (id: string) => void
    onToggleMany: (ids: string[], select: boolean) => void
    visibleSymbols: ParsedSymbol[]
}

function GroupSection({ group, selectedIds, onToggle, onToggleMany, visibleSymbols }: GroupSectionProps) {
    const [expanded, setExpanded] = useState(true)
    const visibleIds = visibleSymbols.map(s => s.id)
    const selectableIds = visibleSymbols.filter(s => s.dataType !== null).map(s => s.id)
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id))
    const someSelected = selectableIds.some(id => selectedIds.has(id))

    if (visibleSymbols.length === 0) return null

    return (
        <div className="group-section">
            <div className="group-header">
                <button
                    type="button"
                    className="group-toggle"
                    onClick={() => setExpanded(e => !e)}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? '▾' : '▸'}
                </button>
                <SymbolIcon src={group.iconDataUrl} />
                <span className="group-name">{group.name}</span>
                <span className={`group-kind kind-${group.kind.toLowerCase()}`}>{group.kind}</span>
                <span className="group-count">{visibleSymbols.length}</span>
                <button
                    type="button"
                    className="group-select-all"
                    onClick={() => onToggleMany(visibleIds, !allSelected)}
                    disabled={selectableIds.length === 0}
                    title={allSelected ? 'Deselect all in group' : 'Select all in group'}
                >
                    {allSelected ? 'Deselect all' : someSelected ? 'Select rest' : 'Select all'}
                </button>
            </div>
            {expanded && (
                <div className="group-symbols">
                    {visibleSymbols.map(s => (
                        <SymbolRow
                            key={s.id}
                            symbol={s}
                            selected={selectedIds.has(s.id)}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

interface ObjectTreeNodeProps {
    object: ParsedTcomObject
    selectedIds: Set<string>
    onToggle: (id: string) => void
    onToggleMany: (ids: string[], select: boolean) => void
    visibleByGroup: Map<string, ParsedSymbol[]>
    depth: number
}

function ObjectTreeNode({ object, selectedIds, onToggle, onToggleMany, visibleByGroup, depth }: ObjectTreeNodeProps) {
    const [expanded, setExpanded] = useState(depth < 2)
    const ownGroupsHaveContent = object.groups.some(g => (visibleByGroup.get(g.id) ?? []).length > 0)
    const childrenHaveContent = object.children.length > 0

    if (!ownGroupsHaveContent && !childrenHaveContent) return null

    return (
        <div className="tcom-object" style={{ marginLeft: depth * 12 }}>
            <div className="tcom-object-header">
                <button
                    type="button"
                    className="group-toggle"
                    onClick={() => setExpanded(e => !e)}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? '▾' : '▸'}
                </button>
                <SymbolIcon src={object.iconDataUrl} size={18} />
                <span className="tcom-object-name">{object.name}</span>
                {object.className && <span className="tcom-object-class">[{object.className}]</span>}
            </div>
            {expanded && (
                <div className="tcom-object-body">
                    {object.groups.map(g => (
                        <GroupSection
                            key={g.id}
                            group={g}
                            selectedIds={selectedIds}
                            onToggle={onToggle}
                            onToggleMany={onToggleMany}
                            visibleSymbols={visibleByGroup.get(g.id) ?? []}
                        />
                    ))}
                    {object.children.map(c => (
                        <ObjectTreeNode
                            key={c.id}
                            object={c}
                            selectedIds={selectedIds}
                            onToggle={onToggle}
                            onToggleMany={onToggleMany}
                            visibleByGroup={visibleByGroup}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export function ImportModal({ isOpen, parseResult, onClose }: ImportModalProps) {
    const { scopeFiles, addSymbolsToAxisGroup } = useConfigStore()
    const [viewMode, setViewMode] = useState<ViewMode>('tree')
    const [textFilter, setTextFilter] = useState('')
    const [createFilter, setCreateFilter] = useState<CreateSymbolFilter>('true')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [targetFileId, setTargetFileId] = useState<string>('')
    const [targetAxisGroupId, setTargetAxisGroupId] = useState<string>('')
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const dialogRef = useRef<HTMLDivElement | null>(null)

    // Reset filters / selection when the modal opens or a new file is parsed.
    // Excludes scopeFiles so a successful bulk-add doesn't wipe state mid-flight.
    useEffect(() => {
        if (!isOpen) return
        setSelectedIds(new Set())
        setTextFilter('')
        setCreateFilter('true')
        setStatusMessage(null)
    }, [isOpen, parseResult])

    // Initialize target file/axis group on open. We read scopeFiles here but
    // intentionally don't depend on it so the user's choice is preserved.
    useEffect(() => {
        if (!isOpen) return
        const files = useConfigStore.getState().scopeFiles
        if (files.length === 0) return
        setTargetFileId(prev => files.some(f => f.id === prev) ? prev : files[0].id)
        const file = files[0]
        if (file.axisGroups.length > 0) setTargetAxisGroupId(file.axisGroups[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // When target file changes, reset axis group to its first.
    useEffect(() => {
        const file = scopeFiles.find(f => f.id === targetFileId)
        if (!file) return
        if (!file.axisGroups.some(ag => ag.id === targetAxisGroupId)) {
            setTargetAxisGroupId(file.axisGroups[0]?.id ?? '')
        }
    }, [targetFileId, scopeFiles, targetAxisGroupId])

    // Close on Escape.
    useEffect(() => {
        if (!isOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, onClose])

    const allSymbols = useMemo<ParsedSymbol[]>(() => {
        if (!parseResult) return []
        return Array.from(iterAllSymbols(parseResult.objects))
    }, [parseResult])

    const filteredSymbols = useMemo(() => {
        const needle = textFilter.trim().toLowerCase()
        return allSymbols.filter(s => {
            if (createFilter === 'true' && !s.createSymbol) return false
            if (createFilter === 'false' && s.createSymbol) return false
            if (!needle) return true
            return (
                s.name.toLowerCase().includes(needle) ||
                s.fullPath.toLowerCase().includes(needle) ||
                s.rawType.toLowerCase().includes(needle) ||
                s.groupName.toLowerCase().includes(needle) ||
                s.ownerObjectName.toLowerCase().includes(needle)
            )
        })
    }, [allSymbols, textFilter, createFilter])

    // Map group id -> visible symbols (used by tree view).
    const visibleByGroup = useMemo(() => {
        const map = new Map<string, ParsedSymbol[]>()
        for (const sym of filteredSymbols) {
            const list = map.get(sym.groupId) ?? []
            list.push(sym)
            map.set(sym.groupId, list)
        }
        return map
    }, [filteredSymbols])

    const visibleSelectableIds = useMemo(
        () => filteredSymbols.filter(s => s.dataType !== null).map(s => s.id),
        [filteredSymbols],
    )

    const totalSelectableCount = visibleSelectableIds.length

    function toggleOne(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function toggleMany(ids: string[], select: boolean) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            const lookup = new Set(ids)
            for (const sym of allSymbols) {
                if (!lookup.has(sym.id)) continue
                if (sym.dataType === null) continue
                if (select) next.add(sym.id)
                else next.delete(sym.id)
            }
            return next
        })
    }

    function toggleAllVisible(select: boolean) {
        toggleMany(visibleSelectableIds, select)
    }

    function handleAddToScope() {
        if (!parseResult) return
        if (!targetFileId || !targetAxisGroupId) {
            setStatusMessage('Please select a target Scope File and Axis Group.')
            return
        }
        const symbolsToAdd = allSymbols.filter(s => selectedIds.has(s.id) && s.dataType !== null)
        if (symbolsToAdd.length === 0) {
            setStatusMessage('No symbols selected.')
            return
        }
        addSymbolsToAxisGroup(
            targetFileId,
            targetAxisGroupId,
            symbolsToAdd.map(s => ({
                template: s.fullPath,
                dataType: s.dataType!,
                targetPort: s.suggestedPort,
            })),
        )
        setStatusMessage(`Added ${symbolsToAdd.length} symbol${symbolsToAdd.length === 1 ? '' : 's'} to scope.`)
        // Auto-close after a short delay so the user sees feedback.
        setTimeout(() => onClose(), 600)
    }

    if (!isOpen || !parseResult) return null

    const targetFile = scopeFiles.find(f => f.id === targetFileId)
    const fileOptions = scopeFiles.map(f => ({ value: f.id, label: f.name || '(unnamed)' }))
    const axisGroupOptions = (targetFile?.axisGroups ?? []).map(ag => ({
        value: ag.id,
        label: ag.name || '(unnamed)',
    }))

    const totalParsed = allSymbols.length
    const visibleCount = filteredSymbols.length
    const selectedCount = selectedIds.size

    return (
        <div className="import-modal-backdrop" onClick={onClose}>
            <div
                className="import-modal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-modal-title"
                ref={dialogRef}
                onClick={e => e.stopPropagation()}
            >
                <div className="import-modal-header">
                    <div className="import-modal-title-block">
                        <h2 id="import-modal-title">Import {parseResult.fileType} — {parseResult.fileName}</h2>
                        <span className="import-modal-subtitle">
                            {parseResult.objects.length} object{parseResult.objects.length === 1 ? '' : 's'},
                            {' '}{totalParsed} symbol{totalParsed === 1 ? '' : 's'} parsed
                        </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} title="Close" className="btn-icon">
                        <CloseIcon size={16} />
                    </Button>
                </div>

                {parseResult.warnings.length > 0 && (
                    <div className="import-modal-warnings">
                        {parseResult.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                )}

                <div className="import-modal-toolbar">
                    <div className="toolbar-segment view-toggle">
                        <button
                            type="button"
                            className={`toggle-btn${viewMode === 'tree' ? ' active' : ''}`}
                            onClick={() => setViewMode('tree')}
                        >
                            Tree
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn${viewMode === 'flat' ? ' active' : ''}`}
                            onClick={() => setViewMode('flat')}
                        >
                            Flat
                        </button>
                    </div>

                    <Input
                        placeholder="Filter by name, type, group..."
                        value={textFilter}
                        onChange={e => setTextFilter(e.target.value)}
                        className="toolbar-search"
                    />

                    <Select
                        value={createFilter}
                        onChange={e => setCreateFilter(e.target.value as CreateSymbolFilter)}
                        options={[
                            { value: 'true', label: 'CreateSymbol = true' },
                            { value: 'false', label: 'CreateSymbol = false' },
                            { value: 'all', label: 'CreateSymbol: all' },
                        ]}
                    />

                    <div className="toolbar-stats">
                        <span>{visibleCount} of {totalParsed} visible</span>
                        <span className="dot">•</span>
                        <span><b>{selectedCount}</b> selected</span>
                    </div>

                    <div className="toolbar-bulk">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => toggleAllVisible(true)}
                            disabled={totalSelectableCount === 0}
                        >
                            Select all visible
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleAllVisible(false)}
                            disabled={selectedCount === 0}
                        >
                            Clear selection
                        </Button>
                    </div>
                </div>

                <div className="import-modal-content">
                    {viewMode === 'tree' ? (
                        <div className="tree-view">
                            {parseResult.objects.map(obj => (
                                <ObjectTreeNode
                                    key={obj.id}
                                    object={obj}
                                    selectedIds={selectedIds}
                                    onToggle={toggleOne}
                                    onToggleMany={toggleMany}
                                    visibleByGroup={visibleByGroup}
                                    depth={0}
                                />
                            ))}
                            {filteredSymbols.length === 0 && (
                                <div className="empty-state">No symbols match the current filter.</div>
                            )}
                        </div>
                    ) : (
                        <div className="flat-view">
                            {filteredSymbols.length === 0 ? (
                                <div className="empty-state">No symbols match the current filter.</div>
                            ) : (
                                filteredSymbols.map(s => (
                                    <SymbolRow
                                        key={s.id}
                                        symbol={s}
                                        selected={selectedIds.has(s.id)}
                                        onToggle={toggleOne}
                                        showOwner
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="import-modal-footer">
                    <div className="footer-target">
                        <label className="footer-label">Add to:</label>
                        <Select
                            value={targetFileId}
                            onChange={e => setTargetFileId(e.target.value)}
                            options={fileOptions}
                            disabled={fileOptions.length === 0}
                        />
                        <span className="footer-arrow">›</span>
                        <Select
                            value={targetAxisGroupId}
                            onChange={e => setTargetAxisGroupId(e.target.value)}
                            options={axisGroupOptions}
                            disabled={axisGroupOptions.length === 0}
                        />
                    </div>
                    <div className="footer-actions">
                        {statusMessage && <span className="footer-status">{statusMessage}</span>}
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleAddToScope} disabled={selectedCount === 0}>
                            Add {selectedCount > 0 ? `${selectedCount} ` : ''}to Scope
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface ImportButtonProps {
    onLoaded: (result: ParseResult) => void
    onError: (message: string) => void
}

/**
 * File picker button that parses an XTI/TMC file and emits the parsed result.
 * Shown in the ScopeFileManager header.
 */
export function ImportFileButton({ onLoaded, onError }: ImportButtonProps) {
    const inputRef = useRef<HTMLInputElement | null>(null)

    function handleClick() {
        inputRef.current?.click()
    }

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            const text = await file.text()
            const result = parseTwinCatFile(file.name, text)
            // Reset input so the same file can be re-selected later.
            e.target.value = ''
            // Pre-flatten so empty results are caught.
            const symCount = flattenObjects(result.objects).reduce(
                (acc, o) => acc + o.groups.reduce((a, g) => a + g.symbols.length, 0),
                0,
            )
            if (result.objects.length === 0 || symCount === 0) {
                onError(`No scope-able symbols found in ${file.name}.`)
                return
            }
            onLoaded(result)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            onError(`Failed to parse ${file.name}: ${msg}`)
            e.target.value = ''
        }
    }

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".xti,.tmc,application/xml,text/xml"
                onChange={handleFile}
                style={{ display: 'none' }}
                data-testid="import-file-input"
            />
            <Button variant="secondary" onClick={handleClick} title="Import XTI or TMC file">
                Import XTI/TMC
            </Button>
        </>
    )
}
