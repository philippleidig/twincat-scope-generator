import { useState } from 'react'
import { Card, Input, Button, Select, TrashIcon, CopyIcon, FileIcon } from '@/components/ui'
import { useConfigStore } from '@/stores/configStore'
import type { ScopeFile, Pattern, DataType } from '@/types'
import { validateTemplate, calculateExpansionCount } from '@/lib/patterns'
import './ScopeFileManager.css'

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

interface PatternEditorProps {
    fileId: string
    pattern: Pattern
    patternIndex: number
    canRemove: boolean
}

function PatternEditor({ fileId, pattern, patternIndex, canRemove }: PatternEditorProps) {
    const { addSymbol, updateSymbol, removeSymbol, removePattern, updatePatternPort, duplicatePattern } = useConfigStore()
    const [showCustomPort, setShowCustomPort] = useState(false)
    const [customPortValue, setCustomPortValue] = useState('')

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
            updatePatternPort(fileId, pattern.id, parseInt(value, 10))
        }
    }

    const handleCustomPortSubmit = () => {
        const port = parseInt(customPortValue, 10)
        if (!isNaN(port) && port > 0) {
            updatePatternPort(fileId, pattern.id, port)
            setShowCustomPort(false)
        }
    }

    return (
        <div className="pattern-editor">
            <div className="pattern-header-row">
                <span className="pattern-number">Pattern {patternIndex + 1}</span>
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
                        />
                    )}
                    {!showCustomPort && !isPresetPort && (
                        <span className="custom-port-display">Port: {currentPortValue}</span>
                    )}
                </div>
                <div className="pattern-actions-top">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicatePattern(fileId, pattern.id)}
                        title="Duplicate Pattern"
                        className="btn-icon"
                    >
                        <CopyIcon size={14} />
                    </Button>
                    {canRemove && (
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={() => removePattern(fileId, pattern.id)}
                            title="Remove Pattern"
                            className="btn-icon"
                        >
                            <TrashIcon size={14} />
                        </Button>
                    )}
                </div>
            </div>

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
                                        onChange={(e) => updateSymbol(fileId, pattern.id, symbol.id, { template: e.target.value })}
                                        placeholder="e.g., MAIN.mover[{i:1:5}].position"
                                        error={symbol.template && !validation.valid ? validation.errors[0] : undefined}
                                        className="symbol-input"
                                    />
                                    <Select
                                        value={symbol.dataType}
                                        onChange={(e) => updateSymbol(fileId, pattern.id, symbol.id, { dataType: e.target.value as DataType })}
                                        options={DATA_TYPE_OPTIONS}
                                    />
                                    {pattern.symbols.length > 1 && (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => removeSymbol(fileId, pattern.id, symbol.id)}
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
                <Button size="sm" variant="secondary" onClick={() => addSymbol(fileId, pattern.id)}>
                    + Add Symbol
                </Button>
                {totalExpansions > 0 && (
                    <span className="pattern-total">Total: {totalExpansions}</span>
                )}
            </div>
        </div>
    )
}

interface ScopeFileCardProps {
    scopeFile: ScopeFile
    canRemove: boolean
    onDuplicate: () => void
}

function ScopeFileCard({ scopeFile, canRemove, onDuplicate }: ScopeFileCardProps) {
    const { updateScopeFile, removeScopeFile, addPattern } = useConfigStore()

    const totalAcquisitions = scopeFile.patterns.reduce((sum, pattern) => {
        return sum + pattern.symbols.reduce((symSum, symbol) => {
            if (!symbol.template.trim()) return symSum
            return symSum + calculateExpansionCount(symbol.template)
        }, 0)
    }, 0)

    return (
        <Card
            className="scope-file-card"
            actions={
                <div className="file-actions">
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
                </div>
            }
        >
            <div className="file-header">
                <div className="file-name-input">
                    <FileIcon size={20} className="file-icon" />
                    <Input
                        value={scopeFile.name}
                        onChange={(e) => updateScopeFile(scopeFile.id, { name: e.target.value })}
                        placeholder="File name"
                    />
                    <span className="file-ext">.tcscopex</span>
                </div>
                {totalAcquisitions > 0 && (
                    <div className="file-total">{totalAcquisitions} acquisitions</div>
                )}
            </div>

            <div className="patterns-container">
                {scopeFile.patterns.map((pattern, index) => (
                    <PatternEditor
                        key={pattern.id}
                        fileId={scopeFile.id}
                        pattern={pattern}
                        patternIndex={index}
                        canRemove={scopeFile.patterns.length > 1}
                    />
                ))}
            </div>

            <Button size="sm" variant="secondary" onClick={() => addPattern(scopeFile.id)} className="add-pattern-btn">
                + Add Pattern
            </Button>
        </Card>
    )
}

export function ScopeFileManager() {
    const { scopeFiles, addScopeFile, duplicateScopeFile } = useConfigStore()

    return (
        <div className="scope-file-manager">
            <div className="manager-header">
                <h2>Scope Files</h2>
                <Button onClick={addScopeFile}>+ Add File</Button>
            </div>

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
        </div>
    )
}
