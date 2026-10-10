import { describe, expect, it } from 'vitest'
import { SCOPE_DATA_TYPES, SCOPE_DATA_TYPE_SIZE, isScopeDataType, scopeTypeForIec } from './dataTypes'

describe('scopeTypeForIec', () => {
    it.each([
        ['BOOL', 'BIT'],
        ['bool', 'BIT'],
        ['BYTE', 'UINT8'],
        ['WORD', 'UINT16'],
        ['DWORD', 'UINT32'],
        ['LWORD', 'UINT64'],
        ['SINT', 'INT8'],
        ['INT', 'INT16'],
        ['DINT', 'INT32'],
        ['LINT', 'INT64'],
        ['REAL', 'REAL32'],
        ['LREAL', 'REAL64'],
        ['TIME', 'UINT32'],
        ['LTIME', 'UINT64'],
    ])('%s → %s', (iec, scope) => expect(scopeTypeForIec(iec)).toBe(scope))

    it('returns null for non-elementary types', () => {
        expect(scopeTypeForIec('STRING(80)')).toBeNull()
        expect(scopeTypeForIec('ST_Axis')).toBeNull()
    })
})

it('has a size for every scope type', () => {
    for (const t of SCOPE_DATA_TYPES) expect(SCOPE_DATA_TYPE_SIZE[t]).toBeGreaterThan(0)
    expect(isScopeDataType('REAL64')).toBe(true)
    expect(isScopeDataType('LREAL')).toBe(false)
})
