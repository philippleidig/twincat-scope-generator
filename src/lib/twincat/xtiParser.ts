import type { ParseResult, ParsedSymbol, ParsedSymbolGroup, ParsedTcomObject, SymbolGroupKind } from './types'
import {
    buildAliasMap,
    child,
    children,
    nextId,
    parseXmlOrThrow,
    readCreateSymbol,
    toBmpDataUrl,
    txt,
} from './shared'
import { makeSymbol } from './tmcParser'

/**
 * Parses a TwinCAT eXported Tree Item file (.xti).
 *
 * XTI is structurally distinct from TMC. The root is <TcSmItem> and the
 * concrete shape depends on the `ClassName` attribute, which encodes what
 * was exported (a TcCOM instance, an NC axis, an EtherCAT box, a PLC
 * project, ...). Examples seen in the wild:
 *
 *   <TcSmItem TcSmVersion="1.0" ClassName="CTcCOMObject" SubType="0">
 *      ...embedded module / parameter overrides...
 *   </TcSmItem>
 *
 *   <TcSmItem TcSmVersion="1.0" ClassName="CNcAxisDef" SubType="1">
 *     <DataTypes>...</DataTypes>
 *     <Axis Id="3" CreateSymbols="true" AxisType="1">
 *       <Encoder Name="Enc">
 *         <Vars VarGrpType="1"><Name>Inputs</Name><Var>...</Var></Vars>
 *         <Vars VarGrpType="2"><Name>Outputs</Name><Var>...</Var></Vars>
 *       </Encoder>
 *       <Drive Name="Drive">...</Drive>
 *       <Controller Name="Ctrl">...</Controller>
 *       <Vars VarGrpType="1"><Name>Inputs</Name><Var>...</Var></Vars>
 *       <Vars VarGrpType="2"><Name>Outputs</Name><Var>...</Var></Vars>
 *     </Axis>
 *   </TcSmItem>
 *
 * We dispatch on ClassName and on the structural elements actually present.
 * Unknown ClassNames fall back to a structural scan that handles the common
 * "embedded TcCOM module" and "NC axis with Vars" shapes.
 */
export function parseXti(fileName: string, content: string): ParseResult {
    const doc = parseXmlOrThrow(content)
    const root = doc.documentElement

    if (root.tagName !== 'TcSmItem') {
        throw new Error(`Not an XTI file: expected <TcSmItem> root, got <${root.tagName}>`)
    }

    const className = root.getAttribute('ClassName') || ''
    const aliasMap = buildAliasMap(doc)
    const objects: ParsedTcomObject[] = []
    const warnings: string[] = []

    // Display name: stem of the file (without .xti) is what the user sees
    // when they pick the file. The actual instance name typically isn't
    // stored in the XTI itself (it's the file's own name on disk).
    const instanceName = fileNameStem(fileName) || className || 'Instance'

    // 1) NC axis form (ClassName CNcAxisDef or presence of <Axis>)
    const axisEl = root.getElementsByTagName('Axis')[0]
    if (axisEl && axisEl.parentElement === root) {
        objects.push(parseNcAxis(axisEl, aliasMap, instanceName))
    }

    // 2) TcCOM-instance form: a <TreeItem> wrapping a Module, or a
    //    direct <Module> child, or parameter/data overrides at root.
    if (objects.length === 0) {
        const treeItemTops = topLevelTreeItems(doc)
        for (const ti of treeItemTops) {
            const obj = parseTreeItem(ti, aliasMap, '', instanceName)
            if (obj) objects.push(obj)
        }
    }

    if (objects.length === 0) {
        // 3) Last-ditch: scan for any embedded <Module>, <Parameters>, or
        //    <DataAreas> blocks anywhere in the document.
        const fallback = parseFlatStructure(root, aliasMap, instanceName)
        if (fallback) objects.push(fallback)
    }

    if (objects.length === 0) {
        warnings.push(
            `No scopable symbols found. ClassName="${className}" is not a TcCOM/NC-Axis instance, ` +
            'or the file is a tree-only export without parameter/data sections.',
        )
    }

    return { fileName, fileType: 'XTI', objects, warnings }
}

/** Strip the `.xti` (or any single trailing extension) from a filename. */
function fileNameStem(fileName: string): string {
    const base = fileName.split(/[/\\]/).pop() || fileName
    const dot = base.lastIndexOf('.')
    return dot > 0 ? base.slice(0, dot) : base
}

/** Find <TreeItem> elements whose parent is not also a <TreeItem>. */
function topLevelTreeItems(doc: Document): Element[] {
    const all = doc.getElementsByTagName('TreeItem')
    const out: Element[] = []
    for (let i = 0; i < all.length; i++) {
        const t = all[i]
        if (t.parentElement && t.parentElement.tagName === 'TreeItem') continue
        out.push(t)
    }
    return out
}

/**
 * Parse a TreeItem (one node in the TwinCAT solution explorer hierarchy).
 * Returns null if the TreeItem has nothing scopable (and no scopable
 * descendants).
 */
function parseTreeItem(
    treeEl: Element,
    aliasMap: Map<string, string>,
    parentPathPrefix: string,
    fallbackName: string,
): ParsedTcomObject | null {
    const treeName = txt(child(treeEl, 'Name')) || treeEl.getAttribute('Name') || fallbackName
    const moduleEl = locateEmbeddedModule(treeEl)
    const objectId = nextId('obj')
    const iconDataUrl = toBmpDataUrl(txt(child(treeEl, 'ImageData')))
    const groups: ParsedSymbolGroup[] = []
    const childObjects: ParsedTcomObject[] = []

    const pathPrefix = parentPathPrefix ? `${parentPathPrefix}.${treeName}` : treeName

    if (moduleEl) {
        groups.push(...parseEmbeddedParameters(moduleEl, aliasMap, objectId, treeName, pathPrefix))
        groups.push(...parseEmbeddedDataAreas(moduleEl, aliasMap, objectId, treeName, pathPrefix))
    }

    for (const childTree of children(treeEl, 'TreeItem')) {
        const c = parseTreeItem(childTree, aliasMap, pathPrefix, 'Child')
        if (c) childObjects.push(c)
    }

    if (groups.length === 0 && childObjects.length === 0) return null

    return {
        id: objectId,
        name: treeName,
        className: moduleEl ? readModuleClassName(moduleEl) : null,
        iconDataUrl,
        groups,
        children: childObjects,
    }
}

function readModuleClassName(moduleEl: Element): string | null {
    const clsid = child(moduleEl, 'CLSID')
    if (clsid) {
        const factory = clsid.getAttribute('ClassFactory')
        if (factory) return factory
    }
    return txt(child(moduleEl, 'Name')) || null
}

/**
 * Look for the Module-shaped element inside a TreeItem. TwinCAT wraps
 * TcCOM modules in different elements depending on the export path.
 */
function locateEmbeddedModule(treeEl: Element): Element | null {
    const wrappers = ['Module', 'TcCOMObject', 'TcModuleInstance', 'ImplementsTcCOMObject']
    for (const w of wrappers) {
        const direct = child(treeEl, w)
        if (direct) {
            // <Module> directly, or <Wrapper><Module>...</Module></Wrapper>
            if (w === 'Module') return direct
            const inner = child(direct, 'Module')
            if (inner) return inner
            // Some wrappers (TcCOMObject) carry parameters/data inline.
            if (child(direct, 'Parameters') || child(direct, 'DataAreas')) return direct
        }
    }
    return null
}

/** Parse <Parameters> embedded inside a TreeItem's module. Same shape as TMC. */
function parseEmbeddedParameters(
    moduleEl: Element,
    aliasMap: Map<string, string>,
    ownerObjectId: string,
    ownerObjectName: string,
    pathPrefix: string,
): ParsedSymbolGroup[] {
    const paramsEl = child(moduleEl, 'Parameters')
    if (!paramsEl) return []

    const groupId = nextId('grp')
    const groupKind: SymbolGroupKind = 'Parameter'
    const groupName = 'Parameters'
    const symbols: ParsedSymbol[] = []

    for (const paramEl of children(paramsEl, 'Parameter')) {
        if (paramEl.getAttribute('HideParameter')?.toLowerCase() === 'true') continue
        const paramName = txt(child(paramEl, 'Name'))
        if (!paramName) continue

        const propsEl = child(paramEl, 'Properties')
        const createSymbol = readCreateSymbol(propsEl, true)
        const comment = txt(child(paramEl, 'Comment')) || undefined
        const subItems = children(paramEl, 'SubItem')

        if (subItems.length > 0) {
            for (const sub of subItems) {
                const subName = txt(child(sub, 'Name'))
                const rawType = txt(child(sub, 'Type')) || txt(child(sub, 'BaseType'))
                if (!subName) continue
                symbols.push(makeSymbol({
                    name: subName, rawType, aliasMap, createSymbol, comment,
                    ownerObjectId, ownerObjectName, groupId, groupName, groupKind,
                    pathComponents: [pathPrefix, paramName, subName],
                }))
            }
        } else {
            const rawType = txt(child(paramEl, 'BaseType')) || txt(child(paramEl, 'Type'))
            symbols.push(makeSymbol({
                name: paramName, rawType, aliasMap, createSymbol, comment,
                ownerObjectId, ownerObjectName, groupId, groupName, groupKind,
                pathComponents: [pathPrefix, paramName],
            }))
        }
    }

    if (symbols.length === 0) return []
    return [{ id: groupId, name: groupName, kind: groupKind, iconDataUrl: null, symbols }]
}

/** Parse <DataAreas> embedded inside a TreeItem's module. Same shape as TMC. */
function parseEmbeddedDataAreas(
    moduleEl: Element,
    aliasMap: Map<string, string>,
    ownerObjectId: string,
    ownerObjectName: string,
    pathPrefix: string,
): ParsedSymbolGroup[] {
    const dataAreasEl = child(moduleEl, 'DataAreas')
    if (!dataAreasEl) return []

    const groups: ParsedSymbolGroup[] = []
    for (const daEl of children(dataAreasEl, 'DataArea')) {
        const areaType = child(daEl, 'AreaNo')?.getAttribute('AreaType') ?? ''
        const groupKind = classifyAreaType(areaType)
        const groupName = txt(child(daEl, 'Name')) || areaType || 'DataArea'
        const groupId = nextId('grp')
        const iconDataUrl = toBmpDataUrl(txt(child(daEl, 'ImageData')))
        const symbols: ParsedSymbol[] = []

        for (const symEl of children(daEl, 'Symbol')) {
            const name = txt(child(symEl, 'Name'))
            if (!name) continue
            const propsEl = child(symEl, 'Properties')
            const createSymbol = readCreateSymbol(propsEl, true)
            const comment = txt(child(symEl, 'Comment')) || undefined
            const subItems = children(symEl, 'SubItem')

            if (subItems.length > 0) {
                for (const sub of subItems) {
                    const subName = txt(child(sub, 'Name'))
                    const rawType = txt(child(sub, 'Type')) || txt(child(sub, 'BaseType'))
                    if (!subName) continue
                    symbols.push(makeSymbol({
                        name: subName, rawType, aliasMap, createSymbol, comment,
                        ownerObjectId, ownerObjectName, groupId, groupName, groupKind,
                        pathComponents: [pathPrefix, name, subName],
                    }))
                }
            } else {
                const rawType = txt(child(symEl, 'BaseType')) || txt(child(symEl, 'Type'))
                symbols.push(makeSymbol({
                    name, rawType, aliasMap, createSymbol, comment,
                    ownerObjectId, ownerObjectName, groupId, groupName, groupKind,
                    pathComponents: [pathPrefix, name],
                }))
            }
        }

        if (symbols.length === 0) continue
        groups.push({ id: groupId, name: groupName, kind: groupKind, iconDataUrl, symbols })
    }
    return groups
}

function classifyAreaType(areaType: string): SymbolGroupKind {
    const a = areaType.toLowerCase()
    if (a === 'inputdst' || a === 'input' || a === 'inputs') return 'InputArea'
    if (a === 'outputsrc' || a === 'output' || a === 'outputs') return 'OutputArea'
    return 'DataArea'
}

/**
 * Parse a CNcAxisDef-style XTI (<Axis> at root with Encoder/Drive/Controller
 * sub-objects). Variables come from <Vars VarGrpType="1|2"> with <Var>
 * children. VarGrpType=1 -> Inputs, VarGrpType=2 -> Outputs.
 */
function parseNcAxis(
    axisEl: Element,
    aliasMap: Map<string, string>,
    instanceName: string,
): ParsedTcomObject {
    const objectId = nextId('obj')
    const groups: ParsedSymbolGroup[] = []

    // Collect <Vars> at the Axis level and inside Encoder/Drive/Controller subgroups.
    collectVarsInto(axisEl, aliasMap, objectId, instanceName, [instanceName], groups)
    for (const subTag of ['Encoder', 'Drive', 'Controller']) {
        const sub = child(axisEl, subTag)
        if (!sub) continue
        const subName = sub.getAttribute('Name') || subTag
        collectVarsInto(sub, aliasMap, objectId, instanceName, [instanceName, subName], groups)
    }

    return {
        id: objectId,
        name: instanceName,
        className: 'CNcAxisDef',
        iconDataUrl: null,
        groups,
        children: [],
    }
}

function collectVarsInto(
    parent: Element,
    aliasMap: Map<string, string>,
    ownerObjectId: string,
    ownerObjectName: string,
    pathComponents: string[],
    groups: ParsedSymbolGroup[],
): void {
    for (const varsEl of children(parent, 'Vars')) {
        const grpType = varsEl.getAttribute('VarGrpType') || ''
        const groupKind: SymbolGroupKind =
            grpType === '1' ? 'InputArea' : grpType === '2' ? 'OutputArea' : 'InstanceVar'
        const groupName = txt(child(varsEl, 'Name')) || (grpType === '1' ? 'Inputs' : grpType === '2' ? 'Outputs' : 'Vars')
        const groupId = nextId('grp')
        const symbols: ParsedSymbol[] = []

        for (const v of children(varsEl, 'Var')) {
            const name = txt(child(v, 'Name'))
            if (!name) continue
            const rawType = txt(child(v, 'BaseType')) || txt(child(v, 'Type'))
            const propsEl = child(v, 'Properties')
            const createSymbol = readCreateSymbol(propsEl, true)
            symbols.push(makeSymbol({
                name, rawType, aliasMap, createSymbol,
                ownerObjectId, ownerObjectName, groupId, groupName, groupKind,
                pathComponents: [...pathComponents, name],
            }))
        }

        if (symbols.length > 0) {
            groups.push({
                id: groupId, name: groupName, kind: groupKind, iconDataUrl: null, symbols,
            })
        }
    }
}

/**
 * Last-resort: walk the entire XTI and pull anything that looks like a
 * Module/Parameters/DataAreas structure. Used when ClassName is unfamiliar.
 */
function parseFlatStructure(
    root: Element,
    aliasMap: Map<string, string>,
    instanceName: string,
): ParsedTcomObject | null {
    const objectId = nextId('obj')
    const groups: ParsedSymbolGroup[] = []

    // Find any <Parameters> / <DataAreas> blocks with content.
    const paramsBlocks = root.getElementsByTagName('Parameters')
    if (paramsBlocks.length > 0) {
        // Treat the first block as if attached to a synthetic Module.
        const synthetic = paramsBlocks[0].parentElement
        if (synthetic) {
            groups.push(...parseEmbeddedParameters(synthetic, aliasMap, objectId, instanceName, instanceName))
        }
    }
    const dataBlocks = root.getElementsByTagName('DataAreas')
    if (dataBlocks.length > 0) {
        const synthetic = dataBlocks[0].parentElement
        if (synthetic) {
            groups.push(...parseEmbeddedDataAreas(synthetic, aliasMap, objectId, instanceName, instanceName))
        }
    }

    if (groups.length === 0) return null

    return {
        id: objectId,
        name: instanceName,
        className: root.getAttribute('ClassName'),
        iconDataUrl: toBmpDataUrl(txt(child(root, 'ImageData'))),
        groups,
        children: [],
    }
}

// Re-export internal helper for tests.
export { classifyAreaType as __classifyAreaType }
