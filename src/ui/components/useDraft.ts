import { useState } from 'react'

/**
 * Props for a text input whose value is only committed on blur or Enter — for fields
 * where every change is expensive (re-indexing a catalog) or must not be trimmed while typing.
 */
export function useDraft(value: string, commit: (text: string) => void) {
    const [draft, setDraft] = useState<string | null>(null)
    const finish = () => {
        if (draft !== null && draft !== value) commit(draft)
        setDraft(null)
    }
    return {
        value: draft ?? value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
        onBlur: finish,
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setDraft(null)
        },
    }
}
