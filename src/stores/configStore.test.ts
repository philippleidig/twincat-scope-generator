import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'

describe('configStore', () => {
    beforeEach(() => {
        useConfigStore.getState().resetAll()
    })

    // Helper to get the first axis group's patterns
    const getFirstAxisGroup = () => useConfigStore.getState().scopeFiles[0].axisGroups[0]
    const getFirstPattern = () => getFirstAxisGroup().patterns[0]
    const getFirstSymbol = () => getFirstPattern().symbols[0]

    describe('initial state', () => {
        it('should have default global settings', () => {
            const { globalSettings } = useConfigStore.getState()

            expect(globalSettings.projectName).toBe('Scope Project')
            expect(globalSettings.amsNetId).toBe('127.0.0.1.1.1')
            expect(globalSettings.mainServer).toBe('127.0.0.1.1.1')
            expect(globalSettings.recordTime).toBe(6000000000)
            expect(globalSettings.baseSampleTime).toBe(100000)
            expect(globalSettings.defaultTargetPort).toBe(851)
        })

        it('should have one default scope file with one axis group', () => {
            const { scopeFiles } = useConfigStore.getState()

            expect(scopeFiles).toHaveLength(1)
            expect(scopeFiles[0].name).toBe('Scope_1')
            expect(scopeFiles[0].axisGroups).toHaveLength(1)
            expect(scopeFiles[0].axisGroups[0].name).toBe('Axis Group 1')
            expect(scopeFiles[0].axisGroups[0].patterns).toHaveLength(1)
            expect(scopeFiles[0].axisGroups[0].patterns[0].symbols).toHaveLength(1)
        })

        it('should have default symbol with REAL64 data type', () => {
            const symbol = getFirstSymbol()

            expect(symbol.template).toBe('')
            expect(symbol.dataType).toBe('REAL64')
            expect(symbol.variableSize).toBe(8)
        })
    })

    describe('global settings actions', () => {
        it('should update global settings partially', () => {
            useConfigStore.getState().updateGlobalSettings({ projectName: 'New Project' })

            const { globalSettings } = useConfigStore.getState()
            expect(globalSettings.projectName).toBe('New Project')
            expect(globalSettings.amsNetId).toBe('127.0.0.1.1.1') // unchanged
        })

        it('should update multiple global settings at once', () => {
            useConfigStore.getState().updateGlobalSettings({
                projectName: 'Test Project',
                baseSampleTime: 50000,
            })

            const { globalSettings } = useConfigStore.getState()
            expect(globalSettings.projectName).toBe('Test Project')
            expect(globalSettings.baseSampleTime).toBe(50000)
        })

        it('should reset global settings to defaults', () => {
            useConfigStore.getState().updateGlobalSettings({ projectName: 'Changed' })
            useConfigStore.getState().resetGlobalSettings()

            expect(useConfigStore.getState().globalSettings.projectName).toBe('Scope Project')
        })
    })

    describe('scope file actions', () => {
        it('should add a new scope file', () => {
            useConfigStore.getState().addScopeFile()

            const { scopeFiles } = useConfigStore.getState()
            expect(scopeFiles).toHaveLength(2)
            expect(scopeFiles[1].name).toBe('Scope_2')
        })

        it('should add scope file with default target port from global settings', () => {
            useConfigStore.getState().updateGlobalSettings({ defaultTargetPort: 852 })
            useConfigStore.getState().addScopeFile()

            const { scopeFiles } = useConfigStore.getState()
            expect(scopeFiles[1].axisGroups[0].patterns[0].targetPort).toBe(852)
        })

        it('should update scope file properties', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().updateScopeFile(fileId, { name: 'UpdatedName' })

            expect(useConfigStore.getState().scopeFiles[0].name).toBe('UpdatedName')
        })

        it('should remove scope file', () => {
            useConfigStore.getState().addScopeFile()
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().removeScopeFile(fileId)

            expect(useConfigStore.getState().scopeFiles).toHaveLength(1)
            expect(useConfigStore.getState().scopeFiles[0].name).toBe('Scope_2')
        })

        it('should duplicate scope file', () => {
            const { scopeFiles } = useConfigStore.getState()
            const fileId = scopeFiles[0].id

            useConfigStore.getState().updateScopeFile(fileId, { name: 'Original' })

            useConfigStore.getState().duplicateScopeFile(fileId)

            const newScopeFiles = useConfigStore.getState().scopeFiles
            expect(newScopeFiles).toHaveLength(2)
            expect(newScopeFiles[1].name).toBe('Original_copy')
            expect(newScopeFiles[1].id).not.toBe(fileId)
            expect(newScopeFiles[1].axisGroups).toHaveLength(1)
            expect(newScopeFiles[1].axisGroups[0].name).toBe('Axis Group 1')
        })

        it('should insert duplicated file after original', () => {
            useConfigStore.getState().addScopeFile()
            useConfigStore.getState().addScopeFile()

            const secondFileId = useConfigStore.getState().scopeFiles[1].id
            useConfigStore.getState().duplicateScopeFile(secondFileId)

            const names = useConfigStore.getState().scopeFiles.map(f => f.name)
            expect(names).toEqual(['Scope_1', 'Scope_2', 'Scope_2_copy', 'Scope_3'])
        })

        it('should not duplicate non-existent file', () => {
            useConfigStore.getState().duplicateScopeFile('non-existent-id')

            expect(useConfigStore.getState().scopeFiles).toHaveLength(1)
        })
    })

    describe('axis group actions', () => {
        it('should add axis group to file', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().addAxisGroup(fileId)

            expect(useConfigStore.getState().scopeFiles[0].axisGroups).toHaveLength(2)
            expect(useConfigStore.getState().scopeFiles[0].axisGroups[1].name).toBe('Axis Group 2')
        })

        it('should add axis group with default target port', () => {
            useConfigStore.getState().updateGlobalSettings({ defaultTargetPort: 853 })
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().addAxisGroup(fileId)

            expect(useConfigStore.getState().scopeFiles[0].axisGroups[1].patterns[0].targetPort).toBe(853)
        })

        it('should remove axis group', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().addAxisGroup(fileId)

            const agId = useConfigStore.getState().scopeFiles[0].axisGroups[0].id
            useConfigStore.getState().removeAxisGroup(fileId, agId)

            expect(useConfigStore.getState().scopeFiles[0].axisGroups).toHaveLength(1)
        })

        it('should update axis group name', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id

            useConfigStore.getState().updateAxisGroup(fileId, agId, { name: 'Positions' })

            expect(getFirstAxisGroup().name).toBe('Positions')
        })

        it('should duplicate axis group', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id

            useConfigStore.getState().updateAxisGroup(fileId, agId, { name: 'Original AG' })
            useConfigStore.getState().duplicateAxisGroup(fileId, agId)

            const axisGroups = useConfigStore.getState().scopeFiles[0].axisGroups
            expect(axisGroups).toHaveLength(2)
            expect(axisGroups[1].name).toBe('Original AG (copy)')
            expect(axisGroups[1].id).not.toBe(agId)
        })
    })

    describe('pattern actions', () => {
        it('should add pattern to axis group', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            useConfigStore.getState().addPattern(fileId, agId)

            expect(getFirstAxisGroup().patterns).toHaveLength(2)
        })

        it('should add pattern with default target port', () => {
            useConfigStore.getState().updateGlobalSettings({ defaultTargetPort: 853 })
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            useConfigStore.getState().addPattern(fileId, agId)

            expect(getFirstAxisGroup().patterns[1].targetPort).toBe(853)
        })

        it('should remove pattern from axis group', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            useConfigStore.getState().addPattern(fileId, agId)

            const patternId = getFirstAxisGroup().patterns[0].id
            useConfigStore.getState().removePattern(fileId, agId, patternId)

            expect(getFirstAxisGroup().patterns).toHaveLength(1)
        })

        it('should duplicate pattern', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            const patternId = getFirstPattern().id

            useConfigStore.getState().updatePatternPort(fileId, agId, patternId, 999)

            useConfigStore.getState().duplicatePattern(fileId, agId, patternId)

            const patterns = getFirstAxisGroup().patterns
            expect(patterns).toHaveLength(2)
            expect(patterns[1].targetPort).toBe(999)
            expect(patterns[1].id).not.toBe(patternId)
        })

        it('should update pattern port', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            const patternId = getFirstPattern().id

            useConfigStore.getState().updatePatternPort(fileId, agId, patternId, 852)

            expect(getFirstPattern().targetPort).toBe(852)
        })
    })

    describe('symbol actions', () => {
        it('should add symbol to pattern', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            const patternId = getFirstPattern().id

            useConfigStore.getState().addSymbol(fileId, agId, patternId)

            expect(getFirstPattern().symbols).toHaveLength(2)
        })

        it('should update symbol template', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            const patternId = getFirstPattern().id
            const symbolId = getFirstSymbol().id

            useConfigStore.getState().updateSymbol(fileId, agId, patternId, symbolId, {
                template: 'MAIN.value[{n:1:5}]'
            })

            expect(getFirstSymbol().template).toBe('MAIN.value[{n:1:5}]')
        })

        it('should update symbol data type and auto-calculate variable size', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            const patternId = getFirstPattern().id
            const symbolId = getFirstSymbol().id

            useConfigStore.getState().updateSymbol(fileId, agId, patternId, symbolId, {
                dataType: 'INT32'
            })

            const symbol = getFirstSymbol()
            expect(symbol.dataType).toBe('INT32')
            expect(symbol.variableSize).toBe(4)
        })

        it('should not auto-calculate variable size if explicitly provided', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            const patternId = getFirstPattern().id
            const symbolId = getFirstSymbol().id

            useConfigStore.getState().updateSymbol(fileId, agId, patternId, symbolId, {
                dataType: 'INT32',
                variableSize: 99
            })

            expect(getFirstSymbol().variableSize).toBe(99)
        })

        it('should remove symbol from pattern', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            const patternId = getFirstPattern().id
            useConfigStore.getState().addSymbol(fileId, agId, patternId)

            const symbolId = getFirstPattern().symbols[0].id
            useConfigStore.getState().removeSymbol(fileId, agId, patternId, symbolId)

            expect(getFirstPattern().symbols).toHaveLength(1)
        })
    })

    describe('resetAll', () => {
        it('should reset all state to defaults', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            useConfigStore.getState().updateGlobalSettings({ projectName: 'Changed' })
            useConfigStore.getState().addScopeFile()
            useConfigStore.getState().addPattern(fileId, agId)

            useConfigStore.getState().resetAll()

            const state = useConfigStore.getState()
            expect(state.globalSettings.projectName).toBe('Scope Project')
            expect(state.scopeFiles).toHaveLength(1)
            expect(state.scopeFiles[0].name).toBe('Scope_1')
            expect(state.scopeFiles[0].axisGroups).toHaveLength(1)
            expect(state.scopeFiles[0].axisGroups[0].patterns).toHaveLength(1)
        })
    })

    describe('edge cases', () => {
        it('should handle updating non-existent file', () => {
            useConfigStore.getState().updateScopeFile('non-existent', { name: 'Test' })

            expect(useConfigStore.getState().scopeFiles[0].name).toBe('Scope_1')
        })

        it('should handle removing non-existent file', () => {
            useConfigStore.getState().removeScopeFile('non-existent')

            expect(useConfigStore.getState().scopeFiles).toHaveLength(1)
        })

        it('should handle adding pattern to non-existent axis group', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().addPattern(fileId, 'non-existent')

            expect(getFirstAxisGroup().patterns).toHaveLength(1)
        })

        it('should handle duplicate pattern in non-existent axis group', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().duplicatePattern(fileId, 'non-existent', 'pattern-id')

            expect(getFirstAxisGroup().patterns).toHaveLength(1)
        })

        it('should handle duplicate non-existent pattern', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            useConfigStore.getState().duplicatePattern(fileId, agId, 'non-existent')

            expect(getFirstAxisGroup().patterns).toHaveLength(1)
        })

        it('should preserve other patterns when adding symbol', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            useConfigStore.getState().addPattern(fileId, agId)

            const patternId = getFirstAxisGroup().patterns[0].id
            useConfigStore.getState().addSymbol(fileId, agId, patternId)

            // Second pattern should be unchanged
            expect(getFirstAxisGroup().patterns[1].symbols).toHaveLength(1)
        })
    })

    describe('addSymbolsToAxisGroup (bulk import)', () => {
        it('appends one pattern per imported symbol with correct data types and ports', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const agId = getFirstAxisGroup().id
            const initialPatternCount = getFirstAxisGroup().patterns.length

            useConfigStore.getState().addSymbolsToAxisGroup(fileId, agId, [
                { template: 'CMyModule.bEnable', dataType: 'BIT', targetPort: 851 },
                { template: 'CMyModule.fActPos', dataType: 'REAL64', targetPort: 351 },
                { template: 'CMyModule.nMaxSpeed', dataType: 'UINT32', targetPort: 851 },
            ])

            const patterns = getFirstAxisGroup().patterns
            expect(patterns).toHaveLength(initialPatternCount + 3)

            const added = patterns.slice(initialPatternCount)
            expect(added.map(p => p.symbols[0].template)).toEqual([
                'CMyModule.bEnable',
                'CMyModule.fActPos',
                'CMyModule.nMaxSpeed',
            ])
            expect(added.map(p => p.symbols[0].dataType)).toEqual(['BIT', 'REAL64', 'UINT32'])
            expect(added.map(p => p.symbols[0].variableSize)).toEqual([1, 8, 4])
            expect(added.map(p => p.targetPort)).toEqual([851, 351, 851])
        })

        it('does nothing for an unknown axis group id', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const before = getFirstAxisGroup().patterns.length
            useConfigStore.getState().addSymbolsToAxisGroup(fileId, 'no-such-id', [
                { template: 'X', dataType: 'BIT', targetPort: 851 },
            ])
            expect(getFirstAxisGroup().patterns).toHaveLength(before)
        })
    })
})
