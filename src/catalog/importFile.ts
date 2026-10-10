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
