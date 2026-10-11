/**
 * Type table built from `<DataTypes>` and resolution of type names into scalars, structs
 * (with inherited members), arrays and pointers.
 *
 * This is also where the ADS accessibility rules are decided (ADR 0005): what has no ADS
 * symbol is dropped or resolves to `hidden`, what cannot be sampled resolves to `unsupported`
 * with a reason. The walker applies the result, so tree, search and "Add" agree.
 */
import { scopeTypeForIec } from '@/domain/dataTypes'
import type { Access, ArrayDim, MemberDef, ResolvedType, SymbolRoot, TypeDef, TypeTable } from './model'
import { child, children, properties, text } from './xml'

/** Why something is shown but cannot be recorded. */
export const REASON = {
    property: 'Property (called on access) — Scope cannot sample it',
    staticVar: (owner: string, name: string) => `Static variable — record ${owner}.${name}`,
    conditionalShow: 'Hidden in compiled libraries',
    pointer: 'Pointer — expand ^ to record the target',
    pointerToHidden: 'Pointer to a type without ADS symbols',
    string: 'Strings can only be shown in table charts',
    interface: 'Interface references cannot be recorded',
    platform: 'Platform-dependent size',
    recursive: 'Type definition is recursive',
    undefined: 'Type is not defined in the imported file',
} as const

/** Caveats shown next to something that stays recordable. */
export const NOTE = {
    unusedNoSymbol: "TcNoSymbol 'unused': there is no ADS symbol if the code does not use it",
    viaReference: 'Valid only while the reference is bound',
} as const

/** `<ArrayInfo><LBound>1</LBound><Elements>10</Elements></ArrayInfo>` (one per dimension). */
export function readArrayDims(el: Element): ArrayDim[] | undefined {
    const dims = children(el, 'ArrayInfo').map((a) => {
        const lower = Number.parseInt(text(a, 'LBound'), 10) || 0
        return { lower, upper: lower + (Number.parseInt(text(a, 'Elements'), 10) || 0) - 1 }
    })
    return dims.length > 0 ? dims : undefined
}

export function arrayLabel(dims: ArrayDim[], element: string): string {
    return `ARRAY[${dims.map((d) => `${d.lower}..${d.upper}`).join(',')}] OF ${element}`
}

/** Namespace attribute of a `<Type>`/`<BaseType>`/`<Name>` element, if any. */
function namespaceOf(el: Element | null): string | undefined {
    return el?.getAttribute('Namespace') || undefined
}

/** `PointerTo="2"` → `POINTER TO POINTER TO `, `ReferenceTo="true"` → `REFERENCE TO `. */
function indirection(el: Element): string {
    const pointers = Number.parseInt(el.getAttribute('PointerTo') ?? '', 10)
    if (pointers > 0) return 'POINTER TO '.repeat(pointers)
    return el.getAttribute('ReferenceTo') === 'true' ? 'REFERENCE TO ' : ''
}

/**
 * Type name of a `<Type>`/`<BaseType>` element. Pointers and references are written as
 * an attribute (`<Type PointerTo="1">Notification</Type>`), so fold them into the name.
 */
export function typeNameOf(typeEl: Element | null): string {
    const name = (typeEl?.textContent ?? '').trim()
    return typeEl && name ? `${indirection(typeEl)}${name}` : name
}

export interface TypeRef {
    type: string
    ns?: string
    dims?: ArrayDim[]
}

/**
 * The type of a symbol, member or alias: its `<Type>`/`<BaseType>` plus `<ArrayInfo>` dims.
 * A pointer or reference *to an array* is marked on the first `<ArrayInfo>`
 * (`<ArrayInfo PointerTo="1">`), so it is folded into the name as
 * `POINTER TO ARRAY[0..65535] OF T` instead of becoming array dims.
 */
export function readTypeRef(el: Element, typeEl: Element | null): TypeRef {
    const type = typeNameOf(typeEl)
    const ns = namespaceOf(typeEl)
    const dims = readArrayDims(el)
    const prefix = dims ? indirection(children(el, 'ArrayInfo')[0]) : ''
    return prefix && type ? { type: `${prefix}${arrayLabel(dims!, type)}`, ns } : { type, ns, dims }
}

/** Access flags from an element's `<Properties>`. `hidden` means there is no ADS symbol. */
export function readAccess(props: Map<string, string>): Access & { hidden?: boolean } {
    const noSymbol = props.get('tc_no_symbol') ?? props.get('TcNoSymbol')
    const unused = noSymbol !== undefined && /^unused\b/i.test(noSymbol)
    if (props.has('hide') || props.has('implicit_inst_var') || (noSymbol !== undefined && !unused)) return { hidden: true }
    const access: Access = {}
    if (props.has('conditionalshow')) access.disabled = REASON.conditionalShow
    if (unused) access.note = NOTE.unusedNoSymbol
    return access
}

/** The declaring type of a member, for `*_all_locals` and static variables. */
interface Owner {
    name: string
    props: Map<string, string>
}

/**
 * A `<SubItem>` (struct/FB member or inline parameter field) or `<PropertyItem>` (property with
 * `monitoring := 'call'`). Members without an ADS symbol (`hide`, `TcNoSymbol`, VAR_INST,
 * locals under `hide_all_locals`) are skipped; VAR_IN_OUT becomes a reference.
 */
export function readMember(el: Element, owner?: Owner): MemberDef | null {
    const nameEl = child(el, 'Name')
    const name = (nameEl?.textContent ?? '').trim()
    const { ns, dims, ...ref } = readTypeRef(el, child(el, 'Type') ?? child(el, 'BaseType'))
    let type = ref.type
    if (!name || !type) return null
    const props = properties(el)
    const local = !props.has('ItemType')
    const { hidden, ...access } = readAccess(props)
    if (hidden || (local && owner?.props.has('hide_all_locals'))) return null

    if (props.get('ItemType') === 'InOut' && !/^REFERENCE\s+TO\b/i.test(type)) type = `REFERENCE TO ${type}`
    if (el.tagName === 'PropertyItem') access.disabled = REASON.property
    // VAR_STAT has no place in the instance (no BitOffs); its symbol is `<FB type>.<name>`.
    else if (nameEl?.getAttribute('Static') === 'true' && !child(el, 'BitOffs')) access.disabled = REASON.staticVar(owner?.name ?? 'FB', name)
    else if (local && owner?.props.has('conditionalshow_all_locals')) access.disabled ??= REASON.conditionalShow

    const member: MemberDef = { name, type, ...access }
    if (ns) member.ns = ns
    if (dims) member.dims = dims
    const comment = text(el, 'Comment')
    if (comment) member.comment = comment
    return member
}

function readTypeDef(el: Element): TypeDef | null {
    const nameEl = child(el, 'Name')
    const name = (nameEl?.textContent ?? '').trim()
    if (!name) return null
    const props = properties(el)
    const flags = { comment: text(el, 'Comment') || undefined, ...readAccess(props) }
    const items = Array.from(el.children).filter((c) => c.tagName === 'SubItem' || c.tagName === 'PropertyItem')
    const extendsEl = child(el, 'ExtendsType')
    const baseEl = child(el, 'BaseType')

    if (items.length > 0 || extendsEl || !baseEl) {
        const extendsType = (extendsEl?.textContent ?? '').trim() || undefined
        const owner = { name, props }
        return {
            kind: 'struct',
            name,
            members: items.map((m) => readMember(m, owner)).filter((m): m is MemberDef => m !== null),
            extends: extendsType,
            functionBlock: props.get('PouType') === 'FunctionBlock',
            // Interfaces derive from PVOID and carry methods (and properties) only.
            interface: extendsType?.toUpperCase() === 'PVOID' && children(el, 'SubItem').length === 0,
            ...flags,
        }
    }

    const enumValues = children(el, 'EnumInfo').map((e) => text(e, 'Text'))
    const { type, ns, dims } = readTypeRef(el, baseEl)
    return { kind: 'alias', name, base: type, ns, dims, enumValues: enumValues.length > 0 ? enumValues : undefined, ...flags }
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

const POINTER_DECL = /^POINTER\s+TO\s+(.+)$/i
const REFERENCE_DECL = /^REFERENCE\s+TO\s+(.+)$/i
const ARRAY_DECL = /^ARRAY\s*\[(.+?)\]\s*OF\s+(.+)$/i
const UNSUPPORTED_PREFIX: Array<[RegExp, string]> = [
    [/^W?STRING\b/i, REASON.string],
    [/^(PVOID|XWORD|UXINT|XINT|__XWORD|__UXINT|__XINT)$/i, REASON.platform],
]

/** Parse `1..10, 0..3` from a textual array declaration. */
function parseDimsText(spec: string): ArrayDim[] | null {
    const dims: ArrayDim[] = []
    for (const part of spec.split(',')) {
        const m = /^\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*$/.exec(part)
        if (!m) return null
        dims.push({ lower: Number(m[1]), upper: Number(m[2]) })
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
    if (dims && dims.length > 0) return arrayOf(table, dims, typeName, ns, typeName, 0)
    return resolveNamed(table, typeName.trim(), ns, 0)
}

/**
 * Roots that have an ADS symbol (their type is not `hide`/`TcNoSymbol`, no empty array), once per
 * name: a file can declare the same name twice (two versions of a library GVL); ADS names are
 * unique and case-insensitive, so the first declaration wins everywhere.
 */
export function visibleRoots(table: TypeTable, roots: SymbolRoot[]): SymbolRoot[] {
    const seen = new Set<string>()
    return roots.filter((r) => {
        const key = r.name.toLowerCase()
        if (seen.has(key) || resolveType(table, r.type, r.ns, r.dims).kind === 'hidden') return false
        seen.add(key)
        return true
    })
}

/** Empty arrays and arrays of hidden types have no symbol. */
function arrayOf(table: TypeTable, dims: ArrayDim[], element: string, ns: string | undefined, typeName: string, depth: number): ResolvedType {
    if (dims.some((d) => d.upper < d.lower)) return { kind: 'hidden', typeName, reason: 'Empty array' }
    const el = resolveNamed(table, element, ns, depth + 1)
    if (el.kind === 'hidden') return el
    return { kind: 'array', dims, element, ns, typeName }
}

function resolveNamed(table: TypeTable, typeName: string, ns: string | undefined, depth: number): ResolvedType {
    if (depth > MAX_DEPTH) return { kind: 'unsupported', typeName, reason: REASON.recursive }

    const scalar = scopeTypeForIec(typeName)
    if (scalar) return { kind: 'scalar', scopeType: scalar, typeName }

    const pointer = POINTER_DECL.exec(typeName)
    if (pointer) {
        const target = pointer[1].trim()
        if (resolveNamed(table, target, ns, depth + 1).kind === 'hidden') return { kind: 'unsupported', typeName, reason: REASON.pointerToHidden }
        return { kind: 'pointer', typeName, target, ns, reason: REASON.pointer }
    }
    const reference = REFERENCE_DECL.exec(typeName)
    if (reference) {
        const target = resolveNamed(table, reference[1].trim(), ns, depth + 1)
        return target.kind === 'hidden' ? target : { ...target, viaReference: true }
    }
    const arrayDecl = ARRAY_DECL.exec(typeName)
    if (arrayDecl) {
        const parsed = parseDimsText(arrayDecl[1])
        if (parsed) return arrayOf(table, parsed, arrayDecl[2].trim(), ns, typeName, depth)
    }
    for (const [pattern, reason] of UNSUPPORTED_PREFIX) {
        if (pattern.test(typeName)) return { kind: 'unsupported', typeName, reason }
    }

    const def = lookup(table, typeName, ns)
    const builtin = BUILTIN_ALIASES[typeName.toUpperCase()]
    if (!def && builtin) return { ...resolveNamed(table, builtin, undefined, depth + 1), typeName }
    if (!def) return { kind: 'unsupported', typeName, reason: REASON.undefined }
    if (def.hidden) return { kind: 'hidden', typeName, reason: `${def.name} has no ADS symbols` }
    if (def.disabled) return { kind: 'unsupported', typeName, reason: def.disabled }

    const resolved = resolveDef(table, def, typeName, depth)
    return def.note && resolved.kind !== 'hidden' ? { ...resolved, note: def.note } : resolved
}

function resolveDef(table: TypeTable, def: TypeDef, typeName: string, depth: number): ResolvedType {
    if (def.kind === 'alias') {
        if (def.dims) return arrayOf(table, def.dims, def.base, def.ns, typeName, depth)
        const base = resolveNamed(table, def.base, def.ns, depth + 1)
        // Keep the alias/enum name visible; it is what users know the symbol by.
        return base.kind === 'scalar' ? { ...base, typeName } : base
    }
    if (def.interface) return { kind: 'unsupported', typeName, reason: REASON.interface }
    return { kind: 'struct', typeName, members: structMembers(table, def, depth) }
}

function structMembers(table: TypeTable, def: Extract<TypeDef, { kind: 'struct' }>, depth: number): MemberDef[] {
    if (!def.extends || depth > MAX_DEPTH) return def.members
    const base = lookup(table, def.extends)
    if (!base || base.kind !== 'struct') return def.members
    return [...structMembers(table, base, depth + 1), ...def.members]
}
