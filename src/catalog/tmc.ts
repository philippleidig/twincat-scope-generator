/**
 * TwinCAT Module Class files (`.tmc`).
 *
 * Two flavours share the format:
 *
 * - **PLC TMC** (`GeneratedBy="TwinCAT XAE Plc"`, module `ClassFactory="TcPlc30"`): every
 *   symbol in `<DataAreas>` already carries its full ADS name (`MAIN.fbAxis`,
 *   `GVL.nCount`), the ADS port is in the module property `ApplicationName`
 *   (`Port_851`) and `<DataTypes>` describes every struct, FB, enum and alias used.
 * - **TcCOM TMC** (C++/Simulink modules): describes a module *class*. Symbols are
 *   `<Parameters>` and `<DataAreas>` of that class; the ADS path of an instance is
 *   `<instance name>.<…>`, which the file does not know, so it starts as the class
 *   name and can be changed per source in the browser.
 */
import type { AreaKind, MemberDef, SymbolRoot, SymbolSource, TypeTable } from './model'
import { readArrayDims, readTypeTable, typeNameOf } from './typeTable'
import { child, children, properties, text } from './xml'

export const DEFAULT_PLC_PORT = 851
export const DEFAULT_TCCOM_PORT = 350

export function areaKind(areaType: string): AreaKind {
    switch (areaType.toLowerCase()) {
        case 'inputdst':
        case 'input':
            return 'input'
        case 'outputsrc':
        case 'output':
            return 'output'
        default:
            return 'internal'
    }
}

/** `Port_851` → 851. */
function portFromApplicationName(value: string | undefined): number | null {
    const m = /(\d+)\s*$/.exec(value ?? '')
    return m ? Number(m[1]) : null
}

function isPlcModule(moduleEl: Element): boolean {
    return (
        child(moduleEl, 'CLSID')?.getAttribute('ClassFactory') === 'TcPlc30' ||
        moduleEl.getAttribute('TcSmClass') === 'TComPlcObjDef'
    )
}

/**
 * A symbol or parameter declared with inline `<SubItem>`s instead of a named type:
 * register an anonymous struct type for it so it expands like any other struct.
 */
function inlineType(types: TypeTable, owner: string, el: Element): string | null {
    const subItems = children(el, 'SubItem')
    if (subItems.length === 0) return null
    const name = `${owner} (inline)`
    const members: MemberDef[] = subItems.flatMap((s) => {
        const type = text(s, 'Type') || text(s, 'BaseType')
        const memberName = text(s, 'Name')
        return memberName && type ? [{ name: memberName, type, dims: readArrayDims(s) }] : []
    })
    types[name.toUpperCase()] = { kind: 'struct', name, members }
    return name
}

/** A `<Symbol>` or `<Parameter>` element as a root. */
function readRoot(el: Element, types: TypeTable, path: string, area: AreaKind, areaName: string): SymbolRoot | null {
    const typeEl = child(el, 'BaseType') ?? child(el, 'Type')
    const type = inlineType(types, path, el) ?? typeNameOf(typeEl)
    if (!type || properties(el).has('hide')) return null
    return {
        name: path,
        type,
        ns: typeEl?.getAttribute('Namespace') || undefined,
        dims: readArrayDims(el),
        area,
        areaName,
        comment: text(el, 'Comment') || undefined,
    }
}

/**
 * Roots declared by a module body: `<Parameters>` and `<DataAreas>`. PLC symbol names
 * are already full ADS paths; TcCOM symbols live below their data area's name.
 */
export function readModuleRoots(body: Element, types: TypeTable, plc: boolean): SymbolRoot[] {
    const roots: SymbolRoot[] = []
    for (const p of children(child(body, 'Parameters') ?? body, 'Parameter')) {
        if (p.getAttribute('HideParameter') === 'true') continue
        const root = readRoot(p, types, text(p, 'Name'), 'parameter', 'Parameters')
        if (root) roots.push(root)
    }
    for (const area of children(child(body, 'DataAreas') ?? body, 'DataArea')) {
        const areaNo = child(area, 'AreaNo')
        const areaName = text(area, 'Name') || areaNo?.getAttribute('AreaType') || 'Data'
        const kind = areaKind(areaNo?.getAttribute('AreaType') ?? '')
        for (const s of children(area, 'Symbol')) {
            const symbolName = text(s, 'Name')
            if (!symbolName) continue
            const root = readRoot(s, types, plc ? symbolName : `${areaName}.${symbolName}`, kind, areaName)
            if (root) roots.push(root)
        }
    }
    return roots
}

export const TCCOM_PREFIX_HINT =
    'TcCOM paths are built as "<instance>.<data area>.<symbol>". Check the path prefix (instance name) and the port (task port) in the source settings.'

function readModule(moduleEl: Element, types: TypeTable, fileName: string, index: number): SymbolSource {
    const name = text(moduleEl, 'Name') || `Module ${index + 1}`
    const plc = isPlcModule(moduleEl)
    const roots = readModuleRoots(moduleEl, types, plc)

    const port = plc ? (portFromApplicationName(properties(moduleEl).get('ApplicationName')) ?? DEFAULT_PLC_PORT) : DEFAULT_TCCOM_PORT
    const warnings: string[] = []
    if (roots.length === 0) warnings.push(`Module "${name}" declares no symbols.`)
    if (!plc) {
        warnings.push(`This file describes the module class; set the path prefix to the instance name. ${TCCOM_PREFIX_HINT}`)
    }

    return {
        id: `${fileName}#${index}`,
        fileName,
        kind: plc ? 'PLC' : 'TcCOM',
        title: plc ? `${name} (PLC)` : name,
        pathPrefix: plc ? '' : name,
        port,
        types,
        roots,
        warnings,
    }
}

export function importTmc(fileName: string, doc: Document): SymbolSource[] {
    const root = doc.documentElement
    const types = readTypeTable(doc)
    const modules = children(child(root, 'Modules') ?? root, 'Module')
    if (modules.length === 0) {
        return [
            {
                id: `${fileName}#0`,
                fileName,
                kind: 'Other',
                title: fileName,
                pathPrefix: '',
                port: DEFAULT_PLC_PORT,
                types,
                roots: [],
                warnings: ['The file defines data types only (no <Modules>), so there are no symbols to browse.'],
            },
        ]
    }
    return modules.map((m, i) => readModule(m, types, fileName, i))
}
