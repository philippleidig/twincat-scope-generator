import { useState, useCallback } from 'react'
import {
    Input,
    Button,
    Select,
    TrashIcon,
    CopyIcon,
    FileIcon,
    AxisGroupIcon,
    PatternIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from '@/components/ui'
import { useConfigStore } from '@/stores/configStore'
import type { ScopeFile, AxisGroup, Pattern, DataType } from '@/types'
import { validateTemplate, calculateExpansionCount } from '@/lib/patterns'
import { ImportModal, ImportFileButton } from '@/components/ImportModal'
import type { ParseResult } from '@/lib/twincat'
import './ScopeFileManager.css'

// Map Beckhoff TwinCAT base types to app DataType
const BECKHOFF_TYPE_MAP: Record<string, DataType> = {
    BOOL: 'BIT',
    BIT: 'BIT',
    SINT: 'INT8',
    INT: 'INT16',
    DINT: 'INT32',
    LINT: 'INT64',
    USINT: 'UINT8',
    UINT: 'UINT16',
    UDINT: 'UINT32',
    ULINT: 'UINT64',
    REAL: 'REAL32',
    LREAL: 'REAL64',
}

function parseBeckhoffDrop(xmlText: string): { symbolName: string; dataType: DataType; targetPort: number } | null {
    try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(xmlText, 'text/xml')

        // Extract target port
        const portEl = doc.querySelector('TargetInfo AmsAddress Port')
        const targetPort = portEl ? parseInt(portEl.textContent || '851', 10) : 851

        // Build type resolution map from DataTypes section
        const typeMap: Record<string, string> = {}
        doc.querySelectorAll('DataTypes DataType').forEach((dt) => {
            const name = dt.querySelector('Name')?.textContent || ''
            const baseType = dt.querySelector('BaseType')?.textContent || ''
            if (name && baseType) {
                typeMap[name.toUpperCase()] = baseType.toUpperCase()
            }
        })

        // Extract symbol
        const symbolEl = doc.querySelector('Symbols Symbol')
        if (!symbolEl) return null

        const symbolName = symbolEl.querySelector('Name')?.textContent || ''
        let baseTypeName = (symbolEl.querySelector('BaseType')?.textContent || '').toUpperCase()

        // Resolve type aliases (e.g. OTCID -> UDINT)
        let maxDepth = 10
        while (typeMap[baseTypeName] && maxDepth-- > 0) {
            baseTypeName = typeMap[baseTypeName]
        }

        const dataType = BECKHOFF_TYPE_MAP[baseTypeName]
        if (!symbolName || !dataType) return null

        return { symbolName, dataType, targetPort }
    } catch {
        return null
    }
}

const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
    { value: 'REAL64', label: 'REAL64 (LREAL)' },
    { value: 'REAL32', label: 'REAL32 (REAL)' },
    { value: 'INT64', label: 'INT64 (LINT)' },
    { value: 'INT32', label: 'INT32 (DINT)' },
    { value: 'INT16', label: 'INT16 (INT)' },
    { value: 'INT8', label: 'INT8 (SINT)' },
    { value: 'UINT64', label: 'UINT64 (ULINT)' },
    { value: 'UINT32', label: 'UINT32 (UDINT)' },
    { value: 'UINT16', label: 'UINT16 (UINT)' },
    { value: 'UINT8', label: 'UINT8 (USINT)' },
    { value: 'BIT', label: 'BIT (BOOL)' },
]

// ADS Port presets
const PORT_PRESETS = [
    { value: '851', label: '851 - PLC 1' },
    { value: '852', label: '852 - PLC 2' },
    { value: '853', label: '853 - PLC 3' },
    { value: '854', label: '854 - PLC 4' },
    { value: '500', label: '500 - NC2' },
    { value: '351', label: '351' },
    { value: '352', label: '352' },
    { value: '353', label: '353' },
    { value: '354', label: '354' },
    { value: '355', label: '355' },
    { value: '356', label: '356' },
    { value: '357', label: '357' },
    { value: '358', label: '358' },
    { value: '359', label: '359' },
    { value: '360', label: '360' },
    { value: 'custom', label: 'Custom...' },
]

type Level = 'file' | 'group' | 'pattern'

interface CollapseToggleProps {
    expanded: boolean
    onToggle: () => void
    label: string
}

/** Chevron that expands/collapses one node of the Scope File tree. */
function CollapseToggle({ expanded, onToggle, label }: CollapseToggleProps) {
    return (
        <button
            type="button"
            className="level-toggle"
            onClick={onToggle}
            aria-expanded={expanded}
            title={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
        >
            {expanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
        </button>
    )
}

interface LevelHeaderProps {
    level: Level
    icon: React.ReactNode
    /**
     * Small uppercase kicker naming the tier, e.g. "Scope File". Omitted where
     * the node's own title already names the tier (patterns), which keeps the
     * most-repeated header on a single line.
     */
    kicker?: string
    expanded: boolean
    onToggle: () => void
    toggleLabel: string
    children: React.ReactNode
    badge?: React.ReactNode
    actions?: React.ReactNode
}

/**
 * Shared header bar for every tier of the tree. Each tier gets its own hue,
 * icon and kicker so Scope File / Axis Group / Pattern are distinguishable
 * without relying on nesting depth alone.
 */
function LevelHeader({
    level,
    icon,
    kicker,
    expanded,
    onToggle,
    toggleLabel,
    children,
    badge,
    actions,
}: LevelHeaderProps) {
    return (
        <div className={`level-header level-header--${level}`}>
            <CollapseToggle expanded={expanded} onToggle={onToggle} label={toggleLabel} />
            <span className={`level-icon level-icon--${level}`} aria-hidden="true">
                {icon}
            </span>
            <div className="level-titles">
                {kicker && <span className={`level-kicker level-kicker--${level}`}>{kicker}</span>}
                <div className="level-name-row">{children}</div>
            </div>
            {badge}
            {actions && <div className="level-actions">{actions}</div>}
        </div>
    )
}

interface PatternEditorProps {
    fileId: string
    axisGroupId: string
    pattern: Pattern
    patternIndex: number
    canRemove: boolean
}

function PatternEditor({ fileId, axisGroupId, pattern, patternIndex, canRemove }: PatternEditorProps) {
    const { addSymbol, updateSymbol, removeSymbol, removePattern, updatePatternPort, duplicatePattern } = useConfigStore()
    const [showCustomPort, setShowCustomPort] = useState(false)
    const [customPortValue, setCustomPortValue] = useState('')
    const [expanded, setExpanded] = useState(true)

    const totalExpansions = pattern.symbols.reduce((sum, symbol) => {
        if (!symbol.template.trim()) return sum
        return sum + calculateExpansionCount(symbol.template)
    }, 0)

    const currentPortValue = pattern.targetPort.toString()
    const isPresetPort = PORT_PRESETS.some(p => p.value === currentPortValue && p.value !== 'custom')

    const handlePortChange = (value: string) => {
        if (value === 'custom') {
            setShowCustomPort(true)
            setCustomPortValue(currentPortValue)
        } else {
            setShowCustomPort(false)
            updatePatternPort(fileId, axisGroupId, pattern.id, parseInt(value, 10))
        }
    }

    const handleCustomPortSubmit = () => {
        const port = parseInt(customPortValue, 10)
        if (!isNaN(port) && port > 0) {
            updatePatternPort(fileId, axisGroupId, pattern.id, port)
            setShowCustomPort(false)
        }
    }

    const patternLabel = `Pattern ${patternIndex + 1}`

    return (
        <section className={`level-node pattern-editor${expanded ? '' : ' is-collapsed'}`}>
            <LevelHeader
                level="pattern"
                icon={<PatternIcon size={15} />}
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
                toggleLabel={patternLabel}
                badge={
                    totalExpansions > 0 ? (
                        <span className="level-count level-count--pattern">Total: {totalExpansions}</span>
                    ) : undefined
                }
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => duplicatePattern(fileId, axisGroupId, pattern.id)}
                            title="Duplicate Pattern"
                            className="btn-icon"
                        >
                            <CopyIcon size={14} />
                        </Button>
                        {canRemove && (
                            <Button
                                size="sm"
                                variant="danger"
                                onClick={() => removePattern(fileId, axisGroupId, pattern.id)}
                                title="Remove Pattern"
                                className="btn-icon"
                            >
                                <TrashIcon size={14} />
                            </Button>
                        )}
                    </>
                }
            >
                <span className="pattern-number">{patternLabel}</span>
                <div className="port-selector">
                    {showCustomPort ? (
                        <div className="custom-port-input">
                            <Input
                                value={customPortValue}
                                onChange={(e) => setCustomPortValue(e.target.value)}
                                placeholder="Port"
                                type="number"
                                className="port-input"
                            />
                            <Button size="sm" onClick={handleCustomPortSubmit}>OK</Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowCustomPort(false)}>×</Button>
                        </div>
                    ) : (
                        <Select
                            value={isPresetPort ? currentPortValue : 'custom'}
                            onChange={(e) => handlePortChange(e.target.value)}
                            options={PORT_PRESETS}
                            aria-label="ADS port"
                        />
                    )}
                    {!showCustomPort && !isPresetPort && (
                        <span className="custom-port-display">Port: {currentPortValue}</span>
                    )}
                </div>
            </LevelHeader>

            {expanded && (
                <div className="level-body pattern-body">
                    <div className="symbols-list">
                        {pattern.symbols.map((symbol, symbolIndex) => {
                            const validation = symbol.template ? validateTemplate(symbol.template) : { valid: true, errors: [] }
                            const expansionCount = symbol.template ? calculateExpansionCount(symbol.template) : 0

                            return (
                                <div key={symbol.id} className="symbol-row">
                                    <div className="symbol-index">{symbolIndex + 1}</div>
                                    <div className="symbol-content">
                                        <div className="symbol-input-row">
                                            <Input
                                                value={symbol.template}
                                                onChange={(e) => updateSymbol(fileId, axisGroupId, pattern.id, symbol.id, { template: e.target.value })}
                                                placeholder="e.g., MAIN.mover[{i:1:5}].position"
                                                error={symbol.template && !validation.valid ? validation.errors[0] : undefined}
                                                className="symbol-input"
                                            />
                                            <Select
                                                value={symbol.dataType}
                                                onChange={(e) => updateSymbol(fileId, axisGroupId, pattern.id, symbol.id, { dataType: e.target.value as DataType })}
                                                options={DATA_TYPE_OPTIONS}
                                                aria-label="Data type"
                                            />
                                            {pattern.symbols.length > 1 && (
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => removeSymbol(fileId, axisGroupId, pattern.id, symbol.id)}
                                                    title="Remove Symbol"
                                                    className="btn-icon"
                                                >
                                                    <TrashIcon size={14} />
                                                </Button>
                                            )}
                                        </div>
                                        {symbol.template && validation.valid && expansionCount > 0 && (
                                            <div className="expansion-count">
                                                → {expansionCount} acquisition{expansionCount !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="pattern-actions">
                        <Button size="sm" variant="secondary" onClick={() => addSymbol(fileId, axisGroupId, pattern.id)}>
                            + Add Symbol
                        </Button>
                    </div>
                </div>
            )}
        </section>
    )
}

interface AxisGroupEditorProps {
    fileId: string
    axisGroup: AxisGroup
    canRemove: boolean
}

function AxisGroupEditor({ fileId, axisGroup, canRemove }: AxisGroupEditorProps) {
    const { updateAxisGroup, removeAxisGroup, duplicateAxisGroup, addPattern, addPatternWithSymbol } = useConfigStore()
    const [isDragOver, setIsDragOver] = useState(false)
    const [expanded, setExpanded] = useState(true)

    const totalAcquisitions = axisGroup.patterns.reduce((sum, pattern) => {
        return sum + pattern.symbols.reduce((symSum, symbol) => {
            if (!symbol.template.trim()) return symSum
            return symSum + calculateExpansionCount(symbol.template)
        }, 0)
    }, 0)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        const xmlText = e.dataTransfer.getData('text/plain')
        if (!xmlText || !xmlText.includes('TargetBrowserExportInfo')) return

        const parsed = parseBeckhoffDrop(xmlText)
        if (!parsed) return

        addPatternWithSymbol(fileId, axisGroup.id, parsed.symbolName, parsed.dataType, parsed.targetPort)
    }, [fileId, axisGroup.id, addPatternWithSymbol])

    const patternCount = axisGroup.patterns.length

    return (
        <section
            className={`level-node axis-group-editor${isDragOver ? ' drag-over' : ''}${expanded ? '' : ' is-collapsed'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <LevelHeader
                level="group"
                icon={<AxisGroupIcon size={16} />}
                kicker="Axis Group"
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
                toggleLabel={axisGroup.name || 'axis group'}
                badge={
                    <span className="level-meta">
                        <span className="level-chip">
                            {patternCount} pattern{patternCount !== 1 ? 's' : ''}
                        </span>
                        {totalAcquisitions > 0 && (
                            <span className="level-count level-count--group">{totalAcquisitions} acq.</span>
                        )}
                    </span>
                }
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => duplicateAxisGroup(fileId, axisGroup.id)}
                            title="Duplicate Axis Group"
                            className="btn-icon"
                        >
                            <CopyIcon size={14} />
                        </Button>
                        {canRemove && (
                            <Button
                                size="sm"
                                variant="danger"
                                onClick={() => removeAxisGroup(fileId, axisGroup.id)}
                                title="Remove Axis Group"
                                className="btn-icon"
                            >
                                <TrashIcon size={14} />
                            </Button>
                        )}
                    </>
                }
            >
                <Input
                    value={axisGroup.name}
                    onChange={(e) => updateAxisGroup(fileId, axisGroup.id, { name: e.target.value })}
                    placeholder="Axis Group Name"
                    className="axis-group-name-input"
                    aria-label="Axis group name"
                />
            </LevelHeader>

            {expanded && (
                <div className="level-body axis-group-body">
                    <div className="level-children level-children--pattern">
                        {axisGroup.patterns.map((pattern, index) => (
                            <PatternEditor
                                key={pattern.id}
                                fileId={fileId}
                                axisGroupId={axisGroup.id}
                                pattern={pattern}
                                patternIndex={index}
                                canRemove={axisGroup.patterns.length > 1}
                            />
                        ))}
                    </div>

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addPattern(fileId, axisGroup.id)}
                        className="add-pattern-btn level-add-btn"
                    >
                        + Add Pattern
                    </Button>
                </div>
            )}

            {isDragOver && (
                <div className="drop-hint" aria-hidden="true">
                    Drop symbol into “{axisGroup.name || 'this axis group'}”
                </div>
            )}
        </section>
    )
}

interface ScopeFileCardProps {
    scopeFile: ScopeFile
    canRemove: boolean
    onDuplicate: () => void
}

function ScopeFileCard({ scopeFile, canRemove, onDuplicate }: ScopeFileCardProps) {
    const { updateScopeFile, removeScopeFile, addAxisGroup } = useConfigStore()
    const [expanded, setExpanded] = useState(true)

    const totalAcquisitions = scopeFile.axisGroups.reduce((sum, ag) => {
        return sum + ag.patterns.reduce((patSum, pattern) => {
            return patSum + pattern.symbols.reduce((symSum, symbol) => {
                if (!symbol.template.trim()) return symSum
                return symSum + calculateExpansionCount(symbol.template)
            }, 0)
        }, 0)
    }, 0)

    const groupCount = scopeFile.axisGroups.length

    return (
        <section className={`level-node scope-file-card${expanded ? '' : ' is-collapsed'}`}>
            <LevelHeader
                level="file"
                icon={<FileIcon size={18} />}
                kicker="Scope File"
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
                toggleLabel={scopeFile.name || 'scope file'}
                badge={
                    <span className="level-meta">
                        <span className="level-chip">
                            {groupCount} axis group{groupCount !== 1 ? 's' : ''}
                        </span>
                        {totalAcquisitions > 0 && (
                            <span className="level-count level-count--file">{totalAcquisitions} acquisitions</span>
                        )}
                    </span>
                }
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onDuplicate}
                            title="Duplicate File"
                            className="btn-icon"
                        >
                            <CopyIcon size={14} />
                        </Button>
                        {canRemove && (
                            <Button
                                size="sm"
                                variant="danger"
                                onClick={() => removeScopeFile(scopeFile.id)}
                                title="Remove File"
                                className="btn-icon"
                            >
                                <TrashIcon size={14} />
                            </Button>
                        )}
                    </>
                }
            >
                <div className="file-name-input">
                    <Input
                        value={scopeFile.name}
                        onChange={(e) => updateScopeFile(scopeFile.id, { name: e.target.value })}
                        placeholder="File name"
                        aria-label="Scope file name"
                    />
                    <span className="file-ext">.tcscopex</span>
                </div>
            </LevelHeader>

            {expanded && (
                <div className="level-body scope-file-body">
                    <div className="level-children level-children--group">
                        {scopeFile.axisGroups.map((axisGroup) => (
                            <AxisGroupEditor
                                key={axisGroup.id}
                                fileId={scopeFile.id}
                                axisGroup={axisGroup}
                                canRemove={scopeFile.axisGroups.length > 1}
                            />
                        ))}
                    </div>

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addAxisGroup(scopeFile.id)}
                        className="add-axis-group-btn level-add-btn"
                    >
                        + Add Axis Group
                    </Button>
                </div>
            )}
        </section>
    )
}

export function ScopeFileManager() {
    const { scopeFiles, addScopeFile, duplicateScopeFile } = useConfigStore()
    const [importResult, setImportResult] = useState<ParseResult | null>(null)
    const [importError, setImportError] = useState<string | null>(null)

    return (
        <div className="scope-file-manager">
            <div className="manager-header">
                <div className="manager-heading">
                    <h2>Scope Files</h2>
                    <ul className="hierarchy-legend" aria-label="Structure">
                        <li className="legend-item legend-item--file">
                            <FileIcon size={13} aria-hidden="true" /> Scope File
                        </li>
                        <li className="legend-sep" aria-hidden="true">›</li>
                        <li className="legend-item legend-item--group">
                            <AxisGroupIcon size={13} aria-hidden="true" /> Axis Group
                        </li>
                        <li className="legend-sep" aria-hidden="true">›</li>
                        <li className="legend-item legend-item--pattern">
                            <PatternIcon size={13} aria-hidden="true" /> Pattern
                        </li>
                    </ul>
                </div>
                <div className="manager-header-actions">
                    <ImportFileButton
                        onLoaded={(r) => { setImportError(null); setImportResult(r) }}
                        onError={(msg) => { setImportError(msg); setImportResult(null) }}
                    />
                    <Button onClick={addScopeFile}>+ Add File</Button>
                </div>
            </div>

            {importError && (
                <div className="import-error-banner" role="alert">
                    {importError}
                    <button
                        type="button"
                        className="import-error-dismiss"
                        onClick={() => setImportError(null)}
                        aria-label="Dismiss"
                    >×</button>
                </div>
            )}

            <div className="files-list">
                {scopeFiles.map((scopeFile) => (
                    <ScopeFileCard
                        key={scopeFile.id}
                        scopeFile={scopeFile}
                        canRemove={scopeFiles.length > 1}
                        onDuplicate={() => duplicateScopeFile(scopeFile.id)}
                    />
                ))}
            </div>

            <ImportModal
                isOpen={importResult !== null}
                parseResult={importResult}
                onClose={() => setImportResult(null)}
            />
        </div>
    )
}
