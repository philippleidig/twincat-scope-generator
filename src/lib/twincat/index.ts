import type { ParseResult, ParsedTcomObject, ParsedSymbol } from './types'
import { parseTmc } from './tmcParser'
import { parseXti } from './xtiParser'

export { parseTmc } from './tmcParser'
export { parseXti } from './xtiParser'
export type { ParseResult, ParsedTcomObject, ParsedSymbol, ParsedSymbolGroup, SymbolGroupKind } from './types'

/**
 * Dispatcher: routes to the TMC or XTI parser based on the file extension
 * (preferred) or, as a fallback, the document's root element name.
 *
 * TMC and XTI are different formats — see tmcParser.ts and xtiParser.ts for
 * the structural details. This wrapper exists so callers don't need to know
 * which parser to use.
 */
export function parseTwinCatFile(fileName: string, content: string): ParseResult {
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.tmc')) return parseTmc(fileName, content)
    if (lower.endsWith('.xti')) return parseXti(fileName, content)

    // Unknown extension: peek at the root element to decide.
    const headMatch = content.match(/<\s*([A-Za-z0-9_]+)/)
    const root = headMatch?.[1] ?? ''
    if (root === 'TcModuleClass') return parseTmc(fileName, content)
    if (root === 'TcSmItem') return parseXti(fileName, content)

    throw new Error(
        `Unrecognized file: extension is not .tmc/.xti and root element <${root || 'unknown'}> ` +
        'is neither TcModuleClass nor TcSmItem.',
    )
}

/** Flatten the TcCOM object tree into a list (parents before children). */
export function flattenObjects(objects: ParsedTcomObject[]): ParsedTcomObject[] {
    const out: ParsedTcomObject[] = []
    const walk = (list: ParsedTcomObject[]) => {
        for (const o of list) {
            out.push(o)
            if (o.children.length > 0) walk(o.children)
        }
    }
    walk(objects)
    return out
}

/** Iterate all symbols in a parse result. */
export function* iterAllSymbols(objects: ParsedTcomObject[]): Generator<ParsedSymbol> {
    for (const obj of flattenObjects(objects)) {
        for (const grp of obj.groups) {
            for (const sym of grp.symbols) yield sym
        }
    }
}
