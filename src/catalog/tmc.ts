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
import { readAccess } from './access'
import { finalizeSource, readMember, readTypeRef, readTypeTable } from './typeTable'
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
function inlineType(types: TypeTable, ownerKey: string, el: Element): string | null {
    const subItems = children(el, 'SubItem')
    if (subItems.length === 0) return null
    const name = `${ownerKey} (inline)`
    // The anonymous type declares its fields; it has no properties of its own.
    const owner = { name, props: new Map<string, string>() }
    const members = subItems.map((m) => readMember(m, owner)).filter((m): m is MemberDef => m !== null)
    types[name.toUpperCase()] = { kind: 'struct', name, members }
    return name
}

/**
 * A `<Symbol>` or `<Parameter>` element as a root; null when it has no ADS symbol
 * (`hide`, `TcNoSymbol`). A global `<FB type>.<static var>` symbol (`TcVarStatic`) is a normal root.
 */
function readRoot(el: Element, types: TypeTable, owner: string, path: string, area: AreaKind, areaName: string): SymbolRoot | null {
    const ref = readTypeRef(el, child(el, 'BaseType') ?? child(el, 'Type'))
    const type = inlineType(types, `${owner}/${path}`, el) ?? ref.type
    const access = readAccess(properties(el))
    if (!type || !access) return null
    return {
        name: path,
        type,
        ns: ref.ns,
        dims: ref.dims,
        area,
        areaName,
        comment: text(el, 'Comment') || undefined,
        ...access,
    }
}

/** `CreateSymbol="true"` attribute or a `CreateSymbol` property set to true. */
function createsSymbol(el: Element): boolean {
    const value = el.getAttribute('CreateSymbol') ?? properties(el).get('CreateSymbol')
    return value?.toLowerCase() === 'true' || value === '1'
}

export interface ModuleRoots {
    roots: SymbolRoot[]
    /** Parameters without an ADS symbol (no `CreateSymbol`), which cannot be recorded. */
    parametersWithoutSymbol: number
}

/**
 * Roots declared by a module body. PLC symbol names are already full ADS paths; TcCOM
 * symbols live below their data area's name. Data areas can switch symbol creation off.
 * Parameters only get ADS symbols with `CreateSymbol`, which is configured per *instance*:
 * an object (`.xti`) states it (`instance` = true, filter), a class (`.tmc`) cannot (list all).
 * `owner` keeps inline types of different modules apart.
 */
export function readModuleRoots(body: Element, types: TypeTable, plc: boolean, owner: string, instance: boolean): ModuleRoots {
    const roots: SymbolRoot[] = []
    let parametersWithoutSymbol = 0
    for (const p of children(child(body, 'Parameters') ?? body, 'Parameter')) {
        if (p.getAttribute('HideParameter') === 'true') continue
        if (instance && !createsSymbol(p)) {
            parametersWithoutSymbol++
            continue
        }
        const root = readRoot(p, types, owner, text(p, 'Name'), 'parameter', 'Parameters')
        if (root) roots.push(root)
    }
    for (const area of children(child(body, 'DataAreas') ?? body, 'DataArea')) {
        const areaNo = child(area, 'AreaNo')
        if (areaNo?.getAttribute('CreateSymbols')?.toLowerCase() === 'false') continue
        const areaName = text(area, 'Name') || areaNo?.getAttribute('AreaType') || 'Data'
        const kind = areaKind(areaNo?.getAttribute('AreaType') ?? '')
        for (const s of children(area, 'Symbol')) {
            const symbolName = text(s, 'Name')
            if (!symbolName) continue
            const root = readRoot(s, types, owner, plc ? symbolName : `${areaName}.${symbolName}`, kind, areaName)
            if (root) roots.push(root)
        }
    }
    return { roots: finalizeSource(types, roots), parametersWithoutSymbol }
}

export function parameterNote(count: number): string[] {
    return count > 0 ? [`${count} parameter${count === 1 ? ' has' : 's have'} no ADS symbol (CreateSymbol off) and ${count === 1 ? 'is' : 'are'} not listed.`] : []
}

export const TCCOM_PREFIX_HINT =
    'TcCOM symbols are "<object name>.<data area>.<symbol>" on the port of the task the object runs in (350, 351, …) and need "Create ADS symbols" on the data area. Check the path prefix and port in the source settings.'

function readModule(moduleEl: Element, types: TypeTable, fileName: string, index: number): SymbolSource {
    const name = text(moduleEl, 'Name') || `Module ${index + 1}`
    const plc = isPlcModule(moduleEl)
    const { roots, parametersWithoutSymbol } = readModuleRoots(moduleEl, types, plc, `${fileName}#${index}`, false)

    const port = plc ? (portFromApplicationName(properties(moduleEl).get('ApplicationName')) ?? DEFAULT_PLC_PORT) : DEFAULT_TCCOM_PORT
    const warnings: string[] = []
    if (roots.length === 0) warnings.push(`Module "${name}" declares no symbols.`)
    warnings.push(...parameterNote(parametersWithoutSymbol))
    if (!plc) {
        warnings.push(
            `This file describes the module class; set the path prefix to the object's name. ${TCCOM_PREFIX_HINT} Parameters need "CreateSymbol" on the object.`,
        )
    }

    return {
        id: `${fileName}#${index}`,
        fileName,
        kind: plc ? 'PLC' : 'TcCOM',
        title: plc ? `${name} (PLC)` : name,
        // TwinCAT names new objects "Object1 (<class>)"; the real instance name is not in the class file.
        pathPrefix: plc ? '' : `Object1 (${name})`,
        port,
        complete: true,
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
                complete: true,
                warnings: ['The file defines data types only (no <Modules>), so there are no symbols to browse.'],
            },
        ]
    }
    return modules.map((m, i) => readModule(m, types, fileName, i))
}
