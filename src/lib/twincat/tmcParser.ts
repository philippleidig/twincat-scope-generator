import type { ParseResult, ParsedSymbol, ParsedSymbolGroup, ParsedTcomObject, SymbolGroupKind } from './types'
import {
    DEFAULT_SUGGESTED_PORT,
    buildAliasMap,
    child,
    children,
    mapDataType,
    nextId,
    parseXmlOrThrow,
    readCreateSymbol,
    toBmpDataUrl,
    txt,
} from './shared'

/**
 * Parses a TwinCAT Module Class file (.tmc).
 *
 * Real TMC structure (verified against Beckhoff and community TcCOM samples):
 *
 *   <TcModuleClass xsi:noNamespaceSchemaLocation=".../TcModuleClass">
 *     <Vendor>...</Vendor>
 *     <DataTypes>
 *       <DataType><Name>...</Name><BaseType>...</BaseType></DataType>...
 *     </DataTypes>
 *     <Modules>
 *       <Module GUID="..." Group="...">
 *         <Name>CMyModule</Name>
 *         <CLSID ClassFactory="...">{guid}</CLSID>
 *         <ImageData>... (base64 BMP, optional) ...</ImageData>
 *         <Contexts><Context><Id>1</Id></Context></Contexts>
 *         <Parameters>
 *           <Parameter>
 *             <Name>Parameter</Name>
 *             <BaseType>UDINT</BaseType>            <!-- scalar -->
 *             OR
 *             <SubItem><Name>data1</Name><Type>UDINT</Type></SubItem>...   <!-- struct -->
 *             <PTCID>#x00000001</PTCID>
 *             <ContextId>1</ContextId>
 *             <Properties><Property><Name>CreateSymbol</Name><Value>true</Value></Property></Properties>
 *           </Parameter>...
 *         </Parameters>
 *         <DataAreas>
 *           <DataArea>
 *             <AreaNo AreaType="InputDst|OutputSrc|MArea|...">N</AreaNo>
 *             <Name>Inputs</Name>
 *             <ContextId>1</ContextId>
 *             <Symbol>
 *               <Name>Value</Name><BaseType>UDINT</BaseType>
 *               <Properties>...optional CreateSymbol...</Properties>
 *             </Symbol>...
 *           </DataArea>...
 *         </DataAreas>
 *       </Module>
 *     </Modules>
 *   </TcModuleClass>
 *
 * In TMC, each <Parameter> is exposed via ADS at runtime as both a startup
 * (Init) value and a current (Online) value — these aren't separate XML
 * sections. We expose them all under a single "Parameters" group; the user
 * can scope either by using the same symbol path.
 */
export function parseTmc(fileName: string, content: string): ParseResult {
    const doc = parseXmlOrThrow(content)
    const root = doc.documentElement

    if (root.tagName !== 'TcModuleClass') {
        throw new Error(`Not a TMC file: expected <TcModuleClass> root, got <${root.tagName}>`)
    }

    const aliasMap = buildAliasMap(doc)
    const objects: ParsedTcomObject[] = []
    const warnings: string[] = []

    const modulesEl = child(root, 'Modules')
    if (modulesEl) {
        for (const moduleEl of children(modulesEl, 'Module')) {
            objects.push(parseModule(moduleEl, aliasMap))
        }
    }

    if (objects.length === 0) {
        warnings.push(
            'No <Modules> with TcCOM definitions found. PLC-generated TMC files (only <DataTypes>) ' +
            'do not contain scopable symbols — open the corresponding XTI/PLC project instead.',
        )
    }

    return { fileName, fileType: 'TMC', objects, warnings }
}

/** Parse a single TMC <Module> element. */
function parseModule(moduleEl: Element, aliasMap: Map<string, string>): ParsedTcomObject {
    const objectId = nextId('obj')
    const name = txt(child(moduleEl, 'Name')) || moduleEl.getAttribute('Name') || 'Module'
    const className = readClassFactory(moduleEl) || name
    const iconDataUrl = toBmpDataUrl(txt(child(moduleEl, 'ImageData')))

    const groups: ParsedSymbolGroup[] = []
    groups.push(...parseParameters(moduleEl, aliasMap, objectId, name))
    groups.push(...parseDataAreas(moduleEl, aliasMap, objectId, name))

    return { id: objectId, name, className, iconDataUrl, groups, children: [] }
}

/** Read CLSID/@ClassFactory or fall back to <Name>. */
function readClassFactory(moduleEl: Element): string | null {
    const clsid = child(moduleEl, 'CLSID')
    return clsid?.getAttribute('ClassFactory') ?? null
}

/**
 * Parse <Parameters>/<Parameter> entries. Handles both:
 *   - scalar parameters: <BaseType>UDINT</BaseType>
 *   - struct parameters: one or more <SubItem> children (expanded into
 *     individual scope-able fields with paths like "Parameter.data1")
 *
 * Returns an empty array if no <Parameters> block is present.
 */
function parseParameters(
    moduleEl: Element,
    aliasMap: Map<string, string>,
    ownerObjectId: string,
    ownerObjectName: string,
): ParsedSymbolGroup[] {
    const paramsEl = child(moduleEl, 'Parameters')
    if (!paramsEl) return []

    const paramEls = children(paramsEl, 'Parameter')
    if (paramEls.length === 0) return []

    const groupId = nextId('grp')
    const symbols: ParsedSymbol[] = []
    const groupKind: SymbolGroupKind = 'Parameter'
    const groupName = 'Parameters'

    for (const paramEl of paramEls) {
        // Skip parameters explicitly marked HideParameter="true" — they aren't user-facing.
        if (paramEl.getAttribute('HideParameter')?.toLowerCase() === 'true') continue

        const paramName = txt(child(paramEl, 'Name'))
        if (!paramName) continue

        const propsEl = child(paramEl, 'Properties')
        const createSymbol = readCreateSymbol(propsEl, true)
        const comment = txt(child(paramEl, 'Comment')) || undefined
        const subItems = children(paramEl, 'SubItem')

        if (subItems.length > 0) {
            // Struct parameter: expose each scalar SubItem as a separate scopable symbol.
            for (const sub of subItems) {
                const subName = txt(child(sub, 'Name'))
                const rawType = txt(child(sub, 'Type')) || txt(child(sub, 'BaseType'))
                if (!subName) continue

                symbols.push(makeSymbol({
                    name: subName,
                    rawType,
                    aliasMap,
                    createSymbol,
                    comment,
                    ownerObjectId,
                    ownerObjectName,
                    groupId,
                    groupName,
                    groupKind,
                    pathComponents: [ownerObjectName, paramName, subName],
                }))
            }
        } else {
            const rawType = txt(child(paramEl, 'BaseType')) || txt(child(paramEl, 'Type'))
            symbols.push(makeSymbol({
                name: paramName,
                rawType,
                aliasMap,
                createSymbol,
                comment,
                ownerObjectId,
                ownerObjectName,
                groupId,
                groupName,
                groupKind,
                pathComponents: [ownerObjectName, paramName],
            }))
        }
    }

    if (symbols.length === 0) return []

    return [{
        id: groupId,
        name: groupName,
        kind: groupKind,
        iconDataUrl: null,
        symbols,
    }]
}

/**
 * Parse <DataAreas>/<DataArea>/<Symbol> entries. The DataArea direction
 * (input vs output vs internal) comes from <AreaNo AreaType="...">:
 *   - InputDst   -> InputArea   (kept by default in scope; default port = task)
 *   - OutputSrc  -> OutputArea
 *   - MArea / Internal / unset -> DataArea
 */
function parseDataAreas(
    moduleEl: Element,
    aliasMap: Map<string, string>,
    ownerObjectId: string,
    ownerObjectName: string,
): ParsedSymbolGroup[] {
    const dataAreasEl = child(moduleEl, 'DataAreas')
    if (!dataAreasEl) return []

    const groups: ParsedSymbolGroup[] = []
    for (const daEl of children(dataAreasEl, 'DataArea')) {
        const areaNoEl = child(daEl, 'AreaNo')
        const areaType = areaNoEl?.getAttribute('AreaType') ?? ''
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
                        name: subName,
                        rawType,
                        aliasMap,
                        createSymbol,
                        comment,
                        ownerObjectId,
                        ownerObjectName,
                        groupId,
                        groupName,
                        groupKind,
                        pathComponents: [ownerObjectName, name, subName],
                    }))
                }
            } else {
                const rawType = txt(child(symEl, 'BaseType')) || txt(child(symEl, 'Type'))
                symbols.push(makeSymbol({
                    name,
                    rawType,
                    aliasMap,
                    createSymbol,
                    comment,
                    ownerObjectId,
                    ownerObjectName,
                    groupId,
                    groupName,
                    groupKind,
                    pathComponents: [ownerObjectName, name],
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

interface MakeSymbolArgs {
    name: string
    rawType: string
    aliasMap: Map<string, string>
    createSymbol: boolean
    comment?: string
    ownerObjectId: string
    ownerObjectName: string
    groupId: string
    groupName: string
    groupKind: SymbolGroupKind
    pathComponents: string[]
}

export function makeSymbol(args: MakeSymbolArgs): ParsedSymbol {
    const dataType = args.rawType ? mapDataType(args.rawType, args.aliasMap) : null
    return {
        id: nextId('sym'),
        name: args.name,
        rawType: args.rawType || '',
        dataType,
        createSymbol: args.createSymbol,
        comment: args.comment,
        ownerObjectId: args.ownerObjectId,
        ownerObjectName: args.ownerObjectName,
        groupId: args.groupId,
        groupName: args.groupName,
        groupKind: args.groupKind,
        fullPath: args.pathComponents.filter(Boolean).join('.'),
        suggestedPort: DEFAULT_SUGGESTED_PORT,
    }
}
