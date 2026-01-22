import { useState, useRef } from 'react'
import { useSampleStore } from '@/stores/sampleStore'
import {
    CopyIcon,
    CheckIcon,
    EditIcon,
    TrashIcon,
    PlusIcon,
    DownloadIcon,
    UploadIcon,
    ResetIcon,
    CloseIcon,
} from '@/components/ui'
import './ExamplePatterns.css'

export function ExamplePatterns() {
    const { samples, addSample, updateSample, removeSample, resetToDefaults, importSamples, exportSamples } =
        useSampleStore()

    const [copiedIndex, setCopiedIndex] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTemplate, setEditTemplate] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [showAddForm, setShowAddForm] = useState(false)
    const [newTemplate, setNewTemplate] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [showImportModal, setShowImportModal] = useState(false)
    const [importText, setImportText] = useState('')
    const [importError, setImportError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleCopy = (template: string, id: string) => {
        const copyToClipboard = async () => {
            // Use modern clipboard API if available
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(template)
            } else {
                // Fallback for older browsers or when clipboard API is unavailable
                const textArea = document.createElement('textarea')
                textArea.value = template
                textArea.style.position = 'fixed'
                textArea.style.left = '-9999px'
                document.body.appendChild(textArea)
                textArea.select()
                document.execCommand('copy')
                document.body.removeChild(textArea)
            }
        }

        copyToClipboard()
            .then(() => {
                setCopiedIndex(id)
                setTimeout(() => setCopiedIndex(null), 2000)
            })
            .catch(() => {
                // Silent fail - clipboard operations may be blocked
            })
    }

    const handleStartEdit = (id: string, template: string, description: string) => {
        setEditingId(id)
        setEditTemplate(template)
        setEditDescription(description)
    }

    const handleSaveEdit = () => {
        if (editingId && editTemplate.trim()) {
            updateSample(editingId, {
                template: editTemplate.trim(),
                description: editDescription.trim(),
            })
        }
        setEditingId(null)
        setEditTemplate('')
        setEditDescription('')
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setEditTemplate('')
        setEditDescription('')
    }

    const handleAdd = () => {
        if (newTemplate.trim()) {
            addSample(newTemplate.trim(), newDescription.trim())
            setNewTemplate('')
            setNewDescription('')
            setShowAddForm(false)
        }
    }

    const handleExport = () => {
        const json = exportSamples()
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'twincat-scope-samples.json'
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleImportFromText = () => {
        setImportError('')
        try {
            const parsed = JSON.parse(importText)
            if (!Array.isArray(parsed)) {
                setImportError('JSON must be an array')
                return
            }
            importSamples(parsed)
            setShowImportModal(false)
            setImportText('')
        } catch {
            setImportError('Invalid JSON format')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target?.result as string
            setImportText(content)
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    const handleReset = () => {
        if (window.confirm('Reset all samples to defaults? Your custom samples will be lost.')) {
            resetToDefaults()
        }
    }

    return (
        <div className="example-patterns">
            <div className="example-header">
                <div className="example-title">
                    <h3>Sample Patterns</h3>
                    <p className="example-hint">Reusable pattern templates</p>
                </div>
                <div className="example-actions">
                    <button
                        className="action-button"
                        onClick={() => setShowAddForm(true)}
                        title="Add new sample"
                    >
                        <PlusIcon size={14} />
                    </button>
                    <button className="action-button" onClick={handleExport} title="Export samples">
                        <DownloadIcon size={14} />
                    </button>
                    <button
                        className="action-button"
                        onClick={() => setShowImportModal(true)}
                        title="Import samples"
                    >
                        <UploadIcon size={14} />
                    </button>
                    <button className="action-button" onClick={handleReset} title="Reset to defaults">
                        <ResetIcon size={14} />
                    </button>
                </div>
            </div>

            {showAddForm && (
                <div className="add-form">
                    <input
                        type="text"
                        className="add-input"
                        placeholder="Pattern template..."
                        value={newTemplate}
                        onChange={(e) => setNewTemplate(e.target.value)}
                        autoFocus
                    />
                    <input
                        type="text"
                        className="add-input"
                        placeholder="Description..."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                    />
                    <div className="add-form-actions">
                        <button className="btn-save" onClick={handleAdd} disabled={!newTemplate.trim()}>
                            Add
                        </button>
                        <button className="btn-cancel" onClick={() => setShowAddForm(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="examples-list">
                {samples.map((sample) => (
                    <div key={sample.id} className="example-item">
                        {editingId === sample.id ? (
                            <div className="edit-form">
                                <input
                                    type="text"
                                    className="edit-input"
                                    value={editTemplate}
                                    onChange={(e) => setEditTemplate(e.target.value)}
                                    autoFocus
                                />
                                <input
                                    type="text"
                                    className="edit-input"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Description..."
                                />
                                <div className="edit-actions">
                                    <button
                                        className="btn-save"
                                        onClick={handleSaveEdit}
                                        disabled={!editTemplate.trim()}
                                    >
                                        Save
                                    </button>
                                    <button className="btn-cancel" onClick={handleCancelEdit}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="example-template">
                                    <code>{sample.template}</code>
                                    <div className="item-actions">
                                        <button
                                            className={`copy-button ${copiedIndex === sample.id ? 'copied' : ''}`}
                                            onClick={() => handleCopy(sample.template, sample.id)}
                                            title="Copy to clipboard"
                                        >
                                            {copiedIndex === sample.id ? (
                                                <CheckIcon size={12} />
                                            ) : (
                                                <CopyIcon size={12} />
                                            )}
                                        </button>
                                        <button
                                            className="edit-button"
                                            onClick={() =>
                                                handleStartEdit(sample.id, sample.template, sample.description)
                                            }
                                            title="Edit sample"
                                        >
                                            <EditIcon size={12} />
                                        </button>
                                        <button
                                            className="delete-button"
                                            onClick={() => removeSample(sample.id)}
                                            title="Delete sample"
                                        >
                                            <TrashIcon size={12} />
                                        </button>
                                    </div>
                                </div>
                                <span className="example-desc">{sample.description}</span>
                            </>
                        )}
                    </div>
                ))}
                {samples.length === 0 && (
                    <div className="no-samples">No samples yet. Add one or reset to defaults.</div>
                )}
            </div>

            <div className="syntax-help">
                <strong>Syntax:</strong> <code>{'{name:start:end}'}</code>
                <span className="syntax-example">
                    e.g., <code>{'{i:1:5}'}</code> generates 1, 2, 3, 4, 5
                </span>
            </div>

            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h4>Import Samples</h4>
                            <button className="modal-close" onClick={() => setShowImportModal(false)}>
                                <CloseIcon size={16} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="import-hint">
                                Paste JSON or select a file. This will replace all existing samples.
                            </p>
                            <textarea
                                className="import-textarea"
                                placeholder='[{"template": "...", "description": "..."}]'
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                            />
                            {importError && <p className="import-error">{importError}</p>}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                            <button className="btn-file" onClick={() => fileInputRef.current?.click()}>
                                Select JSON File
                            </button>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-import"
                                onClick={handleImportFromText}
                                disabled={!importText.trim()}
                            >
                                Import
                            </button>
                            <button className="btn-cancel" onClick={() => setShowImportModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
