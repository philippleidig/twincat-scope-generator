import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
    AxisGroup,
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

    // Axis Group Actions (within a scope file)
    addAxisGroup: (fileId: string) => void
    removeAxisGroup: (fileId: string, axisGroupId: string) => void
    updateAxisGroup: (fileId: string, axisGroupId: string, updates: Partial<AxisGroup>) => void
    duplicateAxisGroup: (fileId: string, axisGroupId: string) => void

    // Pattern Actions (within an axis group)
    addPattern: (fileId: string, axisGroupId: string) => void
    removePattern: (fileId: string, axisGroupId: string, patternId: string) => void
    duplicatePattern: (fileId: string, axisGroupId: string, patternId: string) => void

    // Symbol Actions
    addSymbol: (fileId: string, axisGroupId: string, patternId: string) => void
    updateSymbol: (fileId: string, axisGroupId: string, patternId: string, symbolId: string, updates: Partial<SymbolTemplate>) => void
    removeSymbol: (fileId: string, axisGroupId: string, patternId: string, symbolId: string) => void
    updatePatternPort: (fileId: string, axisGroupId: string, patternId: string, targetPort: number) => void

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

const createDefaultAxisGroup = (name: string, targetPort: number = 851): AxisGroup => ({
    id: uuidv4(),
    name,
    patterns: [createDefaultPattern(targetPort)],
})

const createDefaultScopeFile = (name: string, targetPort: number = 851): ScopeFile => ({
    id: uuidv4(),
    name,
    axisGroups: [createDefaultAxisGroup('Axis Group 1', targetPort)],
})

const duplicatePatterns = (patterns: Pattern[]): Pattern[] =>
    patterns.map((p) => ({
        id: uuidv4(),
        targetPort: p.targetPort,
        symbols: p.symbols.map((s) => ({ ...s, id: uuidv4() })),
    }))

// Helper to map axis groups within a specific file
const mapAxisGroups = (
    scopeFiles: ScopeFile[],
    fileId: string,
    fn: (ag: AxisGroup) => AxisGroup
): ScopeFile[] =>
    scopeFiles.map((f) =>
        f.id === fileId
            ? { ...f, axisGroups: f.axisGroups.map(fn) }
            : f
    )

// Helper to map patterns within a specific axis group
const mapPatterns = (
    scopeFiles: ScopeFile[],
    fileId: string,
    axisGroupId: string,
    fn: (p: Pattern) => Pattern
): ScopeFile[] =>
    mapAxisGroups(scopeFiles, fileId, (ag) =>
        ag.id === axisGroupId
            ? { ...ag, patterns: ag.patterns.map(fn) }
            : ag
    )

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
                axisGroups: file.axisGroups.map((ag) => ({
                    id: uuidv4(),
                    name: ag.name,
                    patterns: duplicatePatterns(ag.patterns),
                })),
            }
            const newScopeFiles = [...state.scopeFiles]
            newScopeFiles.splice(fileIndex + 1, 0, duplicatedFile)
            return { scopeFiles: newScopeFiles }
        }),

    // Axis Group Actions
    addAxisGroup: (fileId) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === fileId
                    ? {
                        ...f,
                        axisGroups: [
                            ...f.axisGroups,
                            createDefaultAxisGroup(
                                `Axis Group ${f.axisGroups.length + 1}`,
                                state.globalSettings.defaultTargetPort
                            ),
                        ],
                    }
                    : f
            ),
        })),

    removeAxisGroup: (fileId, axisGroupId) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) =>
                f.id === fileId
                    ? { ...f, axisGroups: f.axisGroups.filter((ag) => ag.id !== axisGroupId) }
                    : f
            ),
        })),

    updateAxisGroup: (fileId, axisGroupId, updates) =>
        set((state) => ({
            scopeFiles: mapAxisGroups(state.scopeFiles, fileId, (ag) =>
                ag.id === axisGroupId ? { ...ag, ...updates } : ag
            ),
        })),

    duplicateAxisGroup: (fileId, axisGroupId) =>
        set((state) => ({
            scopeFiles: state.scopeFiles.map((f) => {
                if (f.id !== fileId) return f
                const agIndex = f.axisGroups.findIndex((ag) => ag.id === axisGroupId)
                if (agIndex === -1) return f
                const ag = f.axisGroups[agIndex]
                const duplicated: AxisGroup = {
                    id: uuidv4(),
                    name: `${ag.name} (copy)`,
                    patterns: duplicatePatterns(ag.patterns),
                }
                const newAxisGroups = [...f.axisGroups]
                newAxisGroups.splice(agIndex + 1, 0, duplicated)
                return { ...f, axisGroups: newAxisGroups }
            }),
        })),

    // Pattern Actions
    addPattern: (fileId, axisGroupId) =>
        set((state) => ({
            scopeFiles: mapAxisGroups(state.scopeFiles, fileId, (ag) =>
                ag.id === axisGroupId
                    ? { ...ag, patterns: [...ag.patterns, createDefaultPattern(state.globalSettings.defaultTargetPort)] }
                    : ag
            ),
        })),

    removePattern: (fileId, axisGroupId, patternId) =>
        set((state) => ({
            scopeFiles: mapAxisGroups(state.scopeFiles, fileId, (ag) =>
                ag.id === axisGroupId
                    ? { ...ag, patterns: ag.patterns.filter((p) => p.id !== patternId) }
                    : ag
            ),
        })),

    duplicatePattern: (fileId, axisGroupId, patternId) =>
        set((state) => ({
            scopeFiles: mapAxisGroups(state.scopeFiles, fileId, (ag) => {
                if (ag.id !== axisGroupId) return ag
                const patternIndex = ag.patterns.findIndex((p) => p.id === patternId)
                if (patternIndex === -1) return ag
                const pattern = ag.patterns[patternIndex]
                const duplicatedPattern: Pattern = {
                    id: uuidv4(),
                    targetPort: pattern.targetPort,
                    symbols: pattern.symbols.map((s) => ({ ...s, id: uuidv4() })),
                }
                const newPatterns = [...ag.patterns]
                newPatterns.splice(patternIndex + 1, 0, duplicatedPattern)
                return { ...ag, patterns: newPatterns }
            }),
        })),

    // Symbol Actions
    addSymbol: (fileId, axisGroupId, patternId) =>
        set((state) => ({
            scopeFiles: mapPatterns(state.scopeFiles, fileId, axisGroupId, (p) =>
                p.id === patternId
                    ? { ...p, symbols: [...p.symbols, createDefaultSymbol()] }
                    : p
            ),
        })),

    updateSymbol: (fileId, axisGroupId, patternId, symbolId, updates) =>
        set((state) => ({
            scopeFiles: mapPatterns(state.scopeFiles, fileId, axisGroupId, (p) =>
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
        })),

    removeSymbol: (fileId, axisGroupId, patternId, symbolId) =>
        set((state) => ({
            scopeFiles: mapPatterns(state.scopeFiles, fileId, axisGroupId, (p) =>
                p.id === patternId
                    ? { ...p, symbols: p.symbols.filter((s) => s.id !== symbolId) }
                    : p
            ),
        })),

    updatePatternPort: (fileId, axisGroupId, patternId, targetPort) =>
        set((state) => ({
            scopeFiles: mapPatterns(state.scopeFiles, fileId, axisGroupId, (p) =>
                p.id === patternId ? { ...p, targetPort } : p
            ),
        })),

    // Utility Actions
    resetAll: () =>
        set({
            globalSettings: { ...defaultGlobalSettings },
            scopeFiles: [createDefaultScopeFile('Scope_1')],
        }),
}))
