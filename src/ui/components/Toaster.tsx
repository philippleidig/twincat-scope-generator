import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { useToasts } from '@/state/toastStore'

const ICONS = { success: CheckCircle2, warning: AlertTriangle, info: Info }

export function Toaster() {
    const { toasts, dismiss } = useToasts()
    return (
        <div className="toaster" role="status" aria-live="polite">
            {toasts.map((t) => {
                const Icon = ICONS[t.tone]
                return (
                    <div key={t.id} className={`toast toast--${t.tone}`}>
                        <Icon size={18} aria-hidden />
                        <span>{t.message}</span>
                        <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                            <X size={14} />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
