import { useRef, useState } from 'react'
import { Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import { expansionCount, validateTemplate } from '@/domain/pattern'
import { findAxisGroup } from '@/domain/project'
import { useSampleStore } from '@/state/sampleStore'
import { useProjectStore } from '@/state/projectStore'
import { toast } from '@/state/toastStore'
import { downloadText } from '@/export/bundle'
import { Dialog } from '@/ui/components/Dialog'
import { Button, IconButton } from '@/ui/components/Button'
import { TextField } from '@/ui/components/Field'

/** Saved templates plus the counter syntax, one click away from the active axis group. */
export function PatternLibraryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { samples, addSample, removeSample, resetToDefaults, importSamples, exportSamples } = useSampleStore()
    const [template, setTemplate] = useState('')
    const [description, setDescription] = useState('')
    const fileInput = useRef<HTMLInputElement>(null)
    const validation = template.trim() ? validateTemplate(template) : null

    const insert = (symbol: string) => {
        const { activeAxisGroupId, project, addChannels } = useProjectStore.getState()
        const group = activeAxisGroupId ? findAxisGroup(project, activeAxisGroupId) : undefined
        if (!group) {
            toast.warning('Select an axis group first.')
            return
        }
        addChannels(group.id, [{ symbol }])
        toast.success(`Added to ${group.name}`)
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Pattern library"
            width={680}
            description={
                <>
                    Counters <code>{'{name:start:end}'}</code> expand a channel into many acquisitions. Reusing a name keeps values in sync;
                    leading zeros (<code>{'{i:01:12}'}</code>) pad the numbers.
                </>
            }
            footer={
                <>
                    <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={resetToDefaults}>
                        Reset
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Upload size={14} />} onClick={() => fileInput.current?.click()}>
                        Import
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => downloadText(exportSamples(), 'scope-patterns.json')}>
                        Export
                    </Button>
                    <input
                        ref={fileInput}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={async (e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (!file) return
                            try {
                                const n = importSamples(JSON.parse(await file.text()))
                                if (n > 0) toast.success(`Imported ${n} patterns`)
                                else toast.warning('The file contains no valid patterns.')
                            } catch {
                                toast.warning('Not a valid JSON file.')
                            }
                        }}
                    />
                </>
            }
        >
            <ul className="library">
                {samples.map((s) => (
                    <li key={s.id} className="library__item">
                        <div className="library__text">
                            <code>{s.template}</code>
                            <span>
                                {s.description} · {expansionCount(s.template)} acquisitions
                            </span>
                        </div>
                        <Button size="sm" onClick={() => insert(s.template)}>
                            Insert
                        </Button>
                        <IconButton label={`Delete pattern ${s.template}`} variant="danger" onClick={() => removeSample(s.id)}>
                            <Trash2 size={14} />
                        </IconButton>
                    </li>
                ))}
            </ul>
            <form
                className="library__add"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (!validation?.valid) return
                    addSample(template.trim(), description.trim())
                    setTemplate('')
                    setDescription('')
                }}
            >
                <TextField label="New pattern" mono value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="GVL.aAxis[{i:1:8}].fActPos" error={validation && !validation.valid ? validation.errors[0] : null} />
                <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
                <Button type="submit" variant="secondary" icon={<Plus size={15} />} disabled={!validation?.valid}>
                    Save
                </Button>
            </form>
        </Dialog>
    )
}
