import { Plus, Trash2 } from 'lucide-react'
import { TICKS_PER_MS, amsNetIdError } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import { Dialog } from '@/ui/components/Dialog'
import { Button, IconButton } from '@/ui/components/Button'
import { NumberField, TextField } from '@/ui/components/Field'
import './settings.css'

/** Project-wide settings and the targets channels record from. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const project = useProjectStore((s) => s.project)
    const updateSettings = useProjectStore((s) => s.updateSettings)
    const addTarget = useProjectStore((s) => s.addTarget)
    const updateTarget = useProjectStore((s) => s.updateTarget)
    const removeTarget = useProjectStore((s) => s.removeTarget)
    const { settings, targets } = project

    return (
        <Dialog open={open} onClose={onClose} title="Project settings" width={640} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
            <div className="settings-grid">
                <TextField label="Project name" value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} />
                <TextField
                    label="Scope server (Main server)"
                    mono
                    value={settings.mainServer}
                    error={amsNetIdError(settings.mainServer)}
                    hint="AMS Net ID of the system that records"
                    onChange={(e) => updateSettings({ mainServer: e.target.value })}
                />
                <NumberField
                    label="Base sample time"
                    min={0.05}
                    step={0.05}
                    suffix="ms"
                    value={settings.baseSampleTime / TICKS_PER_MS}
                    onValueChange={(ms) => ms > 0 && updateSettings({ baseSampleTime: Math.max(1, Math.round(ms * TICKS_PER_MS)) })}
                />
                <NumberField
                    label="Record time"
                    min={1}
                    suffix="s"
                    value={settings.recordTime / (1000 * TICKS_PER_MS)}
                    onValueChange={(s) => s > 0 && updateSettings({ recordTime: Math.round(s * 1000 * TICKS_PER_MS) })}
                />
                <NumberField
                    label="Default port for new channels"
                    min={1}
                    list="port-presets"
                    value={settings.defaultPort}
                    onValueChange={(port) => port > 0 && updateSettings({ defaultPort: Math.round(port) })}
                />
            </div>

            <h3 className="settings-section">Targets</h3>
            <p className="settings-help">Every channel records from one target. Importing a .tsproj adds its target automatically.</p>
            <ul className="target-list">
                {targets.map((t) => (
                    <li key={t.id} className="target-row">
                        <TextField label="Name" hideLabel value={t.name} placeholder="Name" onChange={(e) => updateTarget(t.id, { name: e.target.value })} />
                        <TextField
                            label={`AMS Net ID of ${t.name}`}
                            hideLabel
                            mono
                            value={t.amsNetId}
                            error={amsNetIdError(t.amsNetId)}
                            onChange={(e) => updateTarget(t.id, { amsNetId: e.target.value })}
                        />
                        <IconButton label={`Remove target ${t.name}`} variant="danger" disabled={targets.length <= 1} onClick={() => removeTarget(t.id)}>
                            <Trash2 size={15} />
                        </IconButton>
                    </li>
                ))}
            </ul>
            <Button size="sm" icon={<Plus size={15} />} onClick={() => addTarget({ name: `Target ${targets.length + 1}`, amsNetId: '192.168.0.1.1.1' })}>
                Add target
            </Button>
        </Dialog>
    )
}
