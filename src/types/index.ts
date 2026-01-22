// Counter definition for pattern expansion
export interface Counter {
    name: string
    start: number
    end: number
}

// Extracted counter from pattern template
export interface ParsedCounter extends Counter {
    placeholder: string // The full placeholder string e.g., "{n:1:10}"
}

// Symbol template with counters
export interface SymbolTemplate {
    id: string
    template: string // e.g., "App.mover[{n:1:5}].data"
    dataType: DataType
    variableSize: number
}

// Available data types for AdsAcquisition
export type DataType =
    | 'BIT'
    | 'INT8'
    | 'INT16'
    | 'INT32'
    | 'INT64'
    | 'UINT8'
    | 'UINT16'
    | 'UINT32'
    | 'UINT64'
    | 'REAL32'
    | 'REAL64'

// Data type to variable size mapping
export const DATA_TYPE_SIZES: Record<DataType, number> = {
    BIT: 1,
    INT8: 1,
    INT16: 2,
    INT32: 4,
    INT64: 8,
    UINT8: 1,
    UINT16: 2,
    UINT32: 4,
    UINT64: 8,
    REAL32: 4,
    REAL64: 8,
}

// Pattern containing multiple symbol templates (assigned to a ScopeFile)
export interface Pattern {
    id: string
    symbols: SymbolTemplate[]
    targetPort: number
}

// A tcscopex file containing multiple patterns
export interface ScopeFile {
    id: string
    name: string // User-defined file name (without extension)
    patterns: Pattern[]
}

// Generated AdsAcquisition
export interface AdsAcquisition {
    guid: string
    name: string
    symbolName: string
    amsNetId: string
    targetPort: number
    dataType: DataType
    variableSize: number
    baseSampleTime: number
    enabled: boolean
}

// Global project settings
export interface GlobalSettings {
    projectName: string
    amsNetId: string
    mainServer: string
    recordTime: number
    baseSampleTime: number
    defaultTargetPort: number
}

// Complete application state
export interface AppState {
    globalSettings: GlobalSettings
    scopeFiles: ScopeFile[]
}

// Generated tcscopex file content
export interface GeneratedFile {
    fileName: string
    content: string
    acquisitionCount: number
}

// Complete generation result
export interface GenerationResult {
    tcscopexFiles: GeneratedFile[]
    tcmprojContent: string
    tcmprojFileName: string
}

// Default settings
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
    projectName: 'Scope Project',
    amsNetId: '127.0.0.1.1.1',
    mainServer: '127.0.0.1.1.1',
    recordTime: 6000000000, // 600 seconds in 100ns units
    baseSampleTime: 100000, // 10ms in 100ns units
    defaultTargetPort: 851,
}

// Sample pattern for reference
export interface Sample {
    id: string
    template: string
    description: string
}

// Default sample patterns (used for initial state and reset)
export const DEFAULT_SAMPLES: Sample[] = [
    {
        id: 'default-1',
        template: 'MAIN.mover[{i:1:5}].position',
        description: 'Simple mover position (5 movers)',
    },
    {
        id: 'default-2',
        template: 'MAIN.mover[{i:1:3}].stMoverRef.NcToPlc.SetVelo',
        description: 'Mover velocity setpoint',
    },
    {
        id: 'default-3',
        template: 'Mover Axis {i:1:10}.SoftDrive {i:1:10}.SdScopeVariable.ActPos',
        description: 'NC axis actual position',
    },
    {
        id: 'default-4',
        template: 'GVL.station[{s:1:4}].sensor[{n:1:8}].value',
        description: 'Multi-level: 4 stations x 8 sensors',
    },
    {
        id: 'default-5',
        template: 'MAIN.mover[{i:1:3}].stMoverRef.NcToPlc[{j:1:3}]',
        description: 'Nested counters example',
    },
]

// Legacy export for backwards compatibility
export const EXAMPLE_PATTERNS = DEFAULT_SAMPLES
