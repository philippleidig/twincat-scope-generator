import { describe, it, expect, beforeEach } from 'vitest'
import { parseTmc } from './tmcParser'
import { iterAllSymbols } from './index'

/**
 * Sample faithfully modeled on the C++ TcCOM TMC produced by TwinCAT XAE
 * (verified shape against vexvoltage/TwinCat3_CPP_Examples S01-CyclicIO).
 *
 * Key real-world details reproduced:
 *   - <Modules>/<Module GUID="..." Group="..."> with <Name>, <CLSID ClassFactory="...">
 *   - <Parameters> block (NOT <Symbols>) with both scalar and SubItem parameters
 *   - HideParameter="true" on system parameters (e.g. TraceLevelMax)
 *   - <DataAreas>/<DataArea> with <AreaNo AreaType="InputDst|OutputSrc"> children
 *   - Symbols with <Name> and <BaseType> (no <Properties> block by default)
 *   - <DataTypes> alias map for resolving custom typedefs
 */
const TMC_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<TcModuleClass xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xsi:noNamespaceSchemaLocation="http://www.beckhoff.com/schemas/2009/05/TcModuleClass">
  <Vendor><Name>Test Vendor</Name></Vendor>
  <DataTypes>
    <DataType>
      <Name>OTCID</Name>
      <BaseType>UDINT</BaseType>
    </DataType>
  </DataTypes>
  <Modules>
    <Module GUID="{e5932aec-6c12-447a-919d-2fa1e04918b3}" Group="C++">
      <Name>CModule1</Name>
      <CLSID ClassFactory="Untitled1">{e5932aec-6c12-447a-919d-2fa1e04918b3}</CLSID>
      <Contexts><Context><Id>1</Id></Context></Contexts>
      <Parameters>
        <Parameter HideParameter="true">
          <Name>TraceLevelMax</Name>
          <BaseType>TcTraceLevel</BaseType>
          <PTCID>#x03002103</PTCID>
          <ContextId>1</ContextId>
        </Parameter>
        <Parameter>
          <Name>Parameter</Name>
          <SubItem><Name>data1</Name><Type>UDINT</Type></SubItem>
          <SubItem><Name>data2</Name><Type>OTCID</Type></SubItem>
          <SubItem><Name>data3</Name><Type>LREAL</Type></SubItem>
          <PTCID>#x00000001</PTCID>
          <ContextId>1</ContextId>
        </Parameter>
        <Parameter>
          <Name>SimpleScalar</Name>
          <BaseType>BOOL</BaseType>
          <Properties>
            <Property>
              <Name>CreateSymbol</Name>
              <Value>false</Value>
            </Property>
          </Properties>
        </Parameter>
      </Parameters>
      <DataAreas>
        <DataArea>
          <AreaNo AreaType="InputDst">0</AreaNo>
          <Name>Inputs</Name>
          <ContextId>1</ContextId>
          <Symbol><Name>Value</Name><BaseType>UDINT</BaseType></Symbol>
          <Symbol><Name>Status</Name><BaseType>UDINT</BaseType></Symbol>
          <Symbol><Name>Data</Name><BaseType>UDINT</BaseType></Symbol>
        </DataArea>
        <DataArea>
          <AreaNo AreaType="OutputSrc">1</AreaNo>
          <Name>Outputs</Name>
          <ContextId>1</ContextId>
          <Symbol><Name>Value</Name><BaseType>UDINT</BaseType></Symbol>
          <Symbol><Name>Control</Name><BaseType>UDINT</BaseType></Symbol>
        </DataArea>
        <DataArea>
          <AreaNo AreaType="MArea">2</AreaNo>
          <Name>InternalData</Name>
          <Symbol><Name>fHidden</Name><BaseType>LREAL</BaseType>
            <Properties>
              <Property>
                <Name>CreateSymbol</Name>
                <Value>false</Value>
              </Property>
            </Properties>
          </Symbol>
          <Symbol><Name>stStruct</Name><BaseType>ST_MyStruct</BaseType></Symbol>
        </DataArea>
      </DataAreas>
    </Module>
  </Modules>
</TcModuleClass>`

describe('parseTmc', () => {
    let result: ReturnType<typeof parseTmc>

    beforeEach(() => {
        result = parseTmc('CModule1.tmc', TMC_SAMPLE)
    })

    it('detects file type as TMC', () => {
        expect(result.fileType).toBe('TMC')
    })

    it('extracts the module with class factory as className', () => {
        expect(result.objects).toHaveLength(1)
        expect(result.objects[0].name).toBe('CModule1')
        expect(result.objects[0].className).toBe('Untitled1')
    })

    it('skips parameters marked HideParameter="true"', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        expect(all.find(s => s.name === 'TraceLevelMax')).toBeUndefined()
    })

    it('expands struct parameters into individual SubItem symbols', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const data1 = all.find(s => s.name === 'data1')
        const data2 = all.find(s => s.name === 'data2')
        const data3 = all.find(s => s.name === 'data3')
        expect(data1?.fullPath).toBe('CModule1.Parameter.data1')
        expect(data2?.fullPath).toBe('CModule1.Parameter.data2')
        expect(data3?.fullPath).toBe('CModule1.Parameter.data3')
    })

    it('resolves type aliases via <DataTypes> map (OTCID -> UDINT -> UINT32)', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const data2 = all.find(s => s.name === 'data2')!
        expect(data2.dataType).toBe('UINT32')
    })

    it('groups DataArea symbols and labels Inputs/Outputs by AreaType', () => {
        const obj = result.objects[0]
        const inputs = obj.groups.find(g => g.name === 'Inputs')!
        const outputs = obj.groups.find(g => g.name === 'Outputs')!
        const internal = obj.groups.find(g => g.name === 'InternalData')!
        expect(inputs.kind).toBe('InputArea')
        expect(outputs.kind).toBe('OutputArea')
        expect(internal.kind).toBe('DataArea')
    })

    it('marks struct DataArea symbols with unsupported scope type as dataType=null', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const struct = all.find(s => s.name === 'stStruct')!
        expect(struct.dataType).toBeNull()
        expect(struct.rawType).toBe('ST_MyStruct')
    })

    it('reads CreateSymbol overrides at the symbol level', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const hidden = all.find(s => s.name === 'fHidden')!
        const simple = all.find(s => s.name === 'SimpleScalar')!
        const value = all.find(s => s.name === 'Value' && s.groupName === 'Inputs')!
        expect(hidden.createSymbol).toBe(false)
        expect(simple.createSymbol).toBe(false)
        // No <Properties> block on Inputs.Value -> defaults to true.
        expect(value.createSymbol).toBe(true)
    })

    it('builds the full path with module name as the prefix', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const inputsValue = all.find(s => s.name === 'Value' && s.groupName === 'Inputs')!
        expect(inputsValue.fullPath).toBe('CModule1.Value')
    })

    it('maps Beckhoff types to internal DataType', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        expect(all.find(s => s.name === 'Status')!.dataType).toBe('UINT32')
        expect(all.find(s => s.name === 'data3')!.dataType).toBe('REAL64')
        expect(all.find(s => s.name === 'SimpleScalar')!.dataType).toBe('BIT')
    })

    it('rejects XTI files passed by mistake', () => {
        expect(() => parseTmc('x.xti', '<?xml version="1.0"?><TcSmItem></TcSmItem>')).toThrow(/Not a TMC/)
    })

    it('warns when the TMC contains only DataTypes (PLC-generated TMC)', () => {
        const r = parseTmc('plc.tmc', '<?xml version="1.0"?><TcModuleClass><DataTypes/></TcModuleClass>')
        expect(r.objects).toHaveLength(0)
        expect(r.warnings.length).toBeGreaterThan(0)
    })
})
