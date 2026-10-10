/**
 * Scope data types — the value types a TwinCAT Scope `AdsAcquisition` can record —
 * and their mapping from IEC 61131-3 / TwinCAT type names.
 *
 * This module is the single source of truth for both; importers, the drag & drop
 * handler and the XML exporter all go through it.
 */

export const SCOPE_DATA_TYPES = [
    'BIT',
    'INT8',
    'INT16',
    'INT32',
    'INT64',
    'UINT8',
    'UINT16',
    'UINT32',
    'UINT64',
    'REAL32',
    'REAL64',
] as const

export type ScopeDataType = (typeof SCOPE_DATA_TYPES)[number]

/** Size in bytes, as written to `<VariableSize>`. */
export const SCOPE_DATA_TYPE_SIZE: Record<ScopeDataType, number> = {
    BIT: 1,
    INT8: 1,
    INT16: 2,
    INT32: 4,
    INT64: 8,
    UINT8: 1,
    UINT16: 2,
    UINT32: 4,
    UINT64: 8,
    REAL32: 4,
    REAL64: 8,
}

/** The IEC name users know each scope type by, for labels. */
export const SCOPE_DATA_TYPE_IEC: Record<ScopeDataType, string> = {
    BIT: 'BOOL',
    INT8: 'SINT',
    INT16: 'INT',
    INT32: 'DINT',
    INT64: 'LINT',
    UINT8: 'USINT',
    UINT16: 'UINT',
    UINT32: 'UDINT',
    UINT64: 'ULINT',
    REAL32: 'REAL',
    REAL64: 'LREAL',
}

/** IEC / TwinCAT elementary type name → scope data type. */
const IEC_TO_SCOPE: Record<string, ScopeDataType> = {
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
    TIME: 'UINT32',
    TOD: 'UINT32',
    TIME_OF_DAY: 'UINT32',
    DATE: 'UINT32',
    DT: 'UINT32',
    DATE_AND_TIME: 'UINT32',
    LTIME: 'UINT64',
    // Bit-sized IO types as they appear in EtherCAT process images.
    BIT2: 'UINT8',
    BIT3: 'UINT8',
    BIT4: 'UINT8',
    BIT5: 'UINT8',
    BIT6: 'UINT8',
    BIT7: 'UINT8',
    BIT8: 'UINT8',
}

/**
 * Scope data type for an elementary IEC type name, or null if the name is not an
 * elementary scalar (structs, strings, pointers, ...). Case-insensitive.
 */
export function scopeTypeForIec(typeName: string): ScopeDataType | null {
    return IEC_TO_SCOPE[typeName.trim().toUpperCase()] ?? null
}

export function isScopeDataType(value: unknown): value is ScopeDataType {
    return typeof value === 'string' && (SCOPE_DATA_TYPES as readonly string[]).includes(value)
}
