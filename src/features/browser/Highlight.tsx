/** Renders `text` with every occurrence of the plain search words marked. */
export function Highlight({ text, words }: { text: string; words: string[] }) {
    if (words.length === 0) return <>{text}</>
    const lower = text.toLowerCase()
    const marks: Array<[number, number]> = []
    for (const w of words) {
        let i = lower.indexOf(w)
        while (w && i !== -1) {
            marks.push([i, i + w.length])
            i = lower.indexOf(w, i + w.length)
        }
    }
    if (marks.length === 0) return <>{text}</>
    marks.sort((a, b) => a[0] - b[0])
    const parts = []
    let pos = 0
    for (const [start, end] of marks) {
        if (start < pos) continue
        if (start > pos) parts.push(text.slice(pos, start))
        parts.push(<mark key={start}>{text.slice(start, end)}</mark>)
        pos = end
    }
    parts.push(text.slice(pos))
    return <>{parts}</>
}
