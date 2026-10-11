import { useMemo, useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { fileAcquisitionCount, projectAcquisitionCount } from '@/domain/project'
import { exportBlocker, projectIssues } from '@/domain/projectValidation'
import { generateProject } from '@/export/tcscopex'
import { createZipArchive, downloadBlob } from '@/export/bundle'
import { useProjectStore } from '@/state/projectStore'
import { toast } from '@/state/toastStore'
import { Button } from '@/ui/components/Button'

export function ExportButton() {
    const project = useProjectStore((s) => s.project)
    const [busy, setBusy] = useState(false)
    const issues = useMemo(() => projectIssues(project), [project])
    const files = project.scopeFiles.filter((f) => fileAcquisitionCount(f) > 0).length
    const acquisitions = projectAcquisitionCount(project)
    const blocker = exportBlocker(project)

    const exportZip = async () => {
        setBusy(true)
        try {
            const generated = generateProject(project)
            const blob = await createZipArchive(generated)
            downloadBlob(blob, generated.tcmproj.fileName.replace(/\.tcmproj$/, '_scope.zip'))
            const n = generated.scopeFiles.length
            toast.success(`Exported ${n} scope file${n === 1 ? '' : 's'} · ${generated.tcmproj.acquisitionCount} acquisitions`)
            for (const issue of issues) toast.warning(issue)
        } catch (e) {
            toast.warning(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setBusy(false)
        }
    }

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
            <Button
                variant="primary"
                icon={<Download size={16} />}
                disabled={!!blocker || busy}
                title={blocker ?? 'Download .tcmproj with all .tcscopex files'}
                onClick={exportZip}
            >
                {busy ? 'Exporting…' : 'Export ZIP'}
            </Button>
        </div>
    )
}
