import { describe, it, expect, beforeEach } from 'vitest'
import { parseTwinCatFile, flattenObjects, iterAllSymbols } from './parser'

const TMC_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<TcModuleClass>
    <DataTypes>
        <DataType>
            <Name>OTCID</Name>
            <BaseType>UDINT</BaseType>
        </DataType>
    </DataTypes>
    <Modules>
        <Module>
            <CLSID>{12345678-1234-1234-1234-123456789012}</CLSID>
            <Name>CMyModule</Name>
            <ImageData>Qk0eAAAAAAAAAB4AAAAMAAAAAQABAAEAAAAA</ImageData>
            <Categories>
                <Category>
                    <Name>ParameterInit</Name>
                    <ImageData>Qk0eAAAAAAAAAB4AAAAMAAAAAQABAAEAAAAA</ImageData>
                </Category>
                <Category>
                    <Name>ParameterOnline</Name>
                </Category>
            </Categories>
            <Symbols>
                <Symbol>
                    <Category>ParameterInit</Category>
                    <Name>nMaxSpeed</Name>
                    <BaseType>UDINT</BaseType>
                    <Properties>
                        <Property>
                            <Name>CreateSymbol</Name>
                            <Value>true</Value>
                        </Property>
                    </Properties>
                </Symbol>
                <Symbol>
                    <Category>ParameterInit</Category>
                    <Name>fHidden</Name>
                    <BaseType>LREAL</BaseType>
                    <Properties>
                        <Property>
                            <Name>CreateSymbol</Name>
                            <Value>false</Value>
                        </Property>
                    </Properties>
                </Symbol>
                <Symbol>
                    <Category>ParameterOnline</Category>
                    <Name>nCounter</Name>
                    <BaseType>OTCID</BaseType>
                </Symbol>
            </Symbols>
            <DataAreas>
                <DataArea>
                    <Name>Inputs</Name>
                    <ImageData>Qk0eAAAAAAAAAB4AAAAMAAAAAQABAAEAAAAA</ImageData>
                    <Symbol>
                        <Name>bEnable</Name>
                        <BaseType>BOOL</BaseType>
                        <Properties>
                            <Property>
                                <Name>CreateSymbol</Name>
                                <Value>true</Value>
                            </Property>
                        </Properties>
                    </Symbol>
                    <Symbol>
                        <Name>fActPos</Name>
                        <BaseType>LREAL</BaseType>
                    </Symbol>
                    <Symbol>
                        <Name>stStruct</Name>
                        <BaseType>ST_MyStruct</BaseType>
                    </Symbol>
                </DataArea>
            </DataAreas>
        </Module>
    </Modules>
</TcModuleClass>`

const XTI_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<TcSmItem>
    <TreeItem>
        <Name>MyInstance</Name>
        <ItemSubType>0</ItemSubType>
        <ImplementsTcCOMObject>
            <Module>
                <CLSID>{abc}</CLSID>
                <Name>CMyClass</Name>
                <DataAreas>
                    <DataArea>
                        <Name>Outputs</Name>
                        <Symbol>
                            <Name>nOut</Name>
                            <BaseType>DINT</BaseType>
                            <Properties>
                                <Property>
                                    <Name>CreateSymbol</Name>
                                    <Value>true</Value>
                                </Property>
                            </Properties>
                        </Symbol>
                    </DataArea>
                </DataAreas>
            </Module>
        </ImplementsTcCOMObject>
        <TreeItem>
            <Name>Child1</Name>
            <ImplementsTcCOMObject>
                <Module>
                    <Name>CChild</Name>
                    <DataAreas>
                        <DataArea>
                            <Name>Inputs</Name>
                            <Symbol>
                                <Name>bChildIn</Name>
                                <BaseType>BOOL</BaseType>
                                <Properties>
                                    <Property>
                                        <Name>CreateSymbol</Name>
                                        <Value>false</Value>
                                    </Property>
                                </Properties>
                            </Symbol>
                        </DataArea>
                    </DataAreas>
                </Module>
            </ImplementsTcCOMObject>
        </TreeItem>
    </TreeItem>
</TcSmItem>`

describe('parseTwinCatFile (TMC)', () => {
    let result: ReturnType<typeof parseTwinCatFile>

    beforeEach(() => {
        result = parseTwinCatFile('test.tmc', TMC_SAMPLE)
    })

    it('detects file type', () => {
        expect(result.fileType).toBe('TMC')
    })

    it('parses one TcCOM object', () => {
        expect(result.objects).toHaveLength(1)
        expect(result.objects[0].name).toBe('CMyModule')
    })

    it('extracts module icon as data url', () => {
        expect(result.objects[0].iconDataUrl).toMatch(/^data:image\/bmp;base64,/)
    })

    it('groups symbols by ParameterInit, ParameterOnline, and DataArea', () => {
        const groupNames = result.objects[0].groups.map(g => g.name).sort()
        expect(groupNames).toEqual(['Inputs', 'ParameterInit', 'ParameterOnline'])
    })

    it('classifies group kinds correctly', () => {
        const byName = new Map(result.objects[0].groups.map(g => [g.name, g.kind]))
        expect(byName.get('ParameterInit')).toBe('ParameterInit')
        expect(byName.get('ParameterOnline')).toBe('ParameterOnline')
        expect(byName.get('Inputs')).toBe('DataArea')
    })

    it('reads CreateSymbol property and defaults to true when absent', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const speed = all.find(s => s.name === 'nMaxSpeed')!
        const hidden = all.find(s => s.name === 'fHidden')!
        const fAct = all.find(s => s.name === 'fActPos')!
        expect(speed.createSymbol).toBe(true)
        expect(hidden.createSymbol).toBe(false)
        expect(fAct.createSymbol).toBe(true) // no Properties → default true
    })

    it('maps Beckhoff base types to internal data types', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const speed = all.find(s => s.name === 'nMaxSpeed')!
        const fAct = all.find(s => s.name === 'fActPos')!
        const enable = all.find(s => s.name === 'bEnable')!
        expect(speed.dataType).toBe('UINT32')
        expect(fAct.dataType).toBe('REAL64')
        expect(enable.dataType).toBe('BIT')
    })

    it('resolves type aliases via DataTypes map', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const counter = all.find(s => s.name === 'nCounter')!
        // OTCID → UDINT → UINT32
        expect(counter.dataType).toBe('UINT32')
    })

    it('marks unsupported types with dataType=null', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const struct = all.find(s => s.name === 'stStruct')!
        expect(struct.dataType).toBeNull()
    })

    it('builds full path with owner name prefix', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const speed = all.find(s => s.name === 'nMaxSpeed')!
        expect(speed.fullPath).toBe('CMyModule.nMaxSpeed')
    })

    it('reports no warnings on a well-formed TMC', () => {
        expect(result.warnings).toHaveLength(0)
    })
})

describe('parseTwinCatFile (XTI with nested TreeItems)', () => {
    let result: ReturnType<typeof parseTwinCatFile>

    beforeEach(() => {
        result = parseTwinCatFile('test.xti', XTI_SAMPLE)
    })

    it('detects XTI', () => {
        expect(result.fileType).toBe('XTI')
    })

    it('parses parent and child instance', () => {
        expect(result.objects).toHaveLength(1)
        expect(result.objects[0].name).toBe('MyInstance')
        expect(result.objects[0].children).toHaveLength(1)
        expect(result.objects[0].children[0].name).toBe('Child1')
    })

    it('builds nested path including parent instance name', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const childIn = all.find(s => s.name === 'bChildIn')!
        expect(childIn.fullPath).toBe('MyInstance.Child1.bChildIn')
    })

    it('uses TreeItem name (not Module class name) as the instance name', () => {
        const all = Array.from(iterAllSymbols(result.objects))
        const out = all.find(s => s.name === 'nOut')!
        expect(out.ownerObjectName).toBe('MyInstance')
        expect(out.fullPath).toBe('MyInstance.nOut')
    })
})

describe('parseTwinCatFile error handling', () => {
    it('throws on malformed XML', () => {
        expect(() => parseTwinCatFile('bad.xti', '<not closed')).toThrow()
    })

    it('returns warnings when no modules are found', () => {
        const result = parseTwinCatFile('empty.tmc', '<?xml version="1.0"?><TcModuleClass></TcModuleClass>')
        expect(result.objects).toHaveLength(0)
        expect(result.warnings.length).toBeGreaterThan(0)
    })
})

describe('flattenObjects', () => {
    it('flattens nested objects into a single list, parents before children', () => {
        const result = parseTwinCatFile('test.xti', XTI_SAMPLE)
        const flat = flattenObjects(result.objects)
        expect(flat.map(o => o.name)).toEqual(['MyInstance', 'Child1'])
    })
})
