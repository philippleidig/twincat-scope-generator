/**
 * The ADS symbol table TwinCAT downloads to a runtime, as stored in a boot project's
 * `CurrentConfig.xml` (`<InitCmd>` "IO: Download Symbols" with the target port): the reference the
 * importers are checked against (tests only).
 *
 * Binary layout as uploaded by ADS (`ADSIGRP_SYM_UPLOAD`): a 24-byte header (symbol count, symbol
 * bytes, data type count, data type bytes, …), then `AdsSymbolEntry`s and `AdsDatatypeEntry`s.
 */
export interface AdsSymbol {
    name: string
    type: string
    size: number
}

interface AdsDataType {
    name: string
    type: string
    dims: Array<{ lower: number; elements: number }>
    subItems: AdsDataType[]
}

export interface AdsSymbolTable {
    symbols: AdsSymbol[]
    types: Map<string, AdsDataType>
}

/** TwinCAT writes names in the Windows code page. */
const decoder = new TextDecoder('windows-1252')

function parseTable(bytes: Uint8Array): AdsSymbolTable {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const u32 = (o: number) => view.getUint32(o, true)
    const u16 = (o: number) => view.getUint16(o, true)
    const str = (o: number, n: number) => decoder.decode(bytes.subarray(o, o + n))

    const symbolBytes = u32(4)
    const typeBytes = u32(12)
    const symbols: AdsSymbol[] = []
    for (let o = 24; o < 24 + symbolBytes; o += u32(o)) {
        const nameLength = u16(o + 24)
        const typeLength = u16(o + 26)
        const name = str(o + 30, nameLength)
        symbols.push({ name, type: str(o + 31 + nameLength, typeLength), size: u32(o + 12) })
    }
    const dataType = (o: number): AdsDataType => {
        const [nameLength, typeLength, commentLength, arrayDims, subItems] = [0, 2, 4, 6, 8].map((d) => u16(o + 32 + d))
        let p = o + 42
        const name = str(p, nameLength)
        p += nameLength + 1
        const type = str(p, typeLength)
        p += typeLength + 1 + commentLength + 1
        const dims = Array.from({ length: arrayDims }, (_, i) => ({ lower: u32(p + 8 * i), elements: u32(p + 8 * i + 4) }))
        p += 8 * arrayDims
        const subs: AdsDataType[] = []
        for (let i = 0; i < subItems; i++) {
            subs.push(dataType(p))
            p += u32(p)
        }
        return { name, type, dims, subItems: subs }
    }
    const types = new Map<string, AdsDataType>()
    const start = 24 + symbolBytes
    for (let o = start; o < start + typeBytes; o += u32(o)) {
        const t = dataType(o)
        types.set(t.name, t)
    }
    return { symbols, types }
}

/** Symbol tables per ADS port downloaded by a boot project (`CurrentConfig.xml`). */
export function bootSymbolTables(doc: Document): Map<number, AdsSymbolTable> {
    const tables = new Map<number, AdsSymbolTable>()
    for (const cmd of doc.getElementsByTagName('InitCmd')) {
        const field = (tag: string) => (cmd.getElementsByTagName(tag)[0]?.textContent ?? '').trim()
        // Index group 0xF00D carries a plain symbol table (the PLC's 0xF01C is a different format).
        if (!field('key').endsWith('Download Symbols') || field('iGrp') !== String(0xf00d)) continue
        const hex = field('data')
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(2 * i, 2 * i + 2), 16)
        tables.set(Number(field('port')), parseTable(bytes))
    }
    return tables
}

/** Every scalar path of a table: symbols expanded through their struct types (arrays as `[*]`). */
export function leafPaths(table: AdsSymbolTable): string[] {
    const out: string[] = []
    const visit = (path: string, typeName: string, depth: number) => {
        const t = table.types.get(typeName)
        if (!t || t.subItems.length === 0 || depth > 16) {
            out.push(path)
            return
        }
        for (const s of t.subItems) visit(`${path}.${s.name}${s.dims.length > 0 ? `[${s.dims.map(() => '*').join(',')}]` : ''}`, s.type, depth + 1)
    }
    for (const s of table.symbols) visit(s.name, s.type, 0)
    return out
}
