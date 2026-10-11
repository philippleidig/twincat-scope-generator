import { useState } from 'react'
import { FileUp, FolderUp, ListTree, Loader2, Sparkles } from 'lucide-react'
import { useCatalogStore } from '@/state/catalogStore'
import { browserBody, useBrowserStore } from '@/state/browserStore'
import { Button } from '@/ui/components/Button'
import { useFilePicker } from '@/ui/components/useFilePicker'
import demoTmc from '@/catalog/demo/DemoMachine.tmc?raw'
import { useFileImport } from './useFileImport'
import { SourceCard } from './SourceCard'
import { BrowserToolbar } from './BrowserToolbar'
import { SymbolTree } from './SymbolTree'
import { EntryList } from './EntryList'
import { SelectionBar } from './SelectionBar'
import { Inspector } from './Inspector'
import './browser.css'

const ACCEPT = '.tmc,.xti,.tsproj'

/**
 * Offline counterpart of the TwinCAT Target Browser: import project files, then
 * browse or search every symbol and pick what to record.
 */
export function SymbolBrowser() {
    const sources = useCatalogStore((s) => s.sources)
    const index = useCatalogStore((s) => s.index)
    const hydrated = useCatalogStore((s) => s.hydrated)
    const importFiles = useCatalogStore((s) => s.importFiles)
    const body = useBrowserStore(browserBody)
    const collapseAll = useBrowserStore((s) => s.collapseAll)
    const importFromDisk = useFileImport()
    const files = useFilePicker((f) => void importFromDisk(f), { accept: ACCEPT, multiple: true, testId: 'import-input' })
    const folder = useFilePicker((f) => void importFromDisk(f), { directory: true })
    const [dragOver, setDragOver] = useState(false)

    const loadDemo = () => {
        const [report] = importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        useBrowserStore.getState().expandSources(report.sourceIds)
    }

    return (
        <section
            className={`panel browser ${dragOver ? 'browser--drop' : ''}`}
            aria-label="Symbol browser"
            onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault()
                    setDragOver(true)
                }
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
            }}
            onDrop={(e) => {
                if (!e.dataTransfer.types.includes('Files') || !hydrated) return
                e.preventDefault()
                setDragOver(false)
                void importFromDisk(e.dataTransfer.files)
            }}
        >
            <header className="panel__header">
                <div>
                    <h2 className="panel__title">Symbol browser</h2>
                    <p className="panel__subtitle">Offline target browser for TwinCAT project files</p>
                </div>
                <div className="panel__actions">
                    {sources.length > 0 && body === 'tree' && (
                        <Button variant="ghost" size="sm" icon={<ListTree size={15} />} onClick={collapseAll}>
                            Collapse
                        </Button>
                    )}
                    <Button size="sm" icon={<FolderUp size={15} />} onClick={folder.open} disabled={!hydrated}>
                        Folder
                    </Button>
                    <Button size="sm" variant="primary" icon={<FileUp size={15} />} onClick={files.open} disabled={!hydrated}>
                        Import files
                    </Button>
                </div>
                {files.input}
                {folder.input}
            </header>

            {!hydrated ? (
                <div className="empty" role="status">
                    <Loader2 size={20} className="spin" aria-hidden />
                    <p>Restoring imported files…</p>
                </div>
            ) : sources.length === 0 ? (
                <div className="dropzone">
                    <div className="dropzone__art" aria-hidden>
                        <FileUp size={28} />
                    </div>
                    <h3>Drop TwinCAT files here</h3>
                    <p>
                        <code>.tmc</code> of a PLC project gives every PLC symbol; <code>.xti</code> and <code>.tsproj</code> add
                        NC axes, TcCOM objects and target addresses. Everything stays in your browser.
                    </p>
                    <div className="dropzone__actions">
                        <Button variant="primary" icon={<FileUp size={16} />} onClick={files.open}>
                            Choose files
                        </Button>
                        <Button icon={<Sparkles size={16} />} onClick={loadDemo}>
                            Try the demo machine
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <ul className="source-list" aria-label="Imported files">
                        {sources.map((s) => (
                            <SourceCard key={s.id} source={s} />
                        ))}
                    </ul>
                    <BrowserToolbar />
                    {index.truncated && (
                        <p className="browser-note">The symbol index is very large and was truncated; search may miss deep members.</p>
                    )}
                    <div className="browser__list">
                        {/* Keyed per body so the scroll position does not carry over between views. */}
                        {body === 'tree' ? <SymbolTree key="tree" sources={sources} /> : <EntryList key={body} index={index} mode={body} />}
                    </div>
                    <Inspector />
                    <SelectionBar />
                </>
            )}
            {dragOver && <div className="browser__drop-overlay">Drop to import</div>}
        </section>
    )
}
