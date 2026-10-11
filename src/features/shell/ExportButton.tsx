import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Download, Share } from 'lucide-react'
import type { Project } from '@/domain/project'
import { fileAcquisitionCount, projectAcquisitionCount } from '@/domain/project'
import { exportBlocker, projectIssues } from '@/domain/projectValidation'
import type { GeneratedProject } from '@/export/tcscopex'
import { generateProject } from '@/export/tcscopex'
import { canShareZip, createZipArchive, downloadBlob, shareZip } from '@/export/bundle'
import { useProjectStore } from '@/state/projectStore'
import { toast } from '@/state/toastStore'
import { Button, IconButton } from '@/ui/components/Button'

interface BuiltZip {
    project: Project
    generated: GeneratedProject
    blob: Blob
    fileName: string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function ExportButton() {
    const project = useProjectStore((s) => s.project)
    const [busy, setBusy] = useState(false)
    const [canShare] = useState(canShareZip)
    // The last zip, reused while the project is unchanged: a retry after the browser blocked
    // the share sheet then calls share() right away, still inside the tap that asked for it.
    const built = useRef<BuiltZip | null>(null)
    const issues = useMemo(() => projectIssues(project), [project])
    const files = project.scopeFiles.filter((f) => fileAcquisitionCount(f) > 0).length
    const acquisitions = projectAcquisitionCount(project)
    const blocker = exportBlocker(project)

    const build = async (): Promise<BuiltZip> => {
        if (built.current?.project === project) return built.current
        const generated = generateProject(project)
        const blob = await createZipArchive(generated)
        const fileName = generated.tcmproj.fileName.replace(/\.tcmproj$/, '_scope.zip')
        built.current = { project, generated, blob, fileName }
        return built.current
    }

    const run = async (action: (zip: BuiltZip) => Promise<string | null>, failure: string) => {
        setBusy(true)
        try {
            const message = await action(await build())
            if (message === null) return
            toast.success(message)
            // One toast for all issues, so it does not push the success message out; the icon lists them all.
            if (issues.length > 0) toast.warning(issues.length === 1 ? issues[0] : `${issues.length} issues: ${issues[0]} — and ${issues.length - 1} more`)
        } catch (e) {
            if (e instanceof DOMException && e.name === 'NotAllowedError') toast.warning('The browser blocked the share sheet — tap Share again.')
            else toast.warning(`${failure}: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setBusy(false)
        }
    }

    const exportZip = () =>
        run(async ({ generated, blob, fileName }) => {
            downloadBlob(blob, fileName)
            return `Exported ${plural(generated.scopeFiles.length, 'scope file')} · ${generated.tcmproj.acquisitionCount} acquisitions`
        }, 'Export failed')

    const share = () =>
        run(async ({ generated, blob, fileName }) => {
            const shared = await shareZip(blob, fileName, project.settings.name)
            return shared ? `Shared ${plural(generated.scopeFiles.length, 'scope file')} as ${fileName}` : null
        }, 'Sharing failed')

    return (
        <div className="export">
            <span className="export__summary" aria-live="polite">
                <strong>{files}</strong> file{files === 1 ? '' : 's'} · <strong>{acquisitions.toLocaleString()}</strong> acquisitions
            </span>
            {issues.length > 0 && (
                <span className="export__issues" title={issues.join('\n')} aria-label={`${issues.length} issues: ${issues.join('; ')}`}>
                    <AlertTriangle size={15} /> {issues.length}
                </span>
            )}
            {canShare && (
                <IconButton label="Share ZIP (Mail, Teams, …)" size="md" disabled={!!blocker || busy} onClick={share}>
                    <Share size={18} />
                </IconButton>
            )}
            <Button
                variant="primary"
                icon={<Download size={16} />}
                disabled={!!blocker || busy}
                title={blocker ?? 'Download .tcmproj with all .tcscopex files'}
                onClick={exportZip}
            >
                {busy ? (
                    'Exporting…'
                ) : (
                    <>
                        Export{' '}
                        <span className="narrow-hide">ZIP</span>
                    </>
                )}
            </Button>
        </div>
    )
}
