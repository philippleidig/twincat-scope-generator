/**
 * Type table built from `<DataTypes>` and resolution of type names into scalars,
 * structs (with inherited members) and arrays.
 */
import { scopeTypeForIec } from '@/domain/dataTypes'
import type { ArrayDim, MemberDef, ResolvedType, TypeDef, TypeTable } from './model'
import { child, children, properties, text } from './xml'

/** `<ArrayInfo><LBound>1</LBound><Elements>10</Elements></ArrayInfo>` (one per dimension). */
export function readArrayDims(el: Element): ArrayDim[] | undefined {
    const dims = children(el, 'ArrayInfo').map((a) => ({
        lower: Number.parseInt(text(a, 'LBound'), 10) || 0,
        length: Number.parseInt(text(a, 'Elements'), 10) || 0,
    }))
    return dims.length > 0 ? dims : undefined
}

/** Namespace attribute of a `<Type>`/`<BaseType>`/`<Name>` element, if any. */
function namespaceOf(el: Element | null): string | undefined {
    return el?.getAttribute('Namespace') || undefined
}

const isHidden = (el: Element) => properties(el).has('hide')

/**
 * Type name of a `<Type>`/`<BaseType>` element. Pointers and references are written as
 * an attribute (`<Type PointerTo="1">Notification</Type>`), so fold them into the name.
 */
export function typeNameOf(typeEl: Element | null): string {
    const name = (typeEl?.textContent ?? '').trim()
    if (!typeEl || !name) return name
    if (typeEl.hasAttribute('PointerTo')) return `POINTER TO ${name}`
    if (typeEl.hasAttribute('ReferenceTo')) return `REFERENCE TO ${name}`
    return name
}

function readMember(el: Element): MemberDef | null {
    const name = text(el, 'Name')
    const typeEl = child(el, 'Type') ?? child(el, 'BaseType')
    const type = typeNameOf(typeEl)
    if (!name || !type || isHidden(el)) return null
    return {
        name,
        type,
        ns: namespaceOf(typeEl),
        dims: readArrayDims(el),
        comment: text(el, 'Comment') || undefined,
    }
}

function readTypeDef(el: Element): TypeDef | null {
    const nameEl = child(el, 'Name')
    const name = (nameEl?.textContent ?? '').trim()
    if (!name) return null
    const comment = text(el, 'Comment') || undefined
    const subItems = children(el, 'SubItem')
    const extendsEl = child(el, 'ExtendsType')
    const baseEl = child(el, 'BaseType')

    if (subItems.length > 0 || extendsEl || !baseEl) {
        const extendsType = (extendsEl?.textContent ?? '').trim() || undefined
        return {
            kind: 'struct',
            name,
            members: subItems.map(readMember).filter((m): m is MemberDef => m !== null),
            extends: extendsType,
            functionBlock: properties(el).get('PouType') === 'FunctionBlock',
            // Interfaces derive from PVOID and carry methods only.
            interface: extendsType?.toUpperCase() === 'PVOID' && subItems.length === 0,
            comment,
        }
    }

    const enumValues = children(el, 'EnumInfo').map((e) => text(e, 'Text'))
    return {
        kind: 'alias',
        name,
        base: typeNameOf(baseEl),
        ns: namespaceOf(baseEl),
        dims: readArrayDims(el),
        enumValues: enumValues.length > 0 ? enumValues : undefined,
        comment,
    }
}

/** Collect every `<DataTypes>/<DataType>` in the document. */
export function readTypeTable(doc: Document): TypeTable {
    const table: TypeTable = {}
    for (const block of doc.getElementsByTagName('DataTypes')) {
        for (const el of children(block, 'DataType')) {
            const def = readTypeDef(el)
            if (!def) continue
            const key = def.name.toUpperCase()
            const ns = namespaceOf(child(el, 'Name'))
            if (ns) table[`${ns.toUpperCase()}.${key}`] = def
            // First definition wins for the bare name; namespaced lookups disambiguate the rest.
            table[key] ??= def
        }
    }
    return table
}

function lookup(table: TypeTable, name: string, ns?: string): TypeDef | undefined {
    const key = name.toUpperCase()
    return (ns ? table[`${ns.toUpperCase()}.${key}`] : undefined) ?? table[key]
}

const ARRAY_DECL = /^ARRAY\s*\[(.+?)\]\s*OF\s+(.+)$/i
const UNSUPPORTED_PREFIX: Array<[RegExp, string]> = [
    [/^W?STRING\b/i, 'Strings cannot be recorded by TwinCAT Scope'],
    [/^(POINTER|REFERENCE)\s+TO\b/i, 'Pointers and references cannot be recorded'],
    [/^(PVOID|XWORD|UXINT|XINT|__XWORD|__UXINT|__XINT)$/i, 'Platform-dependent size'],
]

/** Parse `1..10, 0..3` from a textual array declaration. */
function parseDimsText(spec: string): ArrayDim[] | null {
    const dims: ArrayDim[] = []
    for (const part of spec.split(',')) {
        const m = /^\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*$/.exec(part)
        if (!m) return null
        dims.push({ lower: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 })
    }
    return dims
}

const MAX_DEPTH = 32

/** TwinCAT system types that files reference without defining them. */
const BUILTIN_ALIASES: Record<string, string> = {
    OTCID: 'UDINT',
    HRESULT: 'DINT',
    PTCID: 'UDINT',
    PLCTONC_AXIS_REF_CTRL: 'DWORD',
}

/**
 * Resolve a type name (plus array dims declared on the symbol itself) into what the
 * browser needs to show and expand it.
 */
export function resolveType(table: TypeTable, typeName: string, ns?: string, dims?: ArrayDim[]): ResolvedType {
    if (dims && dims.length > 0) return { kind: 'array', dims, element: typeName, ns, typeName }
    return resolveNamed(table, typeName.trim(), ns, 0)
}

function resolveNamed(table: TypeTable, typeName: string, ns: string | undefined, depth: number): ResolvedType {
    if (depth > MAX_DEPTH) return { kind: 'unsupported', typeName, reason: 'Type definition is recursive' }

    const scalar = scopeTypeForIec(typeName)
    if (scalar) return { kind: 'scalar', scopeType: scalar, typeName }

    const arrayDecl = ARRAY_DECL.exec(typeName)
    if (arrayDecl) {
        const parsed = parseDimsText(arrayDecl[1])
        if (parsed) return { kind: 'array', dims: parsed, element: arrayDecl[2].trim(), typeName }
    }
    for (const [pattern, reason] of UNSUPPORTED_PREFIX) {
        if (pattern.test(typeName)) return { kind: 'unsupported', typeName, reason }
    }

    const def = lookup(table, typeName, ns)
    const builtin = BUILTIN_ALIASES[typeName.toUpperCase()]
    if (!def && builtin) return { ...resolveNamed(table, builtin, undefined, depth + 1), typeName }
    if (!def) return { kind: 'unsupported', typeName, reason: 'Type is not defined in the imported file' }

    if (def.kind === 'alias') {
        if (def.dims) return { kind: 'array', dims: def.dims, element: def.base, ns: def.ns, typeName }
        const base = resolveNamed(table, def.base, def.ns, depth + 1)
        // Keep the alias/enum name visible; it is what users know the symbol by.
        return base.kind === 'scalar' ? { ...base, typeName } : base
    }
    if (def.interface) return { kind: 'unsupported', typeName, reason: 'Interface references cannot be recorded' }
    return { kind: 'struct', typeName, members: structMembers(table, def, depth) }
}

function structMembers(table: TypeTable, def: Extract<TypeDef, { kind: 'struct' }>, depth: number): MemberDef[] {
    if (!def.extends || depth > MAX_DEPTH) return def.members
    const base = lookup(table, def.extends)
    if (!base || base.kind !== 'struct') return def.members
    return [...structMembers(table, base, depth + 1), ...def.members]
}
