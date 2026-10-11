/**
 * ADS accessibility of declarations (ADR 0005): the one place that reads what a `.tmc` says
 * about whether a symbol, member or type can be recorded by its ADS symbol name.
 *
 * The XML readers only collect facts; each row of the ADR 0005 table is decided here:
 * `symbolAccess` (a `<Symbol>`), `memberAccess` (a `<SubItem>`/`<PropertyItem>`), `typeAccess`
 * (a `<DataType>`).
 *
 * - No ADS symbol (`hide`, `TcNoSymbol` without value, VAR_INST, locals under `hide_all_locals`)
 *   → null, the declaration is dropped while reading. Only symbols and members: a *type* marked
 *   `hide` or `TcNoSymbol` still has symbols wherever it is used (`TwinCAT_SystemInfoVarList.__PlcTask`).
 * - Shown but not recordable → `disabled` with the reason; `applyAccess` turns the resolved type
 *   into `unsupported`.
 * - Recordable with a caveat → `note`, carried by the walker's path nodes.
 */
import type { Access, ResolvedType } from './model'

/** Why something is shown but cannot be recorded. */
export const REASON = {
    property: 'Property (called on access) — Scope cannot sample it',
    staticVar: (owner: string, name: string) => `Static variable — record ${owner}.${name}`,
    /** Only for a declaration that slipped past `finalizeSource`; imported sources never show it. */
    emptyArray: 'Empty array',
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

/**
 * A `<Symbol>`/`<Parameter>`/`<Var>` from its `<Properties>`; null when it has no ADS symbol.
 * `conditionalshow` (any value) disables, `TcNoSymbol 'unused…'` adds a note.
 */
export function symbolAccess(props: Map<string, string>): Access | null {
    const noSymbol = props.get('tc_no_symbol') ?? props.get('TcNoSymbol')
    const unused = noSymbol !== undefined && /^unused\b/i.test(noSymbol)
    if (props.has('hide') || props.has('implicit_inst_var') || (noSymbol !== undefined && !unused)) return null
    const access: Access = {}
    if (props.has('conditionalshow')) access.disabled = REASON.conditionalShow
    if (unused) access.note = NOTE.unusedNoSymbol
    return access
}

/** What the reader saw about a member besides its properties. */
export interface MemberFacts {
    name: string
    /** Name and properties of the declaring type. */
    owner: { name: string; props: Map<string, string> }
    /** A `<PropertyItem>`: a property with `monitoring := 'call'`. */
    property: boolean
    /** `<Name Static="true">` without `<BitOffs>`: VAR_STAT, not part of the instance. */
    staticVar: boolean
}

/**
 * A struct/FB member; null when it has no ADS symbol. Locals (members without `ItemType`) follow
 * the owner's `hide_all_locals` / `conditionalshow_all_locals`.
 */
export function memberAccess(props: Map<string, string>, facts: MemberFacts): Access | null {
    const local = !props.has('ItemType')
    const access = symbolAccess(props)
    if (!access || (local && facts.owner.props.has('hide_all_locals'))) return null
    if (facts.property) access.disabled = REASON.property
    else if (facts.staticVar) access.disabled = REASON.staticVar(facts.owner.name, facts.name)
    else if (local && facts.owner.props.has('conditionalshow_all_locals')) access.disabled ??= REASON.conditionalShow
    return access
}

/** A `<DataType>`: only `conditionalshow` acts on its instances (`hide`/`TcNoSymbol` do not). */
export function typeAccess(props: Map<string, string>): Pick<Access, 'disabled'> {
    return props.has('conditionalshow') ? { disabled: REASON.conditionalShow } : {}
}

/** A declaration that is disabled cannot be recorded, whatever its type. */
export function applyAccess(resolved: ResolvedType, access: Access): ResolvedType {
    return access.disabled ? { kind: 'unsupported', typeName: resolved.typeName, reason: access.disabled } : resolved
}
