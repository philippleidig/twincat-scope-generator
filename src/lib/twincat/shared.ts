import type { DataType } from '@/types'

/**
 * Maps Beckhoff/IEC scalar type names to internal DataType identifiers.
 * Returns null/undefined for non-scalar types (structs, enums, arrays, ...).
 */
export const BECKHOFF_TYPE_MAP: Record<string, DataType> = {
    BOOL: 'BIT',
    BIT: 'BIT',
    SINT: 'INT8',
    INT: 'INT16',
    DINT: 'INT32',
    LINT: 'INT64',
    BYTE: 'UINT8',
    USINT: 'UINT8',
    WORD: 'UINT16',
    UINT: 'UINT16',
    DWORD: 'UINT32',
    UDINT: 'UINT32',
    LWORD: 'UINT64',
    ULINT: 'UINT64',
    REAL: 'REAL32',
    LREAL: 'REAL64',
    TIME: 'UINT32',
    TIME_OF_DAY: 'UINT32',
    TOD: 'UINT32',
    DATE: 'UINT32',
    DATE_AND_TIME: 'UINT32',
    DT: 'UINT32',
    LTIME: 'UINT64',
}

/** Default ADS port suggested when adding a symbol to a scope file. */
export const DEFAULT_SUGGESTED_PORT = 851

/** Trimmed text content of an element, or '' for null. */
export function txt(el: Element | null | undefined): string {
    if (!el) return ''
    return (el.textContent ?? '').trim()
}

/** First direct child element with given tag name (case-insensitive). */
export function child(parent: Element, tagName: string): Element | null {
    const tag = tagName.toLowerCase()
    for (let i = 0; i < parent.children.length; i++) {
        const el = parent.children[i]
        if (el.tagName.toLowerCase() === tag) return el
    }
    return null
}

/** All direct children matching tag name (case-insensitive). */
export function children(parent: Element, tagName: string): Element[] {
    const tag = tagName.toLowerCase()
    const out: Element[] = []
    for (let i = 0; i < parent.children.length; i++) {
        const el = parent.children[i]
        if (el.tagName.toLowerCase() === tag) out.push(el)
    }
    return out
}

/** Convert a base64 BMP blob to a `data:image/bmp;base64,...` URL, or null. */
export function toBmpDataUrl(base64: string): string | null {
    const trimmed = base64.replace(/\s+/g, '')
    if (!trimmed) return null
    return `data:image/bmp;base64,${trimmed}`
}

/**
 * Read CreateSymbol property from a <Properties> block.
 *
 * In real TwinCAT TMC files most symbols and parameters do not carry a
 * CreateSymbol property — the default is to expose the symbol via ADS.
 * We mirror that behavior: missing -> defaultValue (true).
 */
export function readCreateSymbol(propsEl: Element | null, defaultValue: boolean = true): boolean {
    if (!propsEl) return defaultValue
    for (const p of children(propsEl, 'Property')) {
        const nameEl = child(p, 'Name')
        if (nameEl && txt(nameEl).toLowerCase() === 'createsymbol') {
            const v = txt(child(p, 'Value')).toLowerCase()
            return v === 'true' || v === '1'
        }
    }
    return defaultValue
}

/** Resolve a chain of type aliases via a TMC <DataTypes> map. */
export function resolveBaseType(typeName: string, aliasMap: Map<string, string>): string {
    let current = typeName.toUpperCase()
    let depth = 0
    while (aliasMap.has(current) && depth < 10) {
        current = aliasMap.get(current)!.toUpperCase()
        depth++
    }
    return current
}

/**
 * Build a TypeName -> BaseType map from the document's <DataTypes> sections.
 * Both TMC and XTI documents may include <DataTypes> blocks.
 */
export function buildAliasMap(doc: Document): Map<string, string> {
    const map = new Map<string, string>()
    const dtRoots = Array.from(doc.getElementsByTagName('DataTypes'))
    for (const root of dtRoots) {
        for (const dt of children(root, 'DataType')) {
            const nameEl = child(dt, 'Name')
            const baseEl = child(dt, 'BaseType')
            const name = txt(nameEl)
            const base = txt(baseEl)
            if (name && base) {
                map.set(name.toUpperCase(), base)
            }
        }
    }
    return map
}

/** Map a raw type name to the internal DataType, applying aliases. Returns null for non-scalars. */
export function mapDataType(rawType: string, aliasMap: Map<string, string>): DataType | null {
    if (!rawType) return null
    const resolved = resolveBaseType(rawType, aliasMap)
    return BECKHOFF_TYPE_MAP[resolved] ?? null
}

/** Sequential id helper used while building parse trees. */
let __idCounter = 0
export function nextId(prefix: string): string {
    __idCounter += 1
    return `${prefix}-${__idCounter}`
}

/** Reset the id counter (test only). */
export function __resetIdCounterForTests(): void {
    __idCounter = 0
}

/**
 * Run DOMParser, throwing on `<parsererror>` content. Returns the document.
 */
export function parseXmlOrThrow(content: string): Document {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/xml')
    const errEl = doc.getElementsByTagName('parsererror')[0]
    if (errEl) {
        throw new Error(`XML parse error: ${(errEl.textContent ?? '').trim() || 'unknown'}`)
    }
    if (!doc.documentElement) throw new Error('Empty XML document')
    return doc
}
