/**
 * The offline symbol catalog: what an imported TwinCAT file contributes to the browser.
 *
 * A source holds the *declared* symbols (roots) plus the type table needed to expand
 * them into members and array elements on demand. Nothing is pre-expanded, so a PLC
 * with thousands of function block instances stays cheap to hold and to persist.
 */
import type { ScopeDataType } from '@/domain/dataTypes'

/** Bounds of one array dimension, e.g. `ARRAY[1..10]` → { lower: 1, length: 10 }. */
export interface ArrayDim {
    lower: number
    length: number
}

export interface MemberDef {
    name: string
    type: string
    /** Namespace hint for `type`, when the file gives one. */
    ns?: string
    dims?: ArrayDim[]
    comment?: string
}

export type TypeDef =
    /** Alias or enum: behaves like `base` (with optional array dims). */
    | { kind: 'alias'; name: string; base: string; ns?: string; dims?: ArrayDim[]; enumValues?: string[]; comment?: string }
    /** STRUCT or FUNCTION_BLOCK; `extends` contributes inherited members first. */
    | { kind: 'struct'; name: string; members: MemberDef[]; extends?: string; functionBlock?: boolean; interface?: boolean; comment?: string }

/** Type definitions keyed by upper-case name and by upper-case `namespace.name`. */
export type TypeTable = Record<string, TypeDef>

export type AreaKind = 'input' | 'output' | 'internal' | 'parameter'

/** A symbol as declared in the file: a global/program variable, a module parameter, an axis variable, ... */
export interface SymbolRoot {
    /** Path relative to the source's `pathPrefix`, e.g. `MAIN.fbAxis` or `Inputs.Value`. */
    name: string
    type: string
    ns?: string
    dims?: ArrayDim[]
    area: AreaKind
    /** Area / group as named in the file, e.g. `PlcTask Internal`, `Parameters`. */
    areaName: string
    comment?: string
    /** Overrides the source port for this root. */
    port?: number
}

export type SourceKind = 'PLC' | 'TcCOM' | 'NC' | 'Other'

export interface SymbolSource {
    id: string
    fileName: string
    kind: SourceKind
    /** Display name, e.g. the PLC project or module name. */
    title: string
    /** Prepended (with a dot) to every root to form the ADS symbol path; '' for PLC symbols. */
    pathPrefix: string
    port: number
    /** Target AMS Net ID when the file names one (`.tsproj`). */
    amsNetId?: string
    types: TypeTable
    roots: SymbolRoot[]
    warnings: string[]
}

/** How a type looks once aliases, enums and inheritance are resolved. */
export type ResolvedType =
    | { kind: 'scalar'; scopeType: ScopeDataType; typeName: string }
    | { kind: 'struct'; typeName: string; members: MemberDef[] }
    | { kind: 'array'; dims: ArrayDim[]; element: string; ns?: string; typeName: string }
    | { kind: 'unsupported'; typeName: string; reason: string }
