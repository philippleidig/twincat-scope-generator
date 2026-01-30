import { GlobalSettings } from '@/components/GlobalSettings'
import { ScopeFileManager } from '@/components/ScopeFileManager'
import { ExamplePatterns } from '@/components/ExamplePatterns'
import { DownloadButton } from '@/components/DownloadButton'
import { SettingsIcon, GithubIcon, FeedbackIcon } from '@/components/ui'

const APP_VERSION = 'V1.2'

const ISSUES_URL = 'https://github.com/philippleidig/twincat-scope-generator/issues/new/choose'
import './App.css'

function App() {
    return (
        <div className="app">
            <header className="app-header">
                <div className="header-content">
                    <div className="header-left">
                        <div className="logo">
                            <SettingsIcon size={28} className="logo-icon" />
                            <h1>TwinCAT Scope Generator</h1>
                        </div>
                        <p className="tagline">
                            Generate TwinCAT Scope configuration files with pattern-based symbol expansion
                        </p>
                    </div>
                    <div className="header-actions">
                        <span className="version-badge">{APP_VERSION}</span>
                        <a
                            href="https://github.com/philippleidig/twincat-scope-generator"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="header-link"
                            title="GitHub Repository"
                        >
                            <GithubIcon size={20} />
                        </a>
                        <a
                            href={ISSUES_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="header-link"
                            title="Give Feedback"
                        >
                            <FeedbackIcon size={20} />
                        </a>
                    </div>
                </div>
            </header>

            <main className="app-main">
                <div className="app-content">
                    <div className="left-column">
                        <GlobalSettings />
                        <DownloadButton />
                    </div>

                    <div className="center-column">
                        <ScopeFileManager />
                    </div>

                    <div className="right-column">
                        <ExamplePatterns />
                    </div>
                </div>
            </main>

            <footer className="app-footer">
                <p>
                    TwinCAT Scope Configuration Generator •
                    Uses <code>.tcscopex</code> and <code>.tcmproj</code> formats
                </p>
            </footer>
        </div>
    )
}

export default App
