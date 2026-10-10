import { useRef, useState } from 'react'
import { FileUp, FolderUp, ListTree, Sparkles } from 'lucide-react'
import { useCatalogStore } from '@/state/catalogStore'
import { isFiltering, useBrowserStore } from '@/state/browserStore'
import { Button } from '@/ui/components/Button'
import demoTmc from '@/catalog/demo/DemoMachine.tmc?raw'
import { useFileImport } from './useFileImport'
import { SourceCard } from './SourceCard'
import { BrowserToolbar } from './BrowserToolbar'
import { SymbolTree } from './SymbolTree'
import { SearchResults } from './SearchResults'
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
    const importFiles = useCatalogStore((s) => s.importFiles)
    const filtering = useBrowserStore(isFiltering)
    const collapseAll = useBrowserStore((s) => s.collapseAll)
    const importFromDisk = useFileImport()
    const fileInput = useRef<HTMLInputElement>(null)
    const folderInput = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)

    const loadDemo = () => {
        importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        useBrowserStore.setState({ expanded: new Set(['source:DemoMachine.tmc#0']) })
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
                if (!e.dataTransfer.types.includes('Files')) return
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
                    {sources.length > 0 && (
                        <Button variant="ghost" size="sm" icon={<ListTree size={15} />} onClick={collapseAll}>
                            Collapse
                        </Button>
                    )}
                    <Button size="sm" icon={<FolderUp size={15} />} onClick={() => folderInput.current?.click()}>
                        Folder
                    </Button>
                    <Button size="sm" variant="primary" icon={<FileUp size={15} />} onClick={() => fileInput.current?.click()}>
                        Import files
                    </Button>
                </div>
                <input
                    ref={fileInput}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    hidden
                    data-testid="import-input"
                    onChange={(e) => {
                        if (e.target.files) void importFromDisk(e.target.files)
                        e.target.value = ''
                    }}
                />
                <input
                    ref={folderInput}
                    type="file"
                    hidden
                    // Non-standard but supported by every current browser.
                    {...{ webkitdirectory: '', directory: '' }}
                    onChange={(e) => {
                        if (e.target.files) void importFromDisk(e.target.files)
                        e.target.value = ''
                    }}
                />
            </header>

            {sources.length === 0 ? (
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
                        <Button variant="primary" icon={<FileUp size={16} />} onClick={() => fileInput.current?.click()}>
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
                    <div className="browser__list">{filtering ? <SearchResults index={index} /> : <SymbolTree sources={sources} />}</div>
                    <Inspector />
                    <SelectionBar />
                </>
            )}
            {dragOver && <div className="browser__drop-overlay">Drop to import</div>}
        </section>
    )
}
