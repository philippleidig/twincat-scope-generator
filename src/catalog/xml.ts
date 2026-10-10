/** Small DOM helpers for TwinCAT XML files (element names are matched case-sensitively, as TwinCAT writes them). */

export function parseXml(content: string): Document {
    const doc = new DOMParser().parseFromString(content.replace(/^\uFEFF/, ''), 'text/xml')
    // Chrome nests <parsererror> (namespaced) inside the document, Firefox makes it the root.
    const error = doc.getElementsByTagName('parsererror')[0]
    if (error) throw new Error(`Not a valid XML file: ${(error.textContent ?? '').trim().split('\n')[0] || 'parse error'}`)
    return doc
}

export function children(parent: Element, tag: string): Element[] {
    const out: Element[] = []
    for (const el of parent.children) if (el.tagName === tag) out.push(el)
    return out
}

export function child(parent: Element, tag: string): Element | null {
    for (const el of parent.children) if (el.tagName === tag) return el
    return null
}

/** Trimmed text of the first child with this tag, or ''. */
export function text(parent: Element, tag: string): string {
    return (child(parent, tag)?.textContent ?? '').trim()
}

/** `<Properties><Property><Name>n</Name><Value>v</Value></Property>…` as a map; flag properties map to ''. */
export function properties(parent: Element): Map<string, string> {
    const map = new Map<string, string>()
    const props = child(parent, 'Properties')
    if (!props) return map
    for (const p of children(props, 'Property')) map.set(text(p, 'Name'), text(p, 'Value'))
    return map
}
