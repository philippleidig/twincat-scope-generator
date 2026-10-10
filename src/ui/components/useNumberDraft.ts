import { useState } from 'react'

/**
 * Props for a numeric <input> bound to a number. While the user edits, the raw text
 * is kept (so the field can be cleared or hold "0."), and only valid numbers are
 * committed; on blur the field shows the committed value again.
 */
export function useNumberDraft(value: number, commit: (n: number) => void) {
    const [draft, setDraft] = useState<string | null>(null)
    return {
        type: 'number' as const,
        value: draft ?? String(value),
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const text = e.target.value
            setDraft(text)
            const n = Number(text)
            if (text.trim() !== '' && Number.isFinite(n)) commit(n)
        },
        onBlur: () => setDraft(null),
    }
}
