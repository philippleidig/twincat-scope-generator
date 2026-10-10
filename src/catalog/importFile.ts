import type { SymbolSource } from './model'
import { importSystemManager } from './systemManager'
import { importTmc } from './tmc'
import { parseXml } from './xml'

export const SUPPORTED_EXTENSIONS = ['.tmc', '.xti', '.tsproj'] as const

/** Import a TwinCAT file by its root element (the extension is not trusted). */
export function importTwinCatFile(fileName: string, content: string): SymbolSource[] {
    const doc = parseXml(content)
    switch (doc.documentElement.tagName) {
        case 'TcModuleClass':
            return importTmc(fileName, doc)
        case 'TcSmItem':
        case 'TcSmProject':
            return importSystemManager(fileName, doc)
        default:
            throw new Error(
                `${fileName}: unsupported file (root element <${doc.documentElement.tagName}>). Expected a .tmc, .xti or .tsproj file.`,
            )
    }
}

/**
 * Add freshly imported sources to the existing ones:
 * - a re-imported file replaces what it contributed before;
 * - a partial listing (PLC I/O from a `.tsproj`) is dropped when a complete source for the
 *   same runtime (the PLC's `.tmc`: same kind and port) is present;
 * - when the files name exactly one target Net ID (a `.tsproj`), sources without one get it —
 *   in split projects the `.tsproj` holds the Net ID while `.xti`/`.tmc` files hold the symbols.
 */
export function mergeSources(existing: SymbolSource[], imported: SymbolSource[]): SymbolSource[] {
    const files = new Set(imported.map((s) => s.fileName))
    const all = [...existing.filter((s) => !files.has(s.fileName)), ...imported]
    const complete = new Set(all.filter((s) => s.complete).map((s) => `${s.kind}:${s.port}`))
    const netIds = new Set(all.map((s) => s.amsNetId).filter(Boolean))
    const sharedNetId = netIds.size === 1 ? [...netIds][0] : undefined
    return all
        .filter((s) => s.complete || !complete.has(`${s.kind}:${s.port}`))
        .map((s) => (sharedNetId && !s.amsNetId ? { ...s, amsNetId: sharedNetId } : s))
}
