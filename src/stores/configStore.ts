import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
    GlobalSettings,
    Pattern,
    ScopeFile,
    SymbolTemplate,
} from '@/types'
import { getVariableSizeForDataType } from '@/lib/xml'

interface ConfigStore {
    // State
    globalSettings: GlobalSettings
    scopeFiles: ScopeFile[]

    // Global Settings Actions
    updateGlobalSettings: (settings: Partial<GlobalSettings>) => void
    resetGlobalSettings: () => void

    // Scope File Actions
    addScopeFile: () => void
    updateScopeFile: (id: string, updates: Partial<ScopeFile>) => void
    removeScopeFile: (id: string) => void
    duplicateScopeFile: (id: string) => void

    // Pattern Actions (within a scope file)
    addPattern: (fileId: string) => void
    removePattern: (fileId: string, patternId: string) => void
    duplicatePattern: (fileId: string, patternId: string) => void

    // Symbol Actions
    addSymbol: (fileId: string, patternId: string) => void
    updateSymbol: (fileId: string, patternId: string, symbolId: string, updates: Partial<SymbolTemplate>) => void
    removeSymbol: (fileId: string, patternId: string, symbolId: string) => void
    updatePatternPort: (fileId: string, patternId: string, targetPort: number) => void

    // Utility Actions
    resetAll: () => void
}

const defaultGlobalSettings: GlobalSettings = {
    projectName: 'Scope Project',
    amsNetId: '127.0.0.1.1.1',
    mainServer: '127.0.0.1.1.1',
    recordTime: 6000000000,
    baseSampleTime: 100000,
    defaultTargetPort: 851,
}

const createDefaultSymbol = (): SymbolTemplate => ({
    id: uuidv4(),
    template: '',
    dataType: 'REAL64',
    variableSize: 8,
})

const createDefaultPattern = (targetPort: number = 851): Pattern => ({
    id: uuidv4(),
    symbols: [createDefaultSymbol()],
    targetPort,
})

const createDefaultScopeFile = (name: string, targetPort: number = 851): ScopeFile => ({
    id: uuidv4(),
    name,
    patterns: [createDefaultPattern(targetPort)],
})

export const useConfigStore = create<ConfigStore>()((set) => ({
    // Initial State - start with one default file
    globalSettings: { ...defaultGlobalSettings },
    scopeFiles: [createDefaultScopeFile('Scope_1')],

    // Global Settings Actions
    updateGlobalSettings: (settings) =>
        set((state) => ({
            globalSettings: { ...state.globalSettings, ...settings },
        })),

    resetGlobalSettings: () =>
        set({ globalSettings: { ...defaultGlobalSettings } }),

    // Scope File Actions
    addScopeFile: () =>
        set((state) => ({
            scopeFiles: [
                ...state.scopeFiles,
                createDefaultScopeFile(`Scope_${state.scopeFiles.length + 1}`, state.globalSettings.defaultTargetPort),
            ],
        })),

    updateScopeFile: (id, updates) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === id ? { ...f, ...updates } : f
            ),
        })),

    removeScopeFile: (id) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.filter((f) => f.id !== id),
        })),

    duplicateScopeFile: (id) =>
        set((state) => {
            const fileIndex = state.scopeFiles.findIndex((f) => f.id === id)
            if (fileIndex === -1) return state
            const file = state.scopeFiles[fileIndex]
            const duplicatedFile: ScopeFile = {
                id: uuidv4(),
                name: `${file.name}_copy`,
                patterns: file.patterns.map((p) => ({
                    id: uuidv4(),
                    targetPort: p.targetPort,
                    symbols: p.symbols.map((s) => ({
                        ...s,
                        id: uuidv4(),
                    })),
                })),
            }
            const newScopeFiles = [...state.scopeFiles]
            newScopeFiles.splice(fileIndex + 1, 0, duplicatedFile)
            return { scopeFiles: newScopeFiles }
        }),

    // Pattern Actions
    addPattern: (fileId) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === fileId
                    ? { ...f, patterns: [...f.patterns, createDefaultPattern(state.globalSettings.defaultTargetPort)] }
                    : f
            ),
        })),

    removePattern: (fileId, patternId) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === fileId
                    ? { ...f, patterns: f.patterns.filter((p) => p.id !== patternId) }
                    : f
            ),
        })),

    duplicatePattern: (fileId, patternId) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) => {
                if (f.id !== fileId) return f
                const patternIndex = f.patterns.findIndex((p) => p.id === patternId)
                if (patternIndex === -1) return f
                const pattern = f.patterns[patternIndex]
                const duplicatedPattern: Pattern = {
                    id: uuidv4(),
                    targetPort: pattern.targetPort,
                    symbols: pattern.symbols.map((s) => ({
                        ...s,
                        id: uuidv4(),
                    })),
                }
                const newPatterns = [...f.patterns]
                newPatterns.splice(patternIndex + 1, 0, duplicatedPattern)
                return { ...f, patterns: newPatterns }
            }),
        })),

    // Symbol Actions
    addSymbol: (fileId, patternId) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === fileId
                    ? {
                        ...f,
                        patterns: f.patterns.map((p) =>
                            p.id === patternId
                                ? { ...p, symbols: [...p.symbols, createDefaultSymbol()] }
                                : p
                        ),
                    }
                    : f
            ),
        })),

    updateSymbol: (fileId, patternId, symbolId, updates) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === fileId
                    ? {
                        ...f,
                        patterns: f.patterns.map((p) =>
                            p.id === patternId
                                ? {
                                    ...p,
                                    symbols: p.symbols.map((s) => {
                                        if (s.id !== symbolId) return s
                                        const newSymbol = { ...s, ...updates }
                                        if (updates.dataType && !updates.variableSize) {
                                            newSymbol.variableSize = getVariableSizeForDataType(updates.dataType)
                                        }
                                        return newSymbol
                                    }),
                                }
                                : p
                        ),
                    }
                    : f
            ),
        })),

    removeSymbol: (fileId, patternId, symbolId) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === fileId
                    ? {
                        ...f,
                        patterns: f.patterns.map((p) =>
                            p.id === patternId
                                ? { ...p, symbols: p.symbols.filter((s) => s.id !== symbolId) }
                                : p
                        ),
                    }
                    : f
            ),
        })),

    updatePatternPort: (fileId, patternId, targetPort) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === fileId
                    ? {
                        ...f,
                        patterns: f.patterns.map((p) =>
                            p.id === patternId ? { ...p, targetPort } : p
                        ),
                    }
                    : f
            ),
        })),

    // Utility Actions
    resetAll: () =>
        set({
            globalSettings: { ...defaultGlobalSettings },
            scopeFiles: [createDefaultScopeFile('Scope_1')],
        }),
}))
