/**
 * ADS accessibility rules (spec V2.1 A1, ADR 0005): one minimal `.tmc` snippet per construct,
 * checked through everything built on the walker — tree, search index, "Add" candidates and
 * path lookup — so they cannot disagree.
 */
import { describe, expect, it } from 'vitest'
import { FIXTURES, fixture } from './__fixtures__/load'
import { candidatesAt } from './candidates'
import { importTwinCatFile } from './importFile'
import type { SymbolSource } from './model'
import { buildIndex } from './search'
import type { BrowserNode, SymbolNode } from './tree'
import { childrenOf, isExpandable, sourceChildren } from './tree'
import { NOTE, REASON } from './typeTable'
import { resolvePath, rootNode, walk } from './walk'

const prop = (name: string, value?: string) => `<Property><Name>${name}</Name>${value === undefined ? '' : `<Value>${value}</Value>`}</Property>`
const props = (...p: string[]) => `<Properties>${p.join('')}</Properties>`
let offset = 0
const sub = (name: string, type: string, extra = '') => `<SubItem><Name>${name}</Name><Type>${type}</Type>${extra}<BitOffs>${(offset += 8)}</BitOffs></SubItem>`
const dataType = (name: string, body: string) => `<DataType><Name>${name}</Name>${body}</DataType>`
const symbol = (name: string, type: string, extra = '') => `<Symbol><Name>${name}</Name><BaseType>${type}</BaseType>${extra}</Symbol>`

/** A PLC `.tmc` with these data types and `<Symbol>`s, imported as one source. */
function plc(types: string, symbols: string): SymbolSource {
    const xml = `<TcModuleClass><DataTypes>${types}</DataTypes><Modules><Module><Name>P</Name><CLSID ClassFactory="TcPlc30">{x}</CLSID>
      <DataAreas><DataArea><AreaNo AreaType="Internal">0</AreaNo><Name>PlcTask Internal</Name>${symbols}</DataArea></DataAreas></Module></Modules></TcModuleClass>`
    return importTwinCatFile('t.tmc', xml)[0]
}

const ST_POINT = dataType('ST_Point', sub('x', 'REAL') + sub('y', 'REAL'))

const paths = (s: SymbolSource) => buildIndex([s]).entries.map((e) => e.path)
const entry = (s: SymbolSource, path: string) => buildIndex([s]).entries.find((e) => e.path === path)
const adds = (s: SymbolSource, path: string) => candidatesAt(s, path).specs.map((c) => c.symbol)
const rootNames = (s: SymbolSource) => s.roots.map((r) => r.name)

/** Tree node at a dotted label path (`MAIN`, `fb`, `p`, `^`). */
function treeNode(s: SymbolSource, ...labels: string[]): SymbolNode {
    let nodes: BrowserNode[] = sourceChildren(s)
    let node: BrowserNode | undefined
    for (const label of labels) {
        node = nodes.find((n) => n.label === label)
        if (!node) throw new Error(`no tree node ${label} in [${nodes.map((n) => n.label)}]`)
        nodes = isExpandable(node) ? childrenOf(s, node) : []
    }
    return node as SymbolNode
}
const treeLabels = (s: SymbolSource, ...labels: string[]) => childrenOf(s, treeNode(s, ...labels)).map((n) => n.label)

describe('properties', () => {
    const fb = dataType(
        'FB_Motor',
        sub('bOn', 'BOOL') +
            '<Method><Name>__getSpeed</Name><ReturnType>LREAL</ReturnType>' + props(prop('property')) + '</Method>' +
            '<PropertyItem><Name>Busy</Name><Type>BOOL</Type><BitSize>8</BitSize><GetCodeOffs>1024</GetCodeOffs></PropertyItem>' +
            props(prop('PouType', 'FunctionBlock')),
    )
    const s = plc(fb, symbol('MAIN.fbMotor', 'FB_Motor'))

    it('hides a property without monitoring pragma (only __get methods, no member)', () => {
        expect(treeLabels(s, 'MAIN', 'fbMotor')).toEqual(['bOn', 'Busy'])
        expect(paths(s).some((p) => /speed/i.test(p))).toBe(false)
        expect(resolvePath(s, 'MAIN.fbMotor.Speed')).toBeNull()
    })
    it("disables a property with monitoring := 'call' (PropertyItem)", () => {
        expect(treeNode(s, 'MAIN', 'fbMotor', 'Busy')).toMatchObject({ kind: 'unsupported', typeName: 'BOOL', reason: REASON.property })
        expect(entry(s, 'MAIN.fbMotor.Busy')).toMatchObject({ kind: 'unsupported', reason: REASON.property })
        expect(adds(s, 'MAIN.fbMotor')).toEqual(['MAIN.fbMotor.bOn'])
    })
})

describe('methods and implicit members', () => {
    const fb = dataType(
        'FB_Job',
        sub('nStep', 'INT') +
            sub('FB_Job__M_Run__nCalls', 'DINT', props(prop('implicit_inst_var'))) +
            '<Method><Name>M_Run</Name><Parameter><Name>nArg</Name><Type>INT</Type></Parameter><Local><Name>i</Name><Type>INT</Type></Local></Method>',
    )
    const s = plc(fb, symbol('MAIN.fbJob', 'FB_Job'))

    it('hides methods with their parameters and locals', () => {
        expect(paths(s)).toEqual(['MAIN.fbJob', 'MAIN.fbJob.nStep'])
    })
    it('hides VAR_INST (implicit_inst_var)', () => {
        expect(resolvePath(s, 'MAIN.fbJob.FB_Job__M_Run__nCalls')).toBeNull()
    })
})

describe('VAR_STAT in a function block', () => {
    const fb = dataType('FB_Counter', sub('nValue', 'DINT') + '<SubItem><Name Static="true">nInstances</Name><Type>UDINT</Type></SubItem>')
    const s = plc(fb, symbol('MAIN.fbCounter', 'FB_Counter') + symbol('FB_Counter.nInstances', 'UDINT', props(prop('TcVarStatic'))))

    it('disables the static member below instances and names the global symbol', () => {
        const reason = REASON.staticVar('FB_Counter', 'nInstances')
        expect(reason).toBe('Static variable — record FB_Counter.nInstances')
        expect(treeNode(s, 'MAIN', 'fbCounter', 'nInstances')).toMatchObject({ kind: 'unsupported', reason })
        expect(adds(s, 'MAIN.fbCounter')).toEqual(['MAIN.fbCounter.nValue'])
    })
    it('keeps the global <FB type>.<var> symbol a normal root', () => {
        expect(entry(s, 'FB_Counter.nInstances')).toMatchObject({ kind: 'scalar', scopeType: 'UINT32' })
        expect(adds(s, 'FB_Counter.nInstances')).toEqual(['FB_Counter.nInstances'])
    })
})

describe('hide / hide_all_locals', () => {
    const types =
        ST_POINT +
        dataType('ST_Internal', sub('a', 'INT') + props(prop('hide'))) +
        dataType('ST_Mixed', sub('visible', 'INT') + sub('_secret', 'INT', props(prop('hide'))) + sub('internal', 'ST_Internal')) +
        dataType(
            'FB_Quiet',
            sub('bIn', 'BOOL', props(prop('ItemType', 'Input'))) + sub('nLocal', 'INT') + props(prop('hide_all_locals'), prop('PouType', 'FunctionBlock')),
        )
    const s = plc(
        types,
        symbol('GVL.hidden', 'INT', props(prop('hide'))) +
            symbol('GVL.internal', 'ST_Internal') +
            symbol('GVL.mixed', 'ST_Mixed') +
            symbol('GVL.quiet', 'FB_Quiet') +
            symbol('GVL.point', 'ST_Point'),
    )

    it('hides symbols and members marked hide', () => {
        expect(rootNames(s)).toEqual(['GVL.mixed', 'GVL.quiet', 'GVL.point'])
        expect(treeLabels(s, 'GVL', 'mixed')).toEqual(['visible'])
    })
    it('hides every symbol and member of a type marked hide', () => {
        expect(paths(s).filter((p) => p.includes('internal'))).toEqual([])
        expect(resolvePath(s, 'GVL.mixed.internal.a')).toBeNull()
        expect(adds(s, 'GVL.mixed')).toEqual(['GVL.mixed.visible'])
    })
    it('hides the locals of a POU marked hide_all_locals, not its inputs', () => {
        expect(treeLabels(s, 'GVL', 'quiet')).toEqual(['bIn'])
    })
})

describe('conditionalshow', () => {
    const types =
        dataType('ST_Lib', sub('a', 'INT') + props(prop('conditionalshow'))) +
        dataType('ST_Host', sub('open', 'INT') + sub('libOnly', 'INT', props(prop('conditionalshow'))) + sub('lib', 'ST_Lib')) +
        dataType('FB_LibPou', sub('bIn', 'BOOL', props(prop('ItemType', 'Input'))) + sub('nLocal', 'INT') + props(prop('conditionalshow_all_locals')))
    const s = plc(types, symbol('GVL.host', 'ST_Host') + symbol('GVL.libVar', 'INT', props(prop('conditionalshow'))) + symbol('GVL.pou', 'FB_LibPou'))
    const reason = REASON.conditionalShow

    it('disables members, symbols and types marked conditionalshow', () => {
        expect(reason).toBe('Hidden in compiled libraries')
        expect(treeNode(s, 'GVL', 'host', 'libOnly')).toMatchObject({ kind: 'unsupported', reason })
        expect(treeNode(s, 'GVL', 'host', 'lib')).toMatchObject({ kind: 'unsupported', reason, typeName: 'ST_Lib' })
        expect(entry(s, 'GVL.libVar')).toMatchObject({ kind: 'unsupported', reason })
        expect(adds(s, 'GVL.host')).toEqual(['GVL.host.open'])
        expect(adds(s, 'GVL.libVar')).toEqual([])
    })
    it('disables the locals of a POU marked conditionalshow_all_locals', () => {
        expect(treeNode(s, 'GVL', 'pou', 'nLocal')).toMatchObject({ kind: 'unsupported', reason })
        expect(treeNode(s, 'GVL', 'pou', 'bIn')).toMatchObject({ kind: 'scalar' })
    })
})

describe('TcNoSymbol', () => {
    const types = dataType('FB_Buffer', sub('n', 'INT') + props(prop('tc_no_symbol'))) + dataType('ST_Host', sub('buf', 'FB_Buffer') + sub('k', 'INT'))
    const s = plc(
        types,
        symbol('GVL.noSymbol', 'INT', props(prop('tc_no_symbol'))) +
            symbol('GVL.maybe', 'INT', props(prop('tc_no_symbol', 'unused;ST_TcEventClass'))) +
            symbol('GVL.buffer', 'FB_Buffer') +
            symbol('GVL.host', 'ST_Host'),
    )

    it('hides symbols and types without value', () => {
        expect(rootNames(s)).toEqual(['GVL.maybe', 'GVL.host'])
        expect(treeLabels(s, 'GVL', 'host')).toEqual(['k'])
    })
    it("shows a symbol marked 'unused' with a note, still recordable", () => {
        expect(entry(s, 'GVL.maybe')).toMatchObject({ kind: 'scalar', warning: NOTE.unusedNoSymbol })
        expect(treeNode(s, 'GVL', 'maybe').warning).toBe(NOTE.unusedNoSymbol)
        expect(adds(s, 'GVL.maybe')).toEqual(['GVL.maybe'])
    })
})

describe('POINTER TO', () => {
    const types =
        ST_POINT +
        dataType(
            'FB_Path',
            '<SubItem><Name>pPoint</Name><Type PointerTo="1">ST_Point</Type><BitOffs>0</BitOffs></SubItem>' +
                '<SubItem><Name>ppPoint</Name><Type PointerTo="2">ST_Point</Type><BitOffs>64</BitOffs></SubItem>' +
                '<SubItem><Name>pBuffer</Name><Type>ST_Point</Type><ArrayInfo PointerTo="1"><LBound>0</LBound><Elements>65536</Elements></ArrayInfo><BitOffs>128</BitOffs></SubItem>' +
                '<SubItem><Name>pNext</Name><Type PointerTo="1">FB_Path</Type><BitOffs>192</BitOffs></SubItem>' +
                sub('n', 'INT'),
        ) +
        dataType('T_PointPtr', '<BaseType PointerTo="1">ST_Point</BaseType>') +
        dataType('POINTER TO ARRAY [0..65535] OF BYTE', '<BaseType>BYTE</BaseType>')
    const s = plc(types, symbol('MAIN.fbPath', 'FB_Path') + symbol('MAIN.pAlias', 'T_PointPtr') + symbol('MAIN.pBytes', 'POINTER TO ARRAY [0..65535] OF BYTE'))

    it('disables the pointer itself and expands it to one ^ child with the target type', () => {
        const pointer = treeNode(s, 'MAIN', 'fbPath', 'pPoint')
        expect(pointer).toMatchObject({ kind: 'pointer', typeName: 'POINTER TO ST_Point', reason: REASON.pointer })
        expect(isExpandable(pointer)).toBe(true)
        const target = treeNode(s, 'MAIN', 'fbPath', 'pPoint', '^')
        expect(target).toMatchObject({ kind: 'struct', typeName: 'ST_Point', symbol: { path: 'MAIN.fbPath.pPoint^' } })
        expect(treeLabels(s, 'MAIN', 'fbPath', 'pPoint', '^')).toEqual(['x', 'y'])
    })
    it('dereferences pointers to pointers twice', () => {
        expect(treeNode(s, 'MAIN', 'fbPath', 'ppPoint', '^')).toMatchObject({ kind: 'pointer', typeName: 'POINTER TO ST_Point' })
        expect(entry(s, 'MAIN.fbPath.ppPoint^^.x')).toMatchObject({ kind: 'scalar', scopeType: 'REAL32' })
    })
    it('reads pointers to arrays (<ArrayInfo PointerTo>) and POINTER TO type names as pointers, not arrays', () => {
        expect(treeNode(s, 'MAIN', 'fbPath', 'pBuffer')).toMatchObject({ kind: 'pointer', typeName: 'POINTER TO ARRAY[0..65535] OF ST_Point' })
        expect(entry(s, 'MAIN.fbPath.pBuffer^[*].x')?.ranges).toEqual([{ lower: 0, upper: 65535 }])
        expect(entry(s, 'MAIN.pBytes')).toMatchObject({ kind: 'pointer' })
        expect(entry(s, 'MAIN.pBytes^')).toMatchObject({ kind: 'array' })
        expect(entry(s, 'MAIN.pAlias^.y')).toMatchObject({ kind: 'scalar' })
    })
    it('lists ^ paths in search, without running around pointer cycles', () => {
        const all = paths(s)
        expect(all).toEqual(expect.arrayContaining(['MAIN.fbPath.pPoint', 'MAIN.fbPath.pPoint^', 'MAIN.fbPath.pPoint^.x', 'MAIN.fbPath.pNext^.n', 'MAIN.fbPath.pNext^.pNext^']))
        expect(all).not.toContain('MAIN.fbPath.pNext^.pNext^.n')
    })
    it('resolves ^ segments and records the target, but "Add" on the owner does not follow pointers', () => {
        expect(resolvePath(s, 'main.fbpath.ppoint^.Y')).toMatchObject({ path: 'MAIN.fbPath.pPoint^.y', resolved: { kind: 'scalar' } })
        expect(resolvePath(s, 'MAIN.fbPath.n^')).toBeNull()
        expect(resolvePath(s, 'MAIN.pAlias^')?.resolved.kind).toBe('struct')
        expect(adds(s, 'MAIN.fbPath.pPoint')).toEqual(['MAIN.fbPath.pPoint^.x', 'MAIN.fbPath.pPoint^.y'])
        expect(adds(s, 'MAIN.fbPath.pPoint^')).toEqual(['MAIN.fbPath.pPoint^.x', 'MAIN.fbPath.pPoint^.y'])
        expect(adds(s, 'MAIN.fbPath')).toEqual(['MAIN.fbPath.n'])
    })
})

describe('REFERENCE TO / VAR_IN_OUT', () => {
    const types =
        ST_POINT +
        dataType(
            'FB_Use',
            '<SubItem><Name>refPoint</Name><Type ReferenceTo="true">ST_Point</Type><BitOffs>0</BitOffs></SubItem>' +
                sub('Target', 'ST_Point', props(prop('ItemType', 'InOut'))) +
                '<SubItem><Name>refSelf</Name><Type ReferenceTo="true">FB_Use</Type><BitOffs>128</BitOffs></SubItem>' +
                sub('n', 'INT'),
        )
    const s = plc(types, symbol('MAIN.fbUse', 'FB_Use') + symbol('GVL.point', 'ST_Point'))

    it('expands like the referenced type in the tree, without ^, flagged as via reference', () => {
        expect(treeLabels(s, 'MAIN', 'fbUse', 'refPoint')).toEqual(['x', 'y'])
        const x = treeNode(s, 'MAIN', 'fbUse', 'refPoint', 'x')
        expect(x).toMatchObject({ kind: 'scalar', viaReference: true, warning: NOTE.viaReference })
        expect(resolvePath(s, 'MAIN.fbUse.refPoint.x')).toMatchObject({ viaReference: true, resolved: { kind: 'scalar' } })
    })
    it('lists the reference member in search but not what it points to', () => {
        expect(entry(s, 'MAIN.fbUse.refPoint')).toMatchObject({ kind: 'struct', viaReference: true, warning: 'Valid only while the reference is bound' })
        expect(entry(s, 'MAIN.fbUse.refPoint.x')).toBeUndefined()
        expect(entry(s, 'MAIN.fbUse.n')?.viaReference).toBeUndefined()
        // A member search finds the real symbol, not a copy through every reference.
        expect(paths(s).filter((p) => p.endsWith('.x'))).toEqual(['GVL.point.x'])
    })
    it('treats VAR_IN_OUT (ItemType InOut) as a reference', () => {
        expect(entry(s, 'MAIN.fbUse.Target')).toMatchObject({ kind: 'struct', viaReference: true })
        expect(resolvePath(s, 'MAIN.fbUse.Target.y')).toMatchObject({ viaReference: true })
    })
    it('stays recordable when added directly; "Add" on the owner does not follow references', () => {
        expect(adds(s, 'MAIN.fbUse.refPoint')).toEqual(['MAIN.fbUse.refPoint.x', 'MAIN.fbUse.refPoint.y'])
        expect(adds(s, 'MAIN.fbUse')).toEqual(['MAIN.fbUse.n'])
        expect(paths(s)).toContain('MAIN.fbUse.refSelf')
        expect(paths(s)).not.toContain('MAIN.fbUse.refSelf.n')
    })
    it('walks through references once when asked to, without running around cycles', () => {
        const all = [...walk(s, rootNode(s, s.roots[0]))].map((n) => n.path)
        expect(all).toEqual(expect.arrayContaining(['MAIN.fbUse.refPoint.x', 'MAIN.fbUse.refSelf.n', 'MAIN.fbUse.refSelf.refSelf']))
        expect(all).not.toContain('MAIN.fbUse.refSelf.refSelf.n')
    })
})

describe('other types', () => {
    const types =
        dataType('I_Thing', '<ExtendsType>PVOID</ExtendsType><Method><Name>Do</Name></Method>') +
        dataType('ST_Flags', '<SubItem><Name>bA</Name><Type>BIT</Type><BitSize>1</BitSize><BitOffs>0</BitOffs></SubItem><SubItem><Name>bB</Name><Type>BIT</Type><BitSize>1</BitSize><BitOffs>1</BitOffs></SubItem>') +
        dataType('U_Word', '<SubItem><Name>w</Name><Type>WORD</Type><BitOffs>0</BitOffs></SubItem><SubItem><Name>b</Name><Type>BYTE</Type><ArrayInfo><LBound>0</LBound><Elements>2</Elements></ArrayInfo><BitOffs>0</BitOffs></SubItem>') +
        dataType('T_Range', '<BaseType>INT</BaseType><Properties><Property><Name>qualified_only</Name></Property></Properties>') +
        dataType('ST_Empty', '<SubItem><Name>none</Name><Type>INT</Type><ArrayInfo><LBound>0</LBound><Elements>0</Elements></ArrayInfo><BitOffs>0</BitOffs></SubItem>' + sub('k', 'INT'))
    const s = plc(
        types,
        symbol('GVL.iThing', 'I_Thing') +
            symbol('GVL.sName', 'STRING(80)') +
            symbol('GVL.flags', 'ST_Flags') +
            symbol('GVL.u', 'U_Word') +
            symbol('GVL.tTime', 'TIME') +
            symbol('GVL.range', 'T_Range', props(prop('symbol', 'readwrite'))) +
            symbol('GVL.empty', 'INT', '<ArrayInfo><LBound>1</LBound><Elements>0</Elements></ArrayInfo>') +
            symbol('GVL.withEmpty', 'ST_Empty'),
    )

    it('disables interface-typed symbols and strings with their reasons', () => {
        expect(entry(s, 'GVL.iThing')).toMatchObject({ kind: 'unsupported', reason: REASON.interface })
        expect(entry(s, 'GVL.sName')).toMatchObject({ kind: 'unsupported', reason: 'Strings can only be shown in table charts' })
    })
    it('shows BIT members, union members and time types as recordable', () => {
        expect(adds(s, 'GVL.flags')).toEqual(['GVL.flags.bA', 'GVL.flags.bB'])
        expect(entry(s, 'GVL.flags.bA')).toMatchObject({ kind: 'scalar', scopeType: 'BIT' })
        expect(adds(s, 'GVL.u')).toEqual(['GVL.u.w', 'GVL.u.b[{i:0:1}]'])
        expect(entry(s, 'GVL.tTime')).toMatchObject({ kind: 'scalar' })
    })
    it('hides empty arrays', () => {
        expect(rootNames(s)).not.toContain('GVL.empty')
        expect(treeLabels(s, 'GVL', 'withEmpty')).toEqual(['k'])
        expect(resolvePath(s, 'GVL.withEmpty.none')).toBeNull()
    })
    it('keeps the first of two roots with the same name, in tree, search and path lookup alike', () => {
        const dup = plc(ST_POINT, symbol('GVL.p', 'ST_Point') + symbol('gvl.P', 'INT'))
        expect(rootNames(dup)).toEqual(['GVL.p'])
        expect(resolvePath(dup, 'GVL.p.x')).not.toBeNull()
    })
    it('ignores qualified_only and the CODESYS symbol attribute', () => {
        expect(entry(s, 'GVL.range')).toMatchObject({ kind: 'scalar', typeName: 'T_Range' })
    })
})

describe('real file (Beckhoff TE2000 UserGuidance sample)', () => {
    const [s] = importTwinCatFile('UserGuidance_PLC.tmc', fixture(FIXTURES.accessTmc))
    const index = buildIndex([s])

    it('disables monitored properties and library-internal members of event logger FBs', () => {
        expect(entry(s, 'MAIN.fbMessagePDF.nEventId')).toMatchObject({ kind: 'unsupported', typeName: 'UDINT', reason: REASON.property })
        expect(entry(s, 'MAIN.fbMessagePDF.fbSourceInfo')).toMatchObject({ kind: 'unsupported', reason: REASON.conditionalShow })
        expect(adds(s, 'MAIN.fbMessagePDF').some((p) => p.endsWith('.nEventId') || p.includes('fbSourceInfo'))).toBe(false)
    })
    it('shows a pointer with its ^ target', () => {
        expect(entry(s, 'Global_LogString.pLogString')).toMatchObject({ kind: 'pointer', typeName: 'POINTER TO STRING(255)' })
        expect(entry(s, 'Global_LogString.pLogString^')).toMatchObject({ kind: 'unsupported', reason: REASON.string })
    })
    it("notes TcNoSymbol 'unused' event classes down to their members", () => {
        const events = index.entries.filter((e) => e.path.startsWith('TC_EVENTS.'))
        expect(events.length).toBeGreaterThan(1)
        expect(events.every((e) => e.warning === NOTE.unusedNoSymbol)).toBe(true)
    })
    it('resolves every index entry', () => {
        expect(index.entries.filter((e) => !resolvePath(s, e.path))).toEqual([])
    })
})
