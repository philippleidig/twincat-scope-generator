import { describe, it, expect } from 'vitest'
import {
    generateAcquisitionsFromPattern,
    generateTcscopexXml,
    generateTcmprojXml,
    generateAllFiles,
    getVariableSizeForDataType,
} from '@/lib/xml'
import type { Pattern, GlobalSettings, ScopeFile } from '@/types'

describe('XML Generator', () => {
    const mockGlobalSettings: GlobalSettings = {
        projectName: 'Test Project',
        amsNetId: '127.0.0.1.1.1',
        mainServer: '127.0.0.1.1.1',
        recordTime: 6000000000,
        baseSampleTime: 100000,
        defaultTargetPort: 852,
    }

    describe('getVariableSizeForDataType', () => {
        it('should return correct size for REAL64', () => {
            expect(getVariableSizeForDataType('REAL64')).toBe(8)
        })

        it('should return correct size for REAL32', () => {
            expect(getVariableSizeForDataType('REAL32')).toBe(4)
        })

        it('should return correct size for INT64', () => {
            expect(getVariableSizeForDataType('INT64')).toBe(8)
        })

        it('should return correct size for INT32', () => {
            expect(getVariableSizeForDataType('INT32')).toBe(4)
        })

        it('should return correct size for INT16', () => {
            expect(getVariableSizeForDataType('INT16')).toBe(2)
        })

        it('should return correct size for INT8', () => {
            expect(getVariableSizeForDataType('INT8')).toBe(1)
        })

        it('should return correct size for UINT64', () => {
            expect(getVariableSizeForDataType('UINT64')).toBe(8)
        })

        it('should return correct size for UINT32', () => {
            expect(getVariableSizeForDataType('UINT32')).toBe(4)
        })

        it('should return correct size for UINT16', () => {
            expect(getVariableSizeForDataType('UINT16')).toBe(2)
        })

        it('should return correct size for UINT8', () => {
            expect(getVariableSizeForDataType('UINT8')).toBe(1)
        })

        it('should return correct size for BIT', () => {
            expect(getVariableSizeForDataType('BIT')).toBe(1)
        })
    })

    describe('generateAcquisitionsFromPattern', () => {
        it('should generate acquisitions from pattern with counter', () => {
            const pattern: Pattern = {
                id: 'test-pattern',
                targetPort: 852,
                symbols: [
                    {
                        id: 'sym1',
                        template: 'MAIN.mover[{n:1:3}].value',
                        dataType: 'REAL64',
                        variableSize: 8,
                    },
                ],
            }

            const acquisitions = generateAcquisitionsFromPattern(pattern, mockGlobalSettings)

            expect(acquisitions).toHaveLength(3)
            expect(acquisitions[0].symbolName).toBe('MAIN.mover[1].value')
            expect(acquisitions[1].symbolName).toBe('MAIN.mover[2].value')
            expect(acquisitions[2].symbolName).toBe('MAIN.mover[3].value')
        })

        it('should set correct properties on acquisitions', () => {
            const pattern: Pattern = {
                id: 'test-pattern',
                targetPort: 352,
                symbols: [
                    {
                        id: 'sym1',
                        template: 'Axis.Position',
                        dataType: 'REAL32',
                        variableSize: 4,
                    },
                ],
            }

            const acquisitions = generateAcquisitionsFromPattern(pattern, mockGlobalSettings)

            expect(acquisitions[0].targetPort).toBe(352)
            expect(acquisitions[0].dataType).toBe('REAL32')
            expect(acquisitions[0].variableSize).toBe(4)
            expect(acquisitions[0].amsNetId).toBe('127.0.0.1.1.1')
            expect(acquisitions[0].baseSampleTime).toBe(100000)
        })

        it('should generate unique GUIDs for each acquisition', () => {
            const pattern: Pattern = {
                id: 'test-pattern',
                targetPort: 852,
                symbols: [
                    {
                        id: 'sym1',
                        template: 'MAIN.item[{n:1:5}]',
                        dataType: 'INT32',
                        variableSize: 4,
                    },
                ],
            }

            const acquisitions = generateAcquisitionsFromPattern(pattern, mockGlobalSettings)
            const guids = acquisitions.map((a) => a.guid)
            const uniqueGuids = new Set(guids)

            expect(uniqueGuids.size).toBe(5)
        })

        it('should skip empty templates', () => {
            const pattern: Pattern = {
                id: 'test-pattern',
                targetPort: 852,
                symbols: [
                    {
                        id: 'sym1',
                        template: '',
                        dataType: 'REAL64',
                        variableSize: 8,
                    },
                ],
            }

            const acquisitions = generateAcquisitionsFromPattern(pattern, mockGlobalSettings)
            expect(acquisitions).toHaveLength(0)
        })
    })

    describe('generateTcscopexXml', () => {
        it('should generate valid XML structure', () => {
            const xml = generateTcscopexXml(mockGlobalSettings, [])

            expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>')
            expect(xml).toContain('<ScopeProject AssemblyName="TwinCAT.Measurement.Scope.API.Model">')
            expect(xml).toContain('<DataPool AssemblyName="TwinCAT.Measurement.Scope.API.Model">')
            expect(xml).toContain('</ScopeProject>')
        })

        it('should include project settings', () => {
            const xml = generateTcscopexXml(mockGlobalSettings, [])

            expect(xml).toContain('<Name>Test Project</Name>')
            expect(xml).toContain('<MainServer>127.0.0.1.1.1</MainServer>')
            expect(xml).toContain('<RecordTime>6000000000</RecordTime>')
        })

        it('should include AdsAcquisition elements', () => {
            const acquisitions = [
                {
                    guid: 'test-guid',
                    name: 'Test.Symbol',
                    symbolName: 'Test.Symbol',
                    amsNetId: '127.0.0.1.1.1',
                    targetPort: 852,
                    dataType: 'REAL64' as const,
                    variableSize: 8,
                    baseSampleTime: 100000,
                    enabled: true,
                },
            ]

            const xml = generateTcscopexXml(mockGlobalSettings, acquisitions)

            expect(xml).toContain('<AdsAcquisition AssemblyName="TwinCAT.Measurement.Scope.API.Model">')
            expect(xml).toContain('<SymbolName>Test.Symbol</SymbolName>')
            expect(xml).toContain('<TargetPort>852</TargetPort>')
            expect(xml).toContain('<DataType>REAL64</DataType>')
        })

        it('should escape special XML characters', () => {
            const settings = {
                ...mockGlobalSettings,
                projectName: 'Test <Project> & "Name"',
            }

            const xml = generateTcscopexXml(settings, [])

            expect(xml).toContain('Test &lt;Project&gt; &amp; &quot;Name&quot;')
        })
    })

    describe('generateTcmprojXml', () => {
        it('should generate valid MSBuild project structure', () => {
            const xml = generateTcmprojXml('MyProject', ['file1.tcscopex', 'file2.tcscopex'])

            expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>')
            expect(xml).toContain('<Project ToolsVersion="4.0"')
            expect(xml).toContain('xmlns="http://schemas.microsoft.com/developer/msbuild/2003"')
        })

        it('should include all files as Content items', () => {
            const xml = generateTcmprojXml('MyProject', ['Scope_1.tcscopex', 'Scope_2.tcscopex'])

            expect(xml).toContain('<Content Include="Scope_1.tcscopex">')
            expect(xml).toContain('<Content Include="Scope_2.tcscopex">')
        })

        it('should set project name', () => {
            const xml = generateTcmprojXml('My Scope Project', [])

            expect(xml).toContain('<Name>My Scope Project</Name>')
        })
    })

    describe('generateAllFiles', () => {
        it('should generate files from scope files', () => {
            const scopeFiles: ScopeFile[] = [
                {
                    id: '1',
                    name: 'Scope_1',
                    patterns: [
                        {
                            id: 'p1',
                            targetPort: 852,
                            symbols: [{ id: 's1', template: 'A.B', dataType: 'REAL64', variableSize: 8 }],
                        },
                    ],
                },
                {
                    id: '2',
                    name: 'Scope_2',
                    patterns: [
                        {
                            id: 'p2',
                            targetPort: 852,
                            symbols: [{ id: 's2', template: 'C.D', dataType: 'REAL64', variableSize: 8 }],
                        },
                    ],
                },
            ]

            const result = generateAllFiles(mockGlobalSettings, scopeFiles)

            expect(result.tcscopexFiles).toHaveLength(2)
            expect(result.tcscopexFiles[0].fileName).toBe('Scope_1.tcscopex')
            expect(result.tcscopexFiles[1].fileName).toBe('Scope_2.tcscopex')
        })

        it('should generate tcmproj with all file references', () => {
            const scopeFiles: ScopeFile[] = [
                {
                    id: '1',
                    name: 'Test',
                    patterns: [
                        {
                            id: 'p1',
                            targetPort: 852,
                            symbols: [{ id: 's1', template: 'A.B', dataType: 'REAL64', variableSize: 8 }],
                        },
                    ],
                },
            ]

            const result = generateAllFiles(mockGlobalSettings, scopeFiles)

            expect(result.tcmprojFileName).toBe('Test_Project.tcmproj')
            expect(result.tcmprojContent).toContain('Test.tcscopex')
        })

        it('should count acquisitions correctly per file', () => {
            const scopeFiles: ScopeFile[] = [
                {
                    id: '1',
                    name: 'Scope_1',
                    patterns: [
                        {
                            id: 'p1',
                            targetPort: 852,
                            symbols: [
                                { id: 's1', template: 'A[{n:1:5}]', dataType: 'REAL64', variableSize: 8 },
                            ],
                        },
                    ],
                },
            ]

            const result = generateAllFiles(mockGlobalSettings, scopeFiles)

            expect(result.tcscopexFiles[0].acquisitionCount).toBe(5)
        })

        it('should skip empty templates', () => {
            const scopeFiles: ScopeFile[] = [
                {
                    id: '1',
                    name: 'Scope_1',
                    patterns: [
                        {
                            id: 'p1',
                            targetPort: 852,
                            symbols: [
                                { id: 's1', template: '', dataType: 'REAL64', variableSize: 8 },
                            ],
                        },
                    ],
                },
            ]

            const result = generateAllFiles(mockGlobalSettings, scopeFiles)

            expect(result.tcscopexFiles).toHaveLength(0)
        })

        it('should handle multiple patterns with different target ports', () => {
            const scopeFiles: ScopeFile[] = [
                {
                    id: '1',
                    name: 'MultiPort',
                    patterns: [
                        {
                            id: 'p1',
                            targetPort: 851,
                            symbols: [{ id: 's1', template: 'PLC1.Var', dataType: 'REAL64', variableSize: 8 }],
                        },
                        {
                            id: 'p2',
                            targetPort: 852,
                            symbols: [{ id: 's2', template: 'PLC2.Var', dataType: 'INT32', variableSize: 4 }],
                        },
                    ],
                },
            ]

            const result = generateAllFiles(mockGlobalSettings, scopeFiles)

            expect(result.tcscopexFiles).toHaveLength(1)
            expect(result.tcscopexFiles[0].acquisitionCount).toBe(2)
            expect(result.tcscopexFiles[0].content).toContain('<TargetPort>851</TargetPort>')
            expect(result.tcscopexFiles[0].content).toContain('<TargetPort>852</TargetPort>')
        })

        it('should handle multiple symbols in one pattern', () => {
            const scopeFiles: ScopeFile[] = [
                {
                    id: '1',
                    name: 'MultiSymbol',
                    patterns: [
                        {
                            id: 'p1',
                            targetPort: 852,
                            symbols: [
                                { id: 's1', template: 'A.Position', dataType: 'REAL64', variableSize: 8 },
                                { id: 's2', template: 'A.Velocity', dataType: 'REAL64', variableSize: 8 },
                                { id: 's3', template: 'A.Torque', dataType: 'REAL32', variableSize: 4 },
                            ],
                        },
                    ],
                },
            ]

            const result = generateAllFiles(mockGlobalSettings, scopeFiles)

            expect(result.tcscopexFiles[0].acquisitionCount).toBe(3)
            expect(result.tcscopexFiles[0].content).toContain('<SymbolName>A.Position</SymbolName>')
            expect(result.tcscopexFiles[0].content).toContain('<SymbolName>A.Velocity</SymbolName>')
            expect(result.tcscopexFiles[0].content).toContain('<SymbolName>A.Torque</SymbolName>')
        })

        it('should skip files with empty patterns list', () => {
            const scopeFiles: ScopeFile[] = [
                {
                    id: '1',
                    name: 'EmptyPatterns',
                    patterns: [],
                },
            ]

            const result = generateAllFiles(mockGlobalSettings, scopeFiles)

            expect(result.tcscopexFiles).toHaveLength(0)
        })

        it('should generate correct tcmproj filename from project name with spaces', () => {
            const result = generateAllFiles(mockGlobalSettings, [
                {
                    id: '1',
                    name: 'Test',
                    patterns: [
                        {
                            id: 'p1',
                            targetPort: 852,
                            symbols: [{ id: 's1', template: 'A.B', dataType: 'REAL64', variableSize: 8 }],
                        },
                    ],
                },
            ])

            expect(result.tcmprojFileName).toBe('Test_Project.tcmproj')
        })
    })

    describe('XML escaping', () => {
        it('should escape ampersand in symbol names', () => {
            const pattern: Pattern = {
                id: 'test',
                targetPort: 852,
                symbols: [{ id: 's1', template: 'MAIN.data&value', dataType: 'REAL64', variableSize: 8 }],
            }

            const acquisitions = generateAcquisitionsFromPattern(pattern, mockGlobalSettings)
            const xml = generateTcscopexXml(mockGlobalSettings, acquisitions)

            expect(xml).toContain('MAIN.data&amp;value')
            expect(xml).not.toContain('MAIN.data&value')
        })

        it('should escape angle brackets in project name', () => {
            const settings = {
                ...mockGlobalSettings,
                projectName: 'Test <Project>',
            }

            const xml = generateTcscopexXml(settings, [])

            expect(xml).toContain('Test &lt;Project&gt;')
        })

        it('should escape quotes in project name', () => {
            const settings = {
                ...mockGlobalSettings,
                projectName: 'Test "Project"',
            }

            const xml = generateTcscopexXml(settings, [])

            expect(xml).toContain('Test &quot;Project&quot;')
        })
    })
})
