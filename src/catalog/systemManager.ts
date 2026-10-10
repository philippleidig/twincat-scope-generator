/**
 * System Manager files: exported tree items (`.xti`, root `<TcSmItem>`) and whole
 * projects (`.tsproj`, root `<TcSmProject>`). Both use the same building blocks, so
 * one walker finds every part we can browse, wherever it sits in the tree:
 *
 * - PLC instances  `<Project AmsPort="851"><Instance><Vars VarGrpType="1|2|…"><Var>`:
 *   the variables linked to I/O, with full ADS names. (All PLC symbols are in the
 *   PLC's `.tmc`, which is preferred when both are imported.)
 * - TcCOM objects  `<Module><Name>instance</Name><TmcDesc>…<Parameters>/<DataAreas>`
 * - NC axes        `<Axis><Name>…<Vars>`, `<Encoder>`/`<Drive>` with their own `<Vars>`
 *
 * Items saved as separate files (`<Axis File="Axis 1.xti"/>`) are reported so they can
 * be imported too. `__FILENAME__` names stand for the file's own name.
 */
import type { AreaKind, SymbolRoot, SymbolSource, TypeTable } from './model'
import { DEFAULT_PLC_PORT, DEFAULT_TCCOM_PORT, TCCOM_PREFIX_HINT, readModuleRoots } from './tmc'
import { readArrayDims, readTypeTable, typeNameOf } from './typeTable'
import { child, children, text } from './xml'

export const DEFAULT_NC_PORT = 501

function fileStem(fileName: string): string {
    const base = fileName.split(/[\\/]/).pop() ?? fileName
    const dot = base.lastIndexOf('.')
    return dot > 0 ? base.slice(0, dot) : base
}

function readPort(el: Element | null): number | null {
    const n = Number.parseInt(el?.getAttribute('AmsPort') ?? '', 10)
    return Number.isFinite(n) && n > 0 ? n : null
}

/** VarGrpType 1 = inputs, 2 = outputs; everything else (retains, internal) counts as internal. */
const varGroupArea = (vars: Element): AreaKind =>
    vars.getAttribute('VarGrpType') === '1' ? 'input' : vars.getAttribute('VarGrpType') === '2' ? 'output' : 'internal'

/** `<Vars>` → roots named `${prefix}${var}`. */
function readVars(owner: Element, prefix: (groupName: string) => string): SymbolRoot[] {
    const roots: SymbolRoot[] = []
    for (const vars of children(owner, 'Vars')) {
        const groupName = text(vars, 'Name') || 'Vars'
        for (const v of children(vars, 'Var')) {
            const name = text(v, 'Name')
            const typeEl = child(v, 'Type') ?? child(v, 'BaseType')
            const type = typeNameOf(typeEl)
            if (!name || !type) continue
            roots.push({
                name: `${prefix(groupName)}${name}`,
                type,
                ns: typeEl?.getAttribute('Namespace') || undefined,
                dims: readArrayDims(v),
                area: varGroupArea(vars),
                areaName: groupName,
                comment: text(v, 'Comment') || undefined,
            })
        }
    }
    return roots
}

const all = (doc: Document, tag: string) => Array.from(doc.getElementsByTagName(tag))

export function importSystemManager(fileName: string, doc: Document): SymbolSource[] {
    const types: TypeTable = readTypeTable(doc)
    const stem = fileStem(fileName)
    const nameOf = (el: Element, fallback: string) => {
        const n = text(el, 'Name')
        return !n || n === '__FILENAME__' ? fallback : n
    }
    const amsNetId = all(doc, 'Project').map((p) => p.getAttribute('TargetNetId')).find(Boolean) ?? undefined
    const sources: SymbolSource[] = []
    const references: string[] = []
    const base = (index: number) => ({ id: `${fileName}#${index}`, fileName, types, amsNetId })

    // PLC instances
    for (const el of doc.querySelectorAll('[File]')) references.push(el.getAttribute('File')!)

    for (const project of all(doc, 'Project')) {
        const instance = child(project, 'Instance')
        if (!instance) continue
        const title = project.getAttribute('Name') || stem
        const roots = readVars(instance, () => '')
        sources.push({
            ...base(sources.length),
            kind: 'PLC',
            title: `${title} (PLC I/O)`,
            pathPrefix: '',
            port: readPort(project) ?? DEFAULT_PLC_PORT,
            roots,
            warnings: [
                'Only variables linked to I/O are listed here. Import the PLC project\'s .tmc for all symbols.',
            ],
        })
    }

    // TcCOM objects
    for (const module of all(doc, 'Module')) {
        const body = child(module, 'TmcDesc') ?? module
        if (!child(body, 'Parameters') && !child(body, 'DataAreas')) continue
        const instance = nameOf(module, stem)
        sources.push({
            ...base(sources.length),
            kind: 'TcCOM',
            title: instance,
            pathPrefix: instance,
            port: readPort(module) ?? DEFAULT_TCCOM_PORT,
            roots: readModuleRoots(body, types, false),
            warnings: [TCCOM_PREFIX_HINT],
        })
    }

    // NC axes
    const ncPort = all(doc, 'SafTask').map(readPort).find((p) => p !== null) ?? DEFAULT_NC_PORT
    const axisRoots: SymbolRoot[] = []
    for (const axis of all(doc, 'Axis')) {
        if (axis.getAttribute('File')) continue
        const axisName = nameOf(axis, stem)
        axisRoots.push(...readVars(axis, (g) => `${axisName}.${g}.`))
        for (const tag of ['Encoder', 'Drive', 'Controller']) {
            for (const part of children(axis, tag)) {
                const partName = part.getAttribute('Name') || tag
                axisRoots.push(...readVars(part, (g) => `${axisName}.${partName}.${g}.`))
            }
        }
    }
    if (axisRoots.length > 0) {
        sources.push({
            ...base(sources.length),
            kind: 'NC',
            title: 'NC axes',
            pathPrefix: '',
            port: ncPort,
            roots: axisRoots,
            warnings: ['NC symbol paths are built as "<axis>.<Enc|Drive>.<Inputs|Outputs>.<variable>"; verify them against your target.'],
        })
    }

    const warnings: string[] = []
    if (references.length > 0) {
        warnings.push(`Parts of this project are stored in separate files; import them as well: ${references.join(', ')}`)
    }
    if (all(doc, 'Pdo').length > 0 && sources.length === 0) {
        warnings.push('EtherCAT process data cannot be recorded by symbol name; record the PLC or TcCOM variables linked to it.')
    }
    if (sources.length === 0) {
        return [{ ...base(0), kind: 'Other', title: stem, pathPrefix: '', port: DEFAULT_PLC_PORT, roots: [], warnings: warnings.length ? warnings : ['No PLC, TcCOM or NC symbols found in this file.'] }]
    }
    sources[0].warnings.push(...warnings)
    return sources
}
