import { useMemo, useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { projectIssues } from '@/domain/project'
import { generateProject, planProject } from '@/export/tcscopex'
import { createZipArchive, downloadBlob } from '@/export/bundle'
import { useProjectStore } from '@/state/projectStore'
import { toast } from '@/state/toastStore'
import { Button } from '@/ui/components/Button'

export function ExportButton() {
    const project = useProjectStore((s) => s.project)
    const [busy, setBusy] = useState(false)
    const plan = useMemo(() => planProject(project), [project])
    const issues = useMemo(() => projectIssues(project), [project])
    const acquisitions = plan.reduce((n, f) => n + f.acquisitionCount, 0)

    const exportZip = async () => {
        setBusy(true)
        try {
            const generated = generateProject(project)
            const blob = await createZipArchive(generated)
            downloadBlob(blob, generated.tcmproj.fileName.replace(/\.tcmproj$/, '_scope.zip'))
            toast.success(`Exported ${generated.scopeFiles.length} scope file${generated.scopeFiles.length === 1 ? '' : 's'} · ${acquisitions} acquisitions`)
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
                <strong>{plan.length}</strong> file{plan.length === 1 ? '' : 's'} · <strong>{acquisitions}</strong> acquisitions
            </span>
            {issues.length > 0 && (
                <span className="export__issues" title={issues.join('\n')} aria-label={`${issues.length} issues: ${issues.join('; ')}`}>
                    <AlertTriangle size={15} /> {issues.length}
                </span>
            )}
            <Button
                variant="primary"
                icon={<Download size={16} />}
                disabled={acquisitions === 0 || busy}
                title={acquisitions === 0 ? 'Add at least one valid channel' : 'Download .tcmproj with all .tcscopex files'}
                onClick={exportZip}
            >
                {busy ? 'Exporting…' : 'Export ZIP'}
            </Button>
        </div>
    )
}
