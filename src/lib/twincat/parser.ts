import type { DataType } from '@/types'

/**
 * Maps Beckhoff/IEC base type names to internal DataType names.
 * Returns null for types that cannot be scoped (structs, enums, arrays, etc).
 */
const BECKHOFF_TYPE_MAP: Record<string, DataType> = {
    BOOL: 'BIT',
    BIT: 'BIT',
    SINT: 'INT8',
    INT: 'INT16',
    DINT: 'INT32',
    LINT: 'INT64',
    BYTE: 'UINT8',
    USINT: 'UINT8',
    WORD: 'UINT16',
    UINT: 'UINT16',
    DWORD: 'UINT32',
    UDINT: 'UINT32',
    LWORD: 'UINT64',
    ULINT: 'UINT64',
    REAL: 'REAL32',
    LREAL: 'REAL64',
}

export type SymbolGroupKind = 'DataArea' | 'ParameterInit' | 'ParameterOnline' | 'Other'

export interface ParsedSymbol {
    id: string
    name: string
    rawType: string
    dataType: DataType | null
    createSymbol: boolean
    comment?: string
    ownerObjectId: string
    ownerObjectName: string
    groupId: string
    groupName: string
    groupKind: SymbolGroupKind
    /** Full ADS-style symbol path constructed from object/group/symbol names. */
    fullPath: string
    /** Suggested ADS port (851 default for PLC; TcCOM typically 351-360). */
    suggestedPort: number
}

export interface ParsedSymbolGroup {
    id: string
    name: string
    kind: SymbolGroupKind
    iconDataUrl: string | null
    symbols: ParsedSymbol[]
}

export interface ParsedTcomObject {
    id: string
    name: string
    className: string | null
    iconDataUrl: string | null
    groups: ParsedSymbolGroup[]
    children: ParsedTcomObject[]
}

export interface ParseResult {
    fileName: string
    fileType: 'XTI' | 'TMC' | 'Unknown'
    objects: ParsedTcomObject[]
    /** Raw error/warning messages encountered during parsing. */
    warnings: string[]
}

/** Strip whitespace, treat empty as undefined. */
function txt(el: Element | null | undefined): string {
    if (!el) return ''
    return (el.textContent ?? '').trim()
}

/** Safe child lookup: first child element with given tag name (case-insensitive, direct child only). */
function child(parent: Element, tagName: string): Element | null {
    const tag = tagName.toLowerCase()
    for (let i = 0; i < parent.children.length; i++) {
        const el = parent.children[i]
        if (el.tagName.toLowerCase() === tag) return el
    }
    return null
}

/** All direct children matching tag name (case-insensitive). */
function children(parent: Element, tagName: string): Element[] {
    const tag = tagName.toLowerCase()
    const out: Element[] = []
    for (let i = 0; i < parent.children.length; i++) {
        const el = parent.children[i]
        if (el.tagName.toLowerCase() === tag) out.push(el)
    }
    return out
}

/** Convert base64 BMP image data to a usable data URL. */
function toBmpDataUrl(base64: string): string | null {
    const trimmed = base64.replace(/\s+/g, '')
    if (!trimmed) return null
    return `data:image/bmp;base64,${trimmed}`
}

/** Read CreateSymbol property from a Properties block. Defaults to true if not specified. */
function readCreateSymbol(propsEl: Element | null, defaultValue: boolean = true): boolean {
    if (!propsEl) return defaultValue
    const propEls = children(propsEl, 'Property')
    for (const p of propEls) {
        const nameEl = child(p, 'Name')
        if (nameEl && txt(nameEl).toLowerCase() === 'createsymbol') {
            const valueEl = child(p, 'Value')
            const v = txt(valueEl).toLowerCase()
            return v === 'true' || v === '1'
        }
    }
    return defaultValue
}

/** Resolve a chain of type aliases via the TMC <DataTypes> map. */
function resolveBaseType(typeName: string, aliasMap: Map<string, string>): string {
    let current = typeName.toUpperCase()
    let depth = 0
    while (aliasMap.has(current) && depth < 10) {
        current = aliasMap.get(current)!.toUpperCase()
        depth++
    }
    return current
}

/** Build a map of TypeName -> BaseType from <DataTypes> sections in the document. */
function buildAliasMap(doc: Document): Map<string, string> {
    const map = new Map<string, string>()
    const dtRoots = Array.from(doc.getElementsByTagName('DataTypes'))
    for (const root of dtRoots) {
        for (const dt of children(root, 'DataType')) {
            const name = txt(child(dt, 'Name'))
            const base = txt(child(dt, 'BaseType'))
            if (name && base) {
                map.set(name.toUpperCase(), base)
            }
        }
    }
    return map
}

/** Map a raw type name to internal DataType, resolving aliases. */
function mapDataType(rawType: string, aliasMap: Map<string, string>): DataType | null {
    if (!rawType) return null
    const resolved = resolveBaseType(rawType, aliasMap)
    return BECKHOFF_TYPE_MAP[resolved] ?? null
}

let __idCounter = 0
function nextId(prefix: string): string {
    __idCounter += 1
    return `${prefix}-${__idCounter}`
}

/** Determine group kind from a name (e.g. ParameterInit, ParameterOnline, Inputs). */
function classifyGroupKind(name: string): SymbolGroupKind {
    const n = name.toLowerCase().replace(/\s+/g, '')
    if (n === 'parameterinit' || n === 'parameter(init)' || n === 'parameters(init)') return 'ParameterInit'
    if (n === 'parameteronline' || n === 'parameter(online)' || n === 'parameters(online)') return 'ParameterOnline'
    return 'DataArea'
}

/** Locate the Module name. Tries explicit child <Name>, then attribute, then fallback. */
function readModuleName(moduleEl: Element, fallback: string): string {
    const nameEl = child(moduleEl, 'Name')
    const directName = txt(nameEl)
    if (directName) return directName
    const attr = moduleEl.getAttribute('Name')
    if (attr) return attr.trim()
    return fallback
}

/**
 * Parse a single Symbol element into a ParsedSymbol.
 * Returns null if the symbol has no usable name.
 */
function parseSymbol(
    symbolEl: Element,
    aliasMap: Map<string, string>,
    ownerObjectId: string,
    ownerObjectName: string,
    groupId: string,
    groupName: string,
    groupKind: SymbolGroupKind,
    suggestedPort: number,
    pathPrefix: string,
): ParsedSymbol | null {
    const name = txt(child(symbolEl, 'Name'))
    if (!name) return null

    let rawType = txt(child(symbolEl, 'BaseType'))
    if (!rawType) rawType = txt(child(symbolEl, 'Type'))

    const propsEl = child(symbolEl, 'Properties')
    const createSymbol = readCreateSymbol(propsEl, true)
    const comment = txt(child(symbolEl, 'Comment')) || undefined

    const dataType = mapDataType(rawType, aliasMap)

    const fullPath = pathPrefix ? `${pathPrefix}.${name}` : name

    return {
        id: nextId('sym'),
        name,
        rawType: rawType || '',
        dataType,
        createSymbol,
        comment,
        ownerObjectId,
        ownerObjectName,
        groupId,
        groupName,
        groupKind,
        fullPath,
        suggestedPort,
    }
}

/** Parse a DataArea block into a ParsedSymbolGroup. */
function parseDataArea(
    daEl: Element,
    aliasMap: Map<string, string>,
    ownerObjectId: string,
    ownerObjectName: string,
    suggestedPort: number,
    pathPrefix: string,
): ParsedSymbolGroup {
    const groupName = txt(child(daEl, 'Name')) || 'DataArea'
    const groupKind = classifyGroupKind(groupName)
    const groupId = nextId('grp')
    const iconDataUrl = toBmpDataUrl(txt(child(daEl, 'ImageData')))

    const symbols: ParsedSymbol[] = []
    for (const symEl of children(daEl, 'Symbol')) {
        const parsed = parseSymbol(
            symEl,
            aliasMap,
            ownerObjectId,
            ownerObjectName,
            groupId,
            groupName,
            groupKind,
            suggestedPort,
            pathPrefix,
        )
        if (parsed) symbols.push(parsed)
    }

    return { id: groupId, name: groupName, kind: groupKind, iconDataUrl, symbols }
}

/**
 * Parse top-level <Symbols> block (parameter symbols categorized by Category Name).
 * Returns one or more groups, one per category found.
 */
function parseTopLevelSymbols(
    moduleEl: Element,
    aliasMap: Map<string, string>,
    ownerObjectId: string,
    ownerObjectName: string,
    suggestedPort: number,
    pathPrefix: string,
): ParsedSymbolGroup[] {
    const symbolsEl = child(moduleEl, 'Symbols')
    if (!symbolsEl) return []

    const symEls = children(symbolsEl, 'Symbol')
    if (symEls.length === 0) return []

    // Bucket symbols by their <Category> child text (or 'Other' if none).
    const buckets = new Map<string, ParsedSymbol[]>()
    const groupIdByName = new Map<string, string>()

    for (const symEl of symEls) {
        const categoryName = txt(child(symEl, 'Category')) || 'Other'
        if (!groupIdByName.has(categoryName)) {
            groupIdByName.set(categoryName, nextId('grp'))
        }
        const groupId = groupIdByName.get(categoryName)!
        const groupKind = classifyGroupKind(categoryName)
        const parsed = parseSymbol(
            symEl,
            aliasMap,
            ownerObjectId,
            ownerObjectName,
            groupId,
            categoryName,
            groupKind,
            suggestedPort,
            pathPrefix,
        )
        if (!parsed) continue
        if (!buckets.has(categoryName)) buckets.set(categoryName, [])
        buckets.get(categoryName)!.push(parsed)
    }

    const groups: ParsedSymbolGroup[] = []
    for (const [name, syms] of buckets.entries()) {
        // Try to match an icon from the matching <Category Name="..."> element.
        const categoriesEl = child(moduleEl, 'Categories')
        let icon: string | null = null
        if (categoriesEl) {
            for (const c of children(categoriesEl, 'Category')) {
                const cName = txt(child(c, 'Name')) || c.getAttribute('Name') || ''
                if (cName === name) {
                    icon = toBmpDataUrl(txt(child(c, 'ImageData')))
                    break
                }
            }
        }
        groups.push({
            id: groupIdByName.get(name)!,
            name,
            kind: classifyGroupKind(name),
            iconDataUrl: icon,
            symbols: syms,
        })
    }

    return groups
}

/** Parse a single Module/TcCOM-Object element into a ParsedTcomObject. */
function parseModule(
    moduleEl: Element,
    aliasMap: Map<string, string>,
    fallbackName: string,
    suggestedPort: number,
    parentPathPrefix: string,
): ParsedTcomObject {
    const objectId = nextId('obj')
    const name = readModuleName(moduleEl, fallbackName)
    const className = txt(child(moduleEl, 'ClassName')) || null
    const iconDataUrl = toBmpDataUrl(txt(child(moduleEl, 'ImageData')))

    const pathPrefix = parentPathPrefix ? `${parentPathPrefix}.${name}` : name

    const groups: ParsedSymbolGroup[] = []

    // DataAreas
    const dataAreasEl = child(moduleEl, 'DataAreas')
    if (dataAreasEl) {
        for (const daEl of children(dataAreasEl, 'DataArea')) {
            groups.push(parseDataArea(daEl, aliasMap, objectId, name, suggestedPort, pathPrefix))
        }
    }

    // Top-level <Symbols> (typically Parameter Init / Parameter Online)
    groups.push(...parseTopLevelSymbols(moduleEl, aliasMap, objectId, name, suggestedPort, pathPrefix))

    return {
        id: objectId,
        name,
        className,
        iconDataUrl,
        groups,
        children: [],
    }
}

/**
 * Recursively walk TreeItem nodes (XTI hierarchy) collecting TcCOM modules.
 * Each TreeItem with an embedded Module becomes a ParsedTcomObject; nested
 * TreeItems become children. TreeItems without a Module are skipped at this
 * level but their children are still descended.
 */
function parseTreeItem(
    treeEl: Element,
    aliasMap: Map<string, string>,
    suggestedPort: number,
    parentPathPrefix: string,
): ParsedTcomObject[] {
    const treeName = txt(child(treeEl, 'Name')) || treeEl.getAttribute('Name') || 'TreeItem'

    // Find a Module within this TreeItem (TcCOM modules can be wrapped in
    // <ImplementsTcCOMObject>, <TcModuleInstance>, or directly).
    let moduleEl: Element | null = null
    const wrapperNames = ['ImplementsTcCOMObject', 'TcModuleInstance', 'TcCOMObject']
    for (const wn of wrapperNames) {
        const w = child(treeEl, wn)
        if (w) {
            moduleEl = child(w, 'Module') ?? moduleEl
        }
    }
    if (!moduleEl) moduleEl = child(treeEl, 'Module')

    const collected: ParsedTcomObject[] = []
    let currentPrefix = parentPathPrefix

    if (moduleEl) {
        const obj = parseModule(moduleEl, aliasMap, treeName, suggestedPort, parentPathPrefix)
        // Use the TreeItem name as the instance name (overrides Module name).
        obj.name = treeName
        // Update path prefix using the TreeItem name.
        const prefix = parentPathPrefix ? `${parentPathPrefix}.${treeName}` : treeName
        // Re-fix paths inside the parsed object (since parseModule used the module's own name).
        for (const g of obj.groups) {
            for (const s of g.symbols) {
                s.fullPath = `${prefix}.${s.name}`
                s.ownerObjectName = treeName
            }
        }
        currentPrefix = prefix

        // Descend into children
        for (const c of children(treeEl, 'TreeItem')) {
            obj.children.push(...parseTreeItem(c, aliasMap, suggestedPort, currentPrefix))
        }
        collected.push(obj)
    } else {
        // Pass-through container: descend
        const newPrefix = parentPathPrefix ? `${parentPathPrefix}.${treeName}` : ''
        for (const c of children(treeEl, 'TreeItem')) {
            collected.push(...parseTreeItem(c, aliasMap, suggestedPort, newPrefix))
        }
    }

    return collected
}

/**
 * Parse the textual contents of an XTI or TMC file.
 * Throws on unparseable XML; returns an empty objects list with a warning if
 * the document parses but contains no recognized TcCOM modules.
 */
export function parseTwinCatFile(fileName: string, content: string): ParseResult {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/xml')

    const parserError = doc.getElementsByTagName('parsererror')[0]
    if (parserError) {
        throw new Error(`XML parse error: ${parserError.textContent?.trim() ?? 'unknown'}`)
    }

    const root = doc.documentElement
    if (!root) {
        throw new Error('Empty XML document')
    }

    const lowerName = fileName.toLowerCase()
    let fileType: ParseResult['fileType'] = 'Unknown'
    if (lowerName.endsWith('.tmc') || root.tagName === 'TcModuleClass') fileType = 'TMC'
    else if (lowerName.endsWith('.xti') || root.tagName === 'TcSmItem') fileType = 'XTI'

    const aliasMap = buildAliasMap(doc)
    const warnings: string[] = []
    const objects: ParsedTcomObject[] = []

    // Default suggested port: PLC default. The user can change it per pattern.
    const suggestedPort = 851

    if (fileType === 'TMC' || root.tagName === 'TcModuleClass') {
        const modulesEl = root.getElementsByTagName('Modules')[0]
        if (modulesEl) {
            for (const moduleEl of children(modulesEl, 'Module')) {
                const fallback = readModuleName(moduleEl, 'Module')
                objects.push(parseModule(moduleEl, aliasMap, fallback, suggestedPort, ''))
            }
        }
    } else {
        // XTI / unknown: walk all top-level TreeItems anywhere in the doc.
        const treeItems = doc.getElementsByTagName('TreeItem')
        // Collect only top-most TreeItems (whose parent is not also a TreeItem).
        const topTreeItems: Element[] = []
        for (let i = 0; i < treeItems.length; i++) {
            const t = treeItems[i]
            if (t.parentElement && t.parentElement.tagName === 'TreeItem') continue
            topTreeItems.push(t)
        }
        for (const t of topTreeItems) {
            objects.push(...parseTreeItem(t, aliasMap, suggestedPort, ''))
        }

        // Fallback: if no TreeItems, still try Module elements.
        if (objects.length === 0) {
            const allModules = doc.getElementsByTagName('Module')
            for (let i = 0; i < allModules.length; i++) {
                const m = allModules[i]
                const fallback = readModuleName(m, `Module${i + 1}`)
                objects.push(parseModule(m, aliasMap, fallback, suggestedPort, ''))
            }
        }
    }

    if (objects.length === 0) {
        warnings.push('No TcCOM modules or symbols found in this file.')
    }

    return { fileName, fileType, objects, warnings }
}

/** Flatten the TcCOM object tree into a list (preserving children-after-parent order). */
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

/** Iterate all symbols in a parse result, regardless of nesting. */
export function* iterAllSymbols(objects: ParsedTcomObject[]): Generator<ParsedSymbol> {
    for (const obj of flattenObjects(objects)) {
        for (const grp of obj.groups) {
            for (const sym of grp.symbols) yield sym
        }
    }
}

// Reset id counter (mostly for tests).
export function __resetIdCounterForTests(): void {
    __idCounter = 0
}

export const __TYPE_MAP_FOR_TESTS = BECKHOFF_TYPE_MAP
