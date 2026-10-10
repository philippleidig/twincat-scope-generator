import { describe, expect, it } from 'vitest'
import { FIXTURES, fixture } from './__fixtures__/load'
import { importTwinCatFile } from './importFile'
import { buildIndex } from './search'

const load = (name: string) => importTwinCatFile(name, fixture(name))

describe('NC axis .xti', () => {
    it('builds Axes.<axis>.<member> paths, like the symbols TwinCAT Scope saves, on the NC port', () => {
        const [nc] = load(FIXTURES.ncAxisXti)
        const axis = `Axes.${FIXTURES.ncAxisXti.replace('.xti', '')}`
        expect(nc).toMatchObject({ kind: 'NC', port: 501, pathPrefix: '', complete: true })
        const names = nc.roots.map((r) => r.name)
        expect(names).toEqual(expect.arrayContaining([`${axis}.ActPos`, `${axis}.SetPos`, `${axis}.FromPlc`, `${axis}.ToPlc`, `${axis}.Enc.In`]))
        expect(nc.roots.find((r) => r.name === `${axis}.ToPlc`)!.area).toBe('output')
        const entries = buildIndex([nc]).entries
        expect(entries.find((e) => e.path === `${axis}.ActPos`)).toMatchObject({ scopeType: 'REAL64' })
        expect(entries.find((e) => e.path === `${axis}.ToPlc.StateDWord.NotMoving`)).toMatchObject({ scopeType: 'BIT' })
    })
})

describe('NC task .xti', () => {
    it('takes the port from the SAF task and lists axes stored in other files', () => {
        const [nc] = load(FIXTURES.ncTaskXti)
        expect(nc.port).toBe(501)
        expect(nc.roots.some((r) => r.name.startsWith('Axes.Axis_NewArchMcMotionBlocks_Test.'))).toBe(true)
        expect(nc.warnings.join(' ')).toMatch(/separate files.*Axis_PositionStateRead_Test\.xti/)
    })
})

describe('PLC project .xti', () => {
    it('lists the I/O variables with their ADS port and recommends the .tmc', () => {
        const [plc] = load(FIXTURES.plcXti)
        expect(plc).toMatchObject({ kind: 'PLC', title: 'Library (PLC I/O)', port: 851, pathPrefix: '', complete: false })
        expect(plc.roots.length).toBeGreaterThan(900)
        expect(plc.roots.find((r) => r.name.endsWith('stMotionStage.Axis.NcToPlc'))).toMatchObject({ area: 'input', type: 'NCTOPLC_AXIS_REF' })
        expect(plc.warnings[0]).toMatch(/\.tmc/)
    })
})

describe('TcCOM object .xti', () => {
    it('uses the instance (file) name as prefix and data areas below it', () => {
        const [tcom] = load(FIXTURES.tcomXti)
        const instance = FIXTURES.tcomXti.replace('.xti', '')
        expect(tcom).toMatchObject({ kind: 'TcCOM', pathPrefix: instance })
        expect(tcom.roots.map((r) => r.name)).toContain('TempCtrl_U.FeedbackTemp')
        expect(tcom.roots.find((r) => r.name === 'TempCtrl_U.FeedbackTemp')!.area).toBe('input')
    })
    it('lists only parameters the object creates ADS symbols for', () => {
        const [tcom] = load(FIXTURES.tcomXti)
        const params = tcom.roots.filter((r) => r.area === 'parameter').map((r) => r.name)
        expect(params).toContain('ModuleCaller')
        expect(params).not.toContain('CallerVerification')
    })
})

describe('EtherCAT terminal .xti', () => {
    it('explains that process data is not recordable by symbol', () => {
        const [s] = load(FIXTURES.ethercatXti)
        expect(s).toMatchObject({ kind: 'Other', roots: [] })
        expect(s.warnings[0]).toMatch(/EtherCAT/)
    })
})

describe('.tsproj', () => {
    it('reports the target Net ID and referenced files of a split project', () => {
        const [s] = load(FIXTURES.splitTsproj)
        expect(s.amsNetId).toBe('172.21.148.154.1.1')
        expect(s.warnings.join(' ')).toMatch(/NC\.xti.*Library\.xti/)
    })
    it('reads inline PLC instances, TcCOM modules and axes', () => {
        const xml = `<TcSmProject><Project TargetNetId="5.6.7.8.1.1">
            <System><Tasks><Task AmsPort="350"><Name>T</Name></Task></Tasks></System>
            <Motion><NC><SafTask AmsPort="501"/><Axis><Name>Axis 1</Name><Vars VarGrpType="2"><Name>Outputs</Name><Var><Name>ToPlc</Name><Type>LREAL</Type></Var></Vars></Axis></NC></Motion>
            <Plc><Project Name="PLC1" AmsPort="852"><Instance><Vars VarGrpType="1"><Name>PlcTask Inputs</Name><Var><Name>MAIN.bIn</Name><Type>BOOL</Type></Var></Vars></Instance></Project></Plc>
          </Project></TcSmProject>`
        const sources = importTwinCatFile('m.tsproj', xml)
        expect(sources.map((s) => [s.kind, s.port, s.amsNetId])).toEqual([
            ['PLC', 852, '5.6.7.8.1.1'],
            ['NC', 501, '5.6.7.8.1.1'],
        ])
        expect(sources[1].roots.map((r) => r.name)).toContain('Axes.Axis 1.ToPlc')
    })
})

describe('mergeSources', () => {
    it('shares the single Net ID of a split .tsproj with the other files', async () => {
        const { mergeSources } = await import('./importFile')
        const merged = mergeSources(load(FIXTURES.ncTaskXti), load(FIXTURES.splitTsproj))
        expect(merged.find((s) => s.kind === 'NC')!.amsNetId).toBe('172.21.148.154.1.1')
    })
    it('keeps several Net IDs apart', async () => {
        const { mergeSources } = await import('./importFile')
        const a = { ...load(FIXTURES.ncTaskXti)[0], amsNetId: '1.1.1.1.1.1' }
        const b = { ...load(FIXTURES.tcomXti)[0], amsNetId: '2.2.2.2.1.1' }
        const c = load(FIXTURES.plcXti)[0]
        expect(mergeSources([a, b], [c]).find((s) => s.kind === 'PLC')!.amsNetId).toBeUndefined()
    })
})
