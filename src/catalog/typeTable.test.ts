import { describe, expect, it } from 'vitest'
import { parseXml } from './xml'
import { readTypeTable, resolveType } from './typeTable'

const doc = (types: string) => parseXml(`<TcModuleClass><DataTypes>${types}</DataTypes></TcModuleClass>`)

const TYPES = doc(`
  <DataType><Name>T_Alias</Name><BaseType>T_Alias2</BaseType></DataType>
  <DataType><Name>T_Alias2</Name><BaseType>UDINT</BaseType></DataType>
  <DataType><Name>E_Mode</Name><BaseType>INT</BaseType><EnumInfo><Text>A</Text><Enum>0</Enum></EnumInfo></DataType>
  <DataType><Name>T_Arr</Name><BaseType>LREAL</BaseType><ArrayInfo><LBound>0</LBound><Elements>3</Elements></ArrayInfo></DataType>
  <DataType><Name>FB_Base</Name><SubItem><Name>bBusy</Name><Type>BOOL</Type></SubItem></DataType>
  <DataType><Name>FB_Child</Name><ExtendsType>FB_Base</ExtendsType>
     <SubItem><Name>fVal</Name><Type>REAL</Type></SubItem>
     <SubItem><Name>_hidden</Name><Type>INT</Type><Properties><Property><Name>hide</Name></Property></Properties></SubItem>
     <SubItem><Name>pNext</Name><Type PointerTo="1">FB_Child</Type></SubItem>
  </DataType>
  <DataType><Name>I_Thing</Name><ExtendsType>PVOID</ExtendsType></DataType>
  <DataType><Name Namespace="LibA">ST_Dup</Name><SubItem><Name>a</Name><Type>INT</Type></SubItem></DataType>
  <DataType><Name Namespace="LibB">ST_Dup</Name><SubItem><Name>b</Name><Type>INT</Type></SubItem></DataType>
  <DataType><Name>T_Loop</Name><BaseType>T_Loop</BaseType></DataType>
`)
const table = readTypeTable(TYPES)

describe('resolveType', () => {
    it('resolves elementary types', () => {
        expect(resolveType(table, 'LREAL')).toEqual({ kind: 'scalar', scopeType: 'REAL64', typeName: 'LREAL' })
    })
    it('follows alias chains and keeps the alias name', () => {
        expect(resolveType(table, 'T_Alias')).toMatchObject({ kind: 'scalar', scopeType: 'UINT32', typeName: 'T_Alias' })
    })
    it('treats enums as their base type', () => {
        expect(resolveType(table, 'E_Mode')).toMatchObject({ kind: 'scalar', scopeType: 'INT16' })
    })
    it('knows TwinCAT system types that files reference without defining', () => {
        expect(resolveType(table, 'OTCID')).toMatchObject({ kind: 'scalar', scopeType: 'UINT32', typeName: 'OTCID' })
    })
    it('resolves arrays from symbol dims, alias dims and textual declarations', () => {
        expect(resolveType(table, 'INT', undefined, [{ lower: 1, upper: 2 }])).toMatchObject({ kind: 'array', element: 'INT' })
        expect(resolveType(table, 'T_Arr')).toMatchObject({ kind: 'array', dims: [{ lower: 0, upper: 2 }], element: 'LREAL' })
        expect(resolveType(table, 'ARRAY [1..2, -1..1] OF BOOL')).toMatchObject({
            kind: 'array',
            dims: [
                { lower: 1, upper: 2 },
                { lower: -1, upper: 1 },
            ],
            element: 'BOOL',
        })
    })
    it('includes inherited members first and skips hidden ones', () => {
        const fb = resolveType(table, 'FB_Child')
        expect(fb.kind === 'struct' && fb.members.map((m) => m.name)).toEqual(['bBusy', 'fVal', 'pNext'])
    })
    it('resolves pointers to their target and references to the referenced type', () => {
        expect(resolveType(table, 'POINTER TO FB_Child')).toMatchObject({ kind: 'pointer', target: 'FB_Child' })
        expect(resolveType(table, 'REFERENCE TO T_Alias')).toMatchObject({ kind: 'scalar', scopeType: 'UINT32', viaReference: true })
        expect(resolveType(table, 'POINTER TO ARRAY [0..0, 1..0] OF INT')).toMatchObject({ kind: 'unsupported', reason: /without ADS symbols/ })
    })
    it('marks strings, interfaces and unknown types as unsupported', () => {
        expect(resolveType(table, 'STRING(80)').kind).toBe('unsupported')
        expect(resolveType(table, 'I_Thing')).toMatchObject({ kind: 'unsupported', reason: /Interface/ })
        expect(resolveType(table, 'ST_Missing')).toMatchObject({ kind: 'unsupported', reason: /not defined/ })
    })
    it('uses the namespace to pick between same-named types', () => {
        const b = resolveType(table, 'ST_Dup', 'LibB')
        expect(b.kind === 'struct' && b.members[0].name).toBe('b')
    })
    it('stops on recursive aliases', () => {
        expect(resolveType(table, 'T_Loop')).toMatchObject({ kind: 'unsupported', reason: /recursive/ })
    })
})
