import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'

describe('configStore', () => {
    beforeEach(() => {
        useConfigStore.getState().resetAll()
    })

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

        it('should have one default scope file', () => {
            const { scopeFiles } = useConfigStore.getState()

            expect(scopeFiles).toHaveLength(1)
            expect(scopeFiles[0].name).toBe('Scope_1')
            expect(scopeFiles[0].patterns).toHaveLength(1)
            expect(scopeFiles[0].patterns[0].symbols).toHaveLength(1)
        })

        it('should have default symbol with REAL64 data type', () => {
            const { scopeFiles } = useConfigStore.getState()
            const symbol = scopeFiles[0].patterns[0].symbols[0]

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
            expect(scopeFiles[1].patterns[0].targetPort).toBe(852)
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

            // Set some values first
            useConfigStore.getState().updateScopeFile(fileId, { name: 'Original' })

            useConfigStore.getState().duplicateScopeFile(fileId)

            const newScopeFiles = useConfigStore.getState().scopeFiles
            expect(newScopeFiles).toHaveLength(2)
            expect(newScopeFiles[1].name).toBe('Original_copy')
            expect(newScopeFiles[1].id).not.toBe(fileId) // New ID
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

    describe('pattern actions', () => {
        it('should add pattern to file', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().addPattern(fileId)

            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(2)
        })

        it('should add pattern with default target port', () => {
            useConfigStore.getState().updateGlobalSettings({ defaultTargetPort: 853 })
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().addPattern(fileId)

            expect(useConfigStore.getState().scopeFiles[0].patterns[1].targetPort).toBe(853)
        })

        it('should remove pattern from file', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().addPattern(fileId)

            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            useConfigStore.getState().removePattern(fileId, patternId)

            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(1)
        })

        it('should duplicate pattern', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id

            // Set a custom port
            useConfigStore.getState().updatePatternPort(fileId, patternId, 999)

            useConfigStore.getState().duplicatePattern(fileId, patternId)

            const patterns = useConfigStore.getState().scopeFiles[0].patterns
            expect(patterns).toHaveLength(2)
            expect(patterns[1].targetPort).toBe(999)
            expect(patterns[1].id).not.toBe(patternId)
        })

        it('should update pattern port', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id

            useConfigStore.getState().updatePatternPort(fileId, patternId, 852)

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].targetPort).toBe(852)
        })
    })

    describe('symbol actions', () => {
        it('should add symbol to pattern', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id

            useConfigStore.getState().addSymbol(fileId, patternId)

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols).toHaveLength(2)
        })

        it('should update symbol template', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                template: 'MAIN.value[{n:1:5}]'
            })

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].template).toBe('MAIN.value[{n:1:5}]')
        })

        it('should update symbol data type and auto-calculate variable size', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                dataType: 'INT32'
            })

            const symbol = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0]
            expect(symbol.dataType).toBe('INT32')
            expect(symbol.variableSize).toBe(4)
        })

        it('should not auto-calculate variable size if explicitly provided', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                dataType: 'INT32',
                variableSize: 99 // Custom size
            })

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].variableSize).toBe(99)
        })

        it('should remove symbol from pattern', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            useConfigStore.getState().addSymbol(fileId, patternId)

            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id
            useConfigStore.getState().removeSymbol(fileId, patternId, symbolId)

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols).toHaveLength(1)
        })
    })

    describe('resetAll', () => {
        it('should reset all state to defaults', () => {
            // Make various changes
            useConfigStore.getState().updateGlobalSettings({ projectName: 'Changed' })
            useConfigStore.getState().addScopeFile()
            useConfigStore.getState().addPattern(useConfigStore.getState().scopeFiles[0].id)

            // Reset
            useConfigStore.getState().resetAll()

            const state = useConfigStore.getState()
            expect(state.globalSettings.projectName).toBe('Scope Project')
            expect(state.scopeFiles).toHaveLength(1)
            expect(state.scopeFiles[0].name).toBe('Scope_1')
            expect(state.scopeFiles[0].patterns).toHaveLength(1)
        })
    })

    describe('edge cases', () => {
        it('should handle updating non-existent file', () => {
            useConfigStore.getState().updateScopeFile('non-existent', { name: 'Test' })

            // Should not throw, state unchanged
            expect(useConfigStore.getState().scopeFiles[0].name).toBe('Scope_1')
        })

        it('should handle removing non-existent file', () => {
            useConfigStore.getState().removeScopeFile('non-existent')

            expect(useConfigStore.getState().scopeFiles).toHaveLength(1)
        })

        it('should handle adding pattern to non-existent file', () => {
            useConfigStore.getState().addPattern('non-existent')

            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(1)
        })

        it('should handle duplicate pattern in non-existent file', () => {
            useConfigStore.getState().duplicatePattern('non-existent', 'pattern-id')

            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(1)
        })

        it('should handle duplicate non-existent pattern', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().duplicatePattern(fileId, 'non-existent')

            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(1)
        })

        it('should preserve other patterns when adding symbol', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            useConfigStore.getState().addPattern(fileId)

            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            useConfigStore.getState().addSymbol(fileId, patternId)

            // Second pattern should be unchanged
            expect(useConfigStore.getState().scopeFiles[0].patterns[1].symbols).toHaveLength(1)
        })
    })
})
