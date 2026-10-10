import { describe, expect, it } from 'vitest'
import { FIXTURES, fixture } from './__fixtures__/load'
import demoTmc from './demo/DemoMachine.tmc?raw'
import { importTwinCatFile } from './importFile'
import { buildIndex } from './search'
import { areaKind } from './tmc'

const entry = (sourceText: string, name: string, path: string) =>
    buildIndex(importTwinCatFile(name, sourceText)).entries.find((e) => e.path === path)

describe('PLC .tmc (Beckhoff TF6000 sample)', () => {
    const [source] = importTwinCatFile(FIXTURES.plcTmc, fixture(FIXTURES.plcTmc))

    it('is recognised as a PLC whose symbols are full ADS paths (no module prefix)', () => {
        expect(source).toMatchObject({ kind: 'PLC', title: 'PLC (PLC)', pathPrefix: '', port: 851 })
        expect(source.roots.map((r) => r.name)).toContain('MAIN.nCounter')
        expect(source.roots.every((r) => !r.name.startsWith('PLC.'))).toBe(true)
    })

    it('reads areas, namespaced FB types, arrays and comments', () => {
        const tp = source.roots.find((r) => r.name === 'MAIN.TP_1')!
        expect(tp).toMatchObject({ type: 'TP', ns: 'tc2_standard, 3.3.0.0 (beckhoff automation gmbh)', area: 'internal' })
        expect(source.roots.find((r) => r.name === 'GVL.REAL32_1')).toMatchObject({ area: 'internal', areaName: 'PlcTask MArea', comment: '1' })
        expect(source.roots.find((r) => r.name === 'MAIN.PLCArray')!.dims).toEqual([{ lower: 0, length: 100 }])
    })

    it('expands FB members and maps their types', () => {
        const index = buildIndex([source])
        expect(index.entries.find((e) => e.path === 'MAIN.TP_1.ET')).toMatchObject({ kind: 'scalar', scopeType: 'UINT32', typeName: 'TIME' })
        expect(index.entries.find((e) => e.path === 'MAIN.PLCArray[*]')).toMatchObject({ scopeType: 'INT16', ranges: [{ lower: 0, upper: 99 }] })
        expect(index.entries.find((e) => e.path === 'MAIN.str2')).toMatchObject({ kind: 'unsupported' })
    })
})

describe('PLC .tmc with FB inheritance and %I* inputs (0w8States sample)', () => {
    const text = fixture(FIXTURES.inheritanceTmc)
    it('reads the port from ApplicationName and includes inherited members', () => {
        const [source] = importTwinCatFile(FIXTURES.inheritanceTmc, text)
        expect(source.port).toBe(851)
        expect(source.roots.some((r) => r.area === 'input')).toBe(true)
        expect(entry(text, 'x.tmc', 'MAIN.fbSensor1.rawValue')).toMatchObject({ scopeType: 'REAL32' })
    })
    it('treats interface references as unsupported', () => {
        const index = buildIndex(importTwinCatFile('x.tmc', text))
        expect(index.entries.filter((e) => e.typeName === 'I_TempSensor').every((e) => e.kind === 'unsupported')).toBe(true)
    })
})

describe('TcCOM .tmc (Beckhoff TF6311 sample)', () => {
    it('describes the class, with an editable instance prefix and a task port', () => {
        const [source] = importTwinCatFile(FIXTURES.tcomTmc, fixture(FIXTURES.tcomTmc))
        expect(source).toMatchObject({ kind: 'TcCOM', pathPrefix: source.title, port: 350 })
        expect(source.warnings.join(' ')).toMatch(/instance name/)
        // Struct parameter with inline <SubItem>s becomes an expandable struct.
        const index = buildIndex([source])
        const members = index.entries.filter((e) => e.path.startsWith(`${source.pathPrefix}.Parameter.`)).map((e) => e.name)
        expect(members).toEqual(['data1', 'data2', 'data3'])
    })
})

describe('bundled demo', () => {
    it('imports with structs, arrays, inheritance and hidden members', () => {
        const [source] = importTwinCatFile('DemoMachine.tmc', demoTmc)
        const paths = buildIndex([source]).entries.map((e) => e.path)
        expect(paths).toContain('GVL.aAxis[*].stDrive.fTorque')
        expect(paths).toContain('MAIN.fbConveyor.bBusy')
        expect(paths).not.toContain('MAIN.fbConveyor._nInternal')
        expect(source.roots.filter((r) => r.area === 'input').map((r) => r.name)).toEqual(['GVL_IO.bEmergencyStop', 'GVL_IO.nPressureRaw'])
    })
})

describe('edge cases', () => {
    it('reports a TMC without modules', () => {
        const [source] = importTwinCatFile('types.tmc', '<TcModuleClass><DataTypes/></TcModuleClass>')
        expect(source).toMatchObject({ kind: 'Other', roots: [] })
        expect(source.warnings[0]).toMatch(/data types only/)
    })
    it('classifies area types', () => {
        expect(areaKind('InputDst')).toBe('input')
        expect(areaKind('OutputSrc')).toBe('output')
        expect(areaKind('MArea')).toBe('internal')
    })
    it('rejects unknown and broken files', () => {
        expect(() => importTwinCatFile('a.xml', '<Foo/>')).toThrow(/unsupported file/)
        expect(() => importTwinCatFile('a.tmc', '<TcModuleClass>')).toThrow(/Not a valid XML file/)
    })
})
