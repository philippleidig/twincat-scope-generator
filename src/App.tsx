import { useEffect, useState } from 'react'
import { Binary, LayoutList } from 'lucide-react'
import { AppHeader } from '@/features/shell/AppHeader'
import { SymbolBrowser } from '@/features/browser/SymbolBrowser'
import { ProjectPanel } from '@/features/project/ProjectPanel'
import { Toaster } from '@/ui/components/Toaster'
import { useCatalogStore } from '@/state/catalogStore'
import './App.css'

type Pane = 'browser' | 'project'

export default function App() {
    const hydrate = useCatalogStore((s) => s.hydrate)
    // On narrow screens only one pane is shown at a time.
    const [pane, setPane] = useState<Pane>('browser')

    useEffect(() => {
        void hydrate()
    }, [hydrate])

    return (
        <div className="app">
            <AppHeader />
            <nav className="pane-switch segmented" aria-label="View">
                <button type="button" aria-pressed={pane === 'browser'} onClick={() => setPane('browser')}>
                    <Binary size={14} /> Symbols
                </button>
                <button type="button" aria-pressed={pane === 'project'} onClick={() => setPane('project')}>
                    <LayoutList size={14} /> Project
                </button>
            </nav>
            <main className={`workspace workspace--${pane}`}>
                <SymbolBrowser />
                <ProjectPanel />
            </main>
            <footer className="app-footer">
                Independent open-source tool — <strong>not a Beckhoff product</strong>, not affiliated with or endorsed by Beckhoff Automation
                GmbH &amp; Co. KG. “TwinCAT” is a trademark of its owner. Files never leave your browser.
            </footer>
            <Toaster />
        </div>
    )
}
