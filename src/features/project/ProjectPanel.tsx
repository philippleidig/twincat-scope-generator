import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Copy, Library, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { fileNameError } from '@/domain/project'
import { PORT_PRESETS } from '@/domain/ports'
import { useProjectStore } from '@/state/projectStore'
import { Button } from '@/ui/components/Button'
import { Menu } from '@/ui/components/Menu'
import { AxisGroupCard } from './AxisGroupCard'
import { FileTab } from './FileTab'
import { PatternLibraryDialog } from './PatternLibraryDialog'
import './project.css'

/** The scope project: one tab per `.tcscopex` file, its axis groups and channels below. */
export function ProjectPanel() {
    const project = useProjectStore((s) => s.project)
    const activeAxisGroupId = useProjectStore((s) => s.activeAxisGroupId)
    const activeFileId = useProjectStore((s) => s.activeFileId)
    const selectFile = useProjectStore((s) => s.selectFile)
    const addScopeFile = useProjectStore((s) => s.addScopeFile)
    const updateScopeFile = useProjectStore((s) => s.updateScopeFile)
    const removeScopeFile = useProjectStore((s) => s.removeScopeFile)
    const duplicateScopeFile = useProjectStore((s) => s.duplicateScopeFile)
    const addAxisGroup = useProjectStore((s) => s.addAxisGroup)
    const [libraryOpen, setLibraryOpen] = useState(false)

    const files = project.scopeFiles
    const addAndSelectFile = () => {
        const id = uuid()
        addScopeFile(id)
        selectFile(id)
    }
    const shownFile = files.find((f) => f.id === activeFileId) ?? files[0]

    const nameError = shownFile
        ? fileNameError(shownFile.name, files.filter((f) => f.id !== shownFile.id).map((f) => f.name))
        : null

    return (
        <section className="panel project" aria-label="Scope project">
            <header className="panel__header">
                <div>
                    <h2 className="panel__title">Scope project</h2>
                    <p className="panel__subtitle">Each tab becomes one .tcscopex file with a YT chart</p>
                </div>
                <div className="panel__actions">
                    <Button size="sm" variant="ghost" icon={<Library size={15} />} onClick={() => setLibraryOpen(true)}>
                        Pattern library
                    </Button>
                </div>
            </header>

            <div className="file-tabs" role="tablist" aria-label="Scope files">
                {files.map((f) => (
                    <FileTab key={f.id} file={f} selected={f.id === shownFile?.id} />
                ))}
                <button type="button" className="file-tab file-tab--add" aria-label="Add scope file" onClick={addAndSelectFile}>
                    <Plus size={15} />
                </button>
            </div>

            {shownFile ? (
                <div className="project__body scroll" role="tabpanel">
                    <div className="file-header">
                        <div className={`file-name ${nameError ? 'file-name--error' : ''}`}>
                            <input
                                className="file-name__input"
                                value={shownFile.name}
                                aria-label="Scope file name"
                                aria-invalid={!!nameError}
                                onChange={(e) => updateScopeFile(shownFile.id, { name: e.target.value })}
                            />
                            <span className="file-name__ext">.tcscopex</span>
                        </div>
                        <Button size="sm" icon={<Plus size={15} />} onClick={() => addAxisGroup(shownFile.id)}>
                            Axis group
                        </Button>
                        <Menu
                            trigger={(props) => (
                                <button type="button" className="btn btn--ghost btn--sm btn--icon" aria-label="Scope file actions" {...props}>
                                    <MoreHorizontal size={16} />
                                </button>
                            )}
                            items={[
                                { label: 'Duplicate file', icon: <Copy size={14} />, onSelect: () => duplicateScopeFile(shownFile.id) },
                                {
                                    label: 'Delete file',
                                    icon: <Trash2 size={14} />,
                                    danger: true,
                                    disabled: files.length <= 1,
                                    onSelect: () => removeScopeFile(shownFile.id),
                                },
                            ]}
                        />
                    </div>
                    {nameError && (
                        <p className="file-header__error" role="alert">
                            {nameError}
                        </p>
                    )}
                    {shownFile.axisGroups.map((g, i) => (
                        <AxisGroupCard
                            key={g.id}
                            group={g}
                            fileId={shownFile.id}
                            index={i}
                            targets={project.targets}
                            active={g.id === activeAxisGroupId}
                            canRemove={shownFile.axisGroups.length > 1}
                        />
                    ))}
                    {shownFile.axisGroups.length === 0 && (
                        <div className="empty">
                            <h3>No axis groups</h3>
                            <Button icon={<Plus size={15} />} onClick={() => addAxisGroup(shownFile.id)}>
                                Add axis group
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="empty">
                    <h3>No scope files</h3>
                    <Button icon={<Plus size={15} />} onClick={addAndSelectFile}>
                        Add scope file
                    </Button>
                </div>
            )}

            <datalist id="port-presets">
                {PORT_PRESETS.map((p) => (
                    <option key={p.port} value={p.port}>
                        {p.label}
                    </option>
                ))}
            </datalist>
            <PatternLibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} />
        </section>
    )
}
