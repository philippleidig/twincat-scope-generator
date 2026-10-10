import { useRef, useState } from 'react'
import { Activity, FilePlus2, FolderOpen, MessageSquarePlus, Monitor, Moon, MoreHorizontal, Save, Settings, Sun } from 'lucide-react'
import { parseProject } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import { toast } from '@/state/toastStore'
import { downloadText } from '@/export/bundle'
import { IconButton } from '@/ui/components/Button'
import { Menu } from '@/ui/components/Menu'
import { GithubIcon } from '@/ui/components/GithubIcon'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { ExportButton } from './ExportButton'
import type { Theme } from './useTheme'
import { useTheme } from './useTheme'

const REPO_URL = 'https://github.com/philippleidig/twincat-scope-generator'
const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }

export function AppHeader() {
    const name = useProjectStore((s) => s.project.settings.name)
    const updateSettings = useProjectStore((s) => s.updateSettings)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [theme, setTheme] = useTheme()
    const openInput = useRef<HTMLInputElement>(null)
    const ThemeIcon = THEME_ICON[theme]

    const saveProject = () => {
        const { project } = useProjectStore.getState()
        downloadText(JSON.stringify(project, null, 2), `${project.settings.name.replace(/[^\w.-]+/g, '_') || 'project'}.scope.json`)
    }
    const newProject = () => {
        if (window.confirm('Start a new project? The current project is replaced (save it first if you need it).')) {
            useProjectStore.getState().reset()
        }
    }

    return (
        <header className="app-header">
            <div className="brand">
                <span className="brand__mark" aria-hidden>
                    <Activity size={18} />
                </span>
                <div className="brand__text">
                    <span className="brand__name">Scope Generator</span>
                    <span className="brand__sub">for TwinCAT Scope · offline</span>
                </div>
            </div>
            <input className="project-name" value={name} aria-label="Project name" onChange={(e) => updateSettings({ name: e.target.value })} />
            <div className="app-header__spacer" />
            <ExportButton />
            <Menu
                trigger={(props) => (
                    <button type="button" className="btn btn--ghost btn--md btn--icon" aria-label="Project menu" {...props}>
                        <MoreHorizontal size={18} />
                    </button>
                )}
                items={[
                    { label: 'Save project file', icon: <Save size={15} />, onSelect: saveProject },
                    { label: 'Open project file…', icon: <FolderOpen size={15} />, onSelect: () => openInput.current?.click() },
                    { label: 'New project', icon: <FilePlus2 size={15} />, onSelect: newProject, danger: true },
                ]}
            />
            <IconButton label="Project settings" size="md" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
            </IconButton>
            <IconButton label={`Theme: ${theme}`} size="md" onClick={() => setTheme(NEXT_THEME[theme])}>
                <ThemeIcon size={18} />
            </IconButton>
            <a className="btn btn--ghost btn--md btn--icon header-link" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="GitHub repository">
                <GithubIcon size={18} />
            </a>
            <a className="btn btn--ghost btn--md btn--icon header-link" href={`${REPO_URL}/issues/new/choose`} target="_blank" rel="noopener noreferrer" aria-label="Give feedback" title="Give feedback">
                <MessageSquarePlus size={18} />
            </a>
            <input
                ref={openInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    try {
                        useProjectStore.getState().replaceProject(parseProject(JSON.parse(await file.text())))
                        toast.success(`Opened ${file.name}`)
                    } catch (err) {
                        toast.warning(`Cannot open ${file.name}: ${err instanceof Error ? err.message : 'invalid file'}`)
                    }
                }}
            />
            <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </header>
    )
}
