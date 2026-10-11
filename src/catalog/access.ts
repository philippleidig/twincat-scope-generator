/**
 * ADS accessibility of declarations (ADR 0005): the one place that reads what a `.tmc` says
 * about whether a symbol, member or type can be recorded by its ADS symbol name.
 *
 * - No ADS symbol (`hide`, `TcNoSymbol` without value, VAR_INST) → `readAccess` returns null and
 *   the declaration is dropped while reading. Only symbols and members: a *type* marked `hide`
 *   or `TcNoSymbol` still has symbols wherever it is used (`TwinCAT_SystemInfoVarList.__PlcTask`).
 * - Shown but not recordable → `disabled` with the reason; `applyAccess` turns the resolved type
 *   into `unsupported`.
 * - Recordable with a caveat → `note`, carried by the walker's path nodes.
 */
import type { Access, ResolvedType } from './model'

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

/**
 * Access from a declaration's `<Properties>`; null when the declaration has no ADS symbol.
 * `conditionalshow` (any value) disables, `TcNoSymbol 'unused…'` adds a note.
 */
export function readAccess(props: Map<string, string>): Access | null {
    const noSymbol = props.get('tc_no_symbol') ?? props.get('TcNoSymbol')
    const unused = noSymbol !== undefined && /^unused\b/i.test(noSymbol)
    if (props.has('hide') || props.has('implicit_inst_var') || (noSymbol !== undefined && !unused)) return null
    const access: Access = {}
    if (props.has('conditionalshow')) access.disabled = REASON.conditionalShow
    if (unused) access.note = NOTE.unusedNoSymbol
    return access
}

/** A declaration that is disabled cannot be recorded, whatever its type. */
export function applyAccess(resolved: ResolvedType, access: Access): ResolvedType {
    return access.disabled ? { kind: 'unsupported', typeName: resolved.typeName, reason: access.disabled } : resolved
}
