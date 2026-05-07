import { describe, it, expect } from 'vitest'
import { parseXti } from './xtiParser'
import { iterAllSymbols, flattenObjects, parseTwinCatFile } from './index'

/**
 * NC-Axis XTI sample (matches the structure of TwinCAT NC axis exports as
 * seen in graemepeek/tc3_test2 ".../_Config/NC/Axes/Axis 3.xti").
 *
 * Real shape: <TcSmItem ClassName="CNcAxisDef"> at root, <Axis> with
 * Encoder/Drive/Controller subgroups, each carrying <Vars VarGrpType="1|2">
 * with <Var> children for inputs/outputs.
 */
const XTI_NC_AXIS_SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<TcSmItem xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="http://www.beckhoff.com/schemas/2012/07/TcSmItem"
          TcSmVersion="1.0" ClassName="CNcAxisDef" SubType="1">
  <Axis Id="3" CreateSymbols="true" AxisType="1">
    <Encoder Name="Enc" EncType="1">
      <Vars VarGrpType="1">
        <Name>Inputs</Name>
        <Var><Name>nState1</Name><BaseType>UDINT</BaseType></Var>
        <Var><Name>fActPosition</Name><BaseType>LREAL</BaseType></Var>
      </Vars>
      <Vars VarGrpType="2">
        <Name>Outputs</Name>
        <Var><Name>nCtrlDWord</Name><BaseType>UDINT</BaseType></Var>
      </Vars>
    </Encoder>
    <Vars VarGrpType="1">
      <Name>Inputs</Name>
      <Var><Name>FromPlc</Name><BaseType>NCTOPLC_AXLESTRUCT</BaseType></Var>
    </Vars>
    <Vars VarGrpType="2">
      <Name>Outputs</Name>
      <Var><Name>ToPlc</Name><BaseType>PLCTONC_AXLESTRUCT</BaseType></Var>
    </Vars>
  </Axis>
</TcSmItem>`

/**
 * TcCOM-instance XTI sample (a TreeItem wrapping a Module). Modeled on
 * exports produced when right-clicking a TcCOM instance in the TwinCAT
 * tree and choosing "Save TreeItem As..." / "Export". The Module follows
 * the same shape as TMC, so we exercise:
 *   - Parameters with SubItem expansion
 *   - DataAreas with InputDst/OutputSrc AreaTypes
 *   - Nested TreeItem path concatenation using the file stem as instance
 */
const XTI_TCCOM_SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<TcSmItem xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="http://www.beckhoff.com/schemas/2012/07/TcSmItem"
          TcSmVersion="1.0" ClassName="CTcCOMObject" SubType="0">
  <TreeItem>
    <Name>MyModuleInstance</Name>
    <Module>
      <Name>CModule1</Name>
      <Parameters>
        <Parameter>
          <Name>MaxSpeed</Name>
          <BaseType>UDINT</BaseType>
        </Parameter>
        <Parameter>
          <Name>Tuning</Name>
          <SubItem><Name>kp</Name><Type>LREAL</Type></SubItem>
          <SubItem><Name>ki</Name><Type>LREAL</Type></SubItem>
        </Parameter>
      </Parameters>
      <DataAreas>
        <DataArea>
          <AreaNo AreaType="InputDst">0</AreaNo>
          <Name>Inputs</Name>
          <Symbol><Name>bEnable</Name><BaseType>BOOL</BaseType></Symbol>
          <Symbol><Name>fSetpoint</Name><BaseType>LREAL</BaseType></Symbol>
        </DataArea>
        <DataArea>
          <AreaNo AreaType="OutputSrc">1</AreaNo>
          <Name>Outputs</Name>
          <Symbol><Name>bRunning</Name><BaseType>BOOL</BaseType></Symbol>
        </DataArea>
      </DataAreas>
    </Module>
    <TreeItem>
      <Name>SubInstance</Name>
      <Module>
        <Name>CSubModule</Name>
        <DataAreas>
          <DataArea>
            <AreaNo AreaType="InputDst">0</AreaNo>
            <Name>Inputs</Name>
            <Symbol><Name>nValue</Name><BaseType>DINT</BaseType></Symbol>
          </DataArea>
        </DataAreas>
      </Module>
    </TreeItem>
  </TreeItem>
</TcSmItem>`

describe('parseXti — NC axis (CNcAxisDef)', () => {
    const result = parseXti('Axis 3.xti', XTI_NC_AXIS_SAMPLE)

    it('detects the file type', () => {
        expect(result.fileType).toBe('XTI')
    })

    it('uses the file stem as the instance name', () => {
        expect(result.objects).toHaveLength(1)
        expect(result.objects[0].name).toBe('Axis 3')
        expect(result.objects[0].className).toBe('CNcAxisDef')
    })

    it('produces input/output groups for axis-level Vars', () => {
        const groups = result.objects[0].groups
        const axisInputs = groups.find(g => g.name === 'Inputs' && g.symbols.some(s => s.name === 'FromPlc'))
        const axisOutputs = groups.find(g => g.name === 'Outputs' && g.symbols.some(s => s.name === 'ToPlc'))
        expect(axisInputs?.kind).toBe('InputArea')
        expect(axisOutputs?.kind).toBe('OutputArea')
    })

    it('produces input/output groups for Encoder Vars too', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        expect(all.find(s => s.name === 'fActPosition')?.fullPath).toBe('Axis 3.Enc.fActPosition')
        expect(all.find(s => s.name === 'fActPosition')?.dataType).toBe('REAL64')
    })

    it('handles unknown structs as null dataType', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const fromPlc = all.find(s => s.name === 'FromPlc')!
        expect(fromPlc.dataType).toBeNull()
        expect(fromPlc.rawType).toBe('NCTOPLC_AXLESTRUCT')
    })
})

describe('parseXti — TcCOM instance (CTcCOMObject)', () => {
    const result = parseXti('MyModuleInstance.xti', XTI_TCCOM_SAMPLE)

    it('returns one TreeItem object with one nested child', () => {
        expect(result.objects).toHaveLength(1)
        expect(result.objects[0].name).toBe('MyModuleInstance')
        expect(result.objects[0].children).toHaveLength(1)
        expect(result.objects[0].children[0].name).toBe('SubInstance')
    })

    it('expands struct parameters with the TreeItem name as path prefix', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        expect(all.find(s => s.name === 'kp')?.fullPath).toBe('MyModuleInstance.Tuning.kp')
        expect(all.find(s => s.name === 'ki')?.fullPath).toBe('MyModuleInstance.Tuning.ki')
    })

    it('classifies DataAreas correctly via AreaType', () => {
        const obj = result.objects[0]
        const inputs = obj.groups.find(g => g.name === 'Inputs')!
        const outputs = obj.groups.find(g => g.name === 'Outputs')!
        expect(inputs.kind).toBe('InputArea')
        expect(outputs.kind).toBe('OutputArea')
    })

    it('builds nested paths concatenating parent and child instance names', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const nValue = all.find(s => s.name === 'nValue')!
        expect(nValue.fullPath).toBe('MyModuleInstance.SubInstance.nValue')
        expect(nValue.dataType).toBe('INT32')
    })

    it('flattenObjects yields parent before child', () => {
        const flat = flattenObjects(result.objects)
        expect(flat.map(o => o.name)).toEqual(['MyModuleInstance', 'SubInstance'])
    })

    it('rejects TMC files passed by mistake', () => {
        expect(() => parseXti('x.tmc', '<?xml version="1.0"?><TcModuleClass></TcModuleClass>')).toThrow(/Not an XTI/)
    })
})

describe('parseTwinCatFile dispatcher', () => {
    it('routes .tmc files to the TMC parser', () => {
        const r = parseTwinCatFile('x.tmc', '<?xml version="1.0"?><TcModuleClass/>')
        expect(r.fileType).toBe('TMC')
    })

    it('routes .xti files to the XTI parser', () => {
        const r = parseTwinCatFile('x.xti', '<?xml version="1.0"?><TcSmItem ClassName="X"/>')
        expect(r.fileType).toBe('XTI')
    })

    it('falls back to root-element detection when extension is unknown', () => {
        const r = parseTwinCatFile('blob', '<?xml version="1.0"?><TcModuleClass/>')
        expect(r.fileType).toBe('TMC')
    })

    it('throws on completely foreign roots', () => {
        expect(() => parseTwinCatFile('x.txt', '<?xml version="1.0"?><foo/>')).toThrow(/Unrecognized/)
    })

    it('throws on malformed XML', () => {
        expect(() => parseTwinCatFile('x.tmc', '<not closed')).toThrow()
    })
})
