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
 * - I/O devices    `<Device><Image>…<Box>`: the process image by ADS symbol name (`io.ts`)
 *
 * Items saved as separate files (`<Axis File="Axis 1.xti"/>`) are reported so they can
 * be imported too. `__FILENAME__` names stand for the file's own name.
 */
import type { AreaKind, SymbolRoot, SymbolSource, TypeTable } from './model'
import { readIoSources } from './io'
import { DEFAULT_PLC_PORT, DEFAULT_TCCOM_PORT, TCCOM_PREFIX_HINT, parameterNote, readModuleRoots } from './tmc'
import { finalizeSource, readTypeRef, readTypeTable } from './typeTable'
import { child, children, text } from './xml'

export const DEFAULT_NC_PORT = 501

/**
 * Axis state values TwinCAT exposes by name below every NC axis (Infosys: "Index offset
 * specification for axis state", symbolic access names).
 */
const AXIS_STATE = ['ActPos', 'SetPos', 'ActVelo', 'SetVelo', 'ActAcc', 'SetAcc', 'PosDiff', 'ActTorque']

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
            const { type, ns, dims } = readTypeRef(v, child(v, 'Type') ?? child(v, 'BaseType'))
            if (!name || !type) continue
            roots.push({
                name: `${prefix(groupName)}${name}`,
                type,
                ns,
                dims,
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
        const roots = finalizeSource(types, readVars(instance, () => ''))
        sources.push({
            ...base(sources.length),
            kind: 'PLC',
            title: `${title} (PLC I/O)`,
            pathPrefix: '',
            port: readPort(project) ?? DEFAULT_PLC_PORT,
            roots,
            complete: false,
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
        const { roots, parametersWithoutSymbol } = readModuleRoots(body, types, false, `${fileName}#${sources.length}`, true)
        sources.push({
            ...base(sources.length),
            kind: 'TcCOM',
            title: instance,
            pathPrefix: instance,
            port: readPort(module) ?? DEFAULT_TCCOM_PORT,
            roots,
            complete: true,
            warnings: [TCCOM_PREFIX_HINT, ...parameterNote(parametersWithoutSymbol)],
        })
    }

    // NC axes: symbols are `Axes.<axis>.<member>` (as saved by TwinCAT Scope); the
    // Inputs/Outputs group is not part of the name.
    const ncPort = all(doc, 'SafTask').map(readPort).find((p) => p !== null) ?? DEFAULT_NC_PORT
    const axisRoots: SymbolRoot[] = []
    for (const axis of all(doc, 'Axis')) {
        if (axis.getAttribute('File')) continue
        const axisPath = `Axes.${nameOf(axis, stem)}`
        axisRoots.push(...AXIS_STATE.map((name) => ({ name: `${axisPath}.${name}`, type: 'LREAL', area: 'internal' as const, areaName: 'Axis state' })))
        axisRoots.push(...readVars(axis, () => `${axisPath}.`))
        for (const tag of ['Encoder', 'Drive', 'Controller']) {
            for (const part of children(axis, tag)) {
                axisRoots.push(...readVars(part, () => `${axisPath}.${part.getAttribute('Name') || tag}.`))
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
            roots: finalizeSource(types, axisRoots),
            complete: true,
            warnings: [
                'NC symbols exist only for axes with "Create symbols" enabled. Encoder/drive paths (Axes.<axis>.<Enc>.<variable>) are not verified yet.',
            ],
        })
    }

    sources.push(...readIoSources(doc, stem, base, sources.length))

    const warnings: string[] = []
    if (references.length > 0) {
        warnings.push(`Parts of this project are stored in separate files; import them as well: ${references.join(', ')}`)
    }
    if (sources.length === 0) {
        return [{ ...base(0), kind: 'Other', title: stem, pathPrefix: '', port: DEFAULT_PLC_PORT, roots: [], complete: true, warnings: warnings.length ? warnings : ['No PLC, TcCOM, NC or I/O symbols found in this file.'] }]
    }
    sources[0].warnings.push(...warnings)
    return sources
}
