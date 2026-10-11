import { describe, expect, it } from 'vitest'
import { parseXml } from './xml'
import type { ArrayDim } from './model'
import { finalizeSource, readTypeTable, resolveDecl } from './typeTable'

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
const resolve = (type: string, ns?: string, dims?: ArrayDim[]) => resolveDecl(table, { type, ns, dims })

describe('resolveDecl', () => {
    it('resolves elementary types', () => {
        expect(resolve('LREAL')).toEqual({ kind: 'scalar', scopeType: 'REAL64', typeName: 'LREAL' })
    })
    it('follows alias chains and keeps the alias name', () => {
        expect(resolve('T_Alias')).toMatchObject({ kind: 'scalar', scopeType: 'UINT32', typeName: 'T_Alias' })
    })
    it('treats enums as their base type', () => {
        expect(resolve('E_Mode')).toMatchObject({ kind: 'scalar', scopeType: 'INT16' })
    })
    it('knows TwinCAT system types that files reference without defining', () => {
        expect(resolve('OTCID')).toMatchObject({ kind: 'scalar', scopeType: 'UINT32', typeName: 'OTCID' })
    })
    it('resolves arrays from symbol dims, alias dims and textual declarations', () => {
        expect(resolve('INT', undefined, [{ lower: 1, upper: 2 }])).toMatchObject({ kind: 'array', element: 'INT' })
        expect(resolve('T_Arr')).toMatchObject({ kind: 'array', dims: [{ lower: 0, upper: 2 }], element: 'LREAL' })
        expect(resolve('ARRAY [1..2, -1..1] OF BOOL')).toMatchObject({
            kind: 'array',
            dims: [
                { lower: 1, upper: 2 },
                { lower: -1, upper: 1 },
            ],
            element: 'BOOL',
        })
    })
    it('includes inherited members first and skips hidden ones', () => {
        const fb = resolve('FB_Child')
        expect(fb.kind === 'struct' && fb.members.map((m) => m.name)).toEqual(['bBusy', 'fVal', 'pNext'])
    })
    it('resolves pointers to their target and references to the referenced type', () => {
        expect(resolve('POINTER TO FB_Child')).toMatchObject({ kind: 'pointer', target: 'FB_Child' })
        expect(resolve('REFERENCE TO T_Alias')).toMatchObject({ kind: 'scalar', scopeType: 'UINT32', viaReference: true })
        expect(resolve('POINTER TO ARRAY [0..0, 1..0] OF INT')).toMatchObject({ kind: 'unsupported', reason: /without ADS symbols/ })
    })
    it('marks strings, interfaces and unknown types as unsupported', () => {
        expect(resolve('STRING(80)').kind).toBe('unsupported')
        expect(resolve('I_Thing')).toMatchObject({ kind: 'unsupported', reason: /Interface/ })
        expect(resolve('ST_Missing')).toMatchObject({ kind: 'unsupported', reason: /not defined/ })
    })
    it('uses the namespace to pick between same-named types', () => {
        const b = resolve('ST_Dup', 'LibB')
        expect(b.kind === 'struct' && b.members[0].name).toBe('b')
    })
    it('applies the declaration\'s access', () => {
        expect(resolveDecl(table, { type: 'LREAL', disabled: 'because' })).toEqual({ kind: 'unsupported', typeName: 'LREAL', reason: 'because' })
    })
    it('stops on recursive aliases', () => {
        expect(resolve('T_Loop')).toMatchObject({ kind: 'unsupported', reason: /recursive/ })
    })
})

describe('finalizeSource', () => {
    const t = readTypeTable(
        doc(`
      <DataType><Name>T_None</Name><BaseType>INT</BaseType><ArrayInfo><LBound>0</LBound><Elements>0</Elements></ArrayInfo></DataType>
      <DataType><Name>ST_S</Name><SubItem><Name>none</Name><Type>T_None</Type></SubItem><SubItem><Name>k</Name><Type>INT</Type></SubItem></DataType>
      <DataType><Name>T_Hidden</Name><BaseType>INT</BaseType><Properties><Property><Name>hide</Name></Property></Properties></DataType>`),
    )
    const root = (name: string, type: string) => ({ name, type, area: 'internal' as const, areaName: 'I' })

    it('drops members and roots without symbols and keeps the first root per name', () => {
        expect(finalizeSource(t, [root('A.none', 'T_None'), root('A.s', 'ST_S'), root('a.S', 'INT'), root('A.h', 'T_Hidden')]).map((r) => r.name)).toEqual(['A.s', 'A.h'])
        const s = resolveDecl(t, { type: 'ST_S' })
        expect(s.kind === 'struct' && s.members.map((m) => m.name)).toEqual(['k'])
    })
    it('keeps symbols of a type marked hide: only declarations lose their symbol', () => {
        expect(resolveDecl(t, { type: 'T_Hidden' })).toMatchObject({ kind: 'scalar', typeName: 'T_Hidden' })
    })
})
