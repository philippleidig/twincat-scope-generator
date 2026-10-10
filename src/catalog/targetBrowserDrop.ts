/**
 * Symbols dragged from the TwinCAT Target Browser arrive as an XML payload
 * (`<TargetBrowserExportInfo>`) with the target address, the symbols and the
 * data types they use.
 */
import type { ScopeDataType } from '@/domain/dataTypes'
import { readTypeTable, resolveType } from './typeTable'
import { parseXml, text } from './xml'

export interface DroppedSymbol {
    symbol: string
    dataType: ScopeDataType
    port: number
    amsNetId?: string
}

export interface DropResult {
    symbols: DroppedSymbol[]
    /** Symbols that were dropped but cannot be recorded, with the reason. */
    skipped: string[]
}

export function parseTargetBrowserDrop(xml: string): DropResult {
    let doc: Document
    try {
        doc = parseXml(xml)
    } catch {
        return { symbols: [], skipped: [] }
    }
    const address = doc.querySelector('TargetInfo AmsAddress')
    const port = Number.parseInt(address ? text(address, 'Port') : '', 10)
    const amsNetId = (address && text(address, 'NetId')) || undefined
    const types = readTypeTable(doc)

    const result: DropResult = { symbols: [], skipped: [] }
    for (const el of doc.querySelectorAll('Symbols > Symbol')) {
        const name = text(el, 'Name')
        if (!name) continue
        const resolved = resolveType(types, text(el, 'BaseType') || text(el, 'Type'))
        if (resolved.kind === 'scalar') {
            result.symbols.push({ symbol: name, dataType: resolved.scopeType, port: Number.isFinite(port) ? port : 851, amsNetId })
        } else {
            result.skipped.push(`${name} (${resolved.typeName})`)
        }
    }
    return result
}
