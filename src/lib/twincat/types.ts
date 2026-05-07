import type { DataType } from '@/types'

/**
 * Logical kind of a parsed symbol group.
 *
 * - DataArea: <DataArea> with AreaType "MArea" or other internal area, or unclassified
 * - InputArea / OutputArea: <DataArea> with AreaType InputDst / OutputSrc respectively
 * - Parameter: <Parameter> entry from the <Parameters> block (TMC). In the TwinCAT
 *   TcCOM data model, every <Parameter> is exposed as both an Init value (set on
 *   startup) and an Online value (read/write at runtime).
 * - InstanceVar: NC-axis-style <Var> entries inside <Vars VarGrpType="...">.
 * - Other: anything we couldn't classify confidently.
 */
export type SymbolGroupKind =
    | 'DataArea'
    | 'InputArea'
    | 'OutputArea'
    | 'Parameter'
    | 'InstanceVar'
    | 'Other'

export interface ParsedSymbol {
    id: string
    /** Leaf name of the symbol (e.g. "Value", "data1"). */
    name: string
    /** Raw type as found in the file (e.g. "UDINT", "LREAL", "ST_MyStruct"). */
    rawType: string
    /** Resolved scope DataType, or null if the type can't be scoped directly. */
    dataType: DataType | null
    /** CreateSymbol flag (default true unless explicitly false in <Properties>). */
    createSymbol: boolean
    /** Optional comment from the file. */
    comment?: string
    ownerObjectId: string
    ownerObjectName: string
    groupId: string
    groupName: string
    groupKind: SymbolGroupKind
    /** ADS-style symbol path: ownerObjectName(.intermediate).leafName */
    fullPath: string
    /** Suggested ADS port. Default 851 for PLC; 851 also works for most TcCOM via ADS. */
    suggestedPort: number
}

export interface ParsedSymbolGroup {
    id: string
    name: string
    kind: SymbolGroupKind
    iconDataUrl: string | null
    symbols: ParsedSymbol[]
}

export interface ParsedTcomObject {
    id: string
    name: string
    /** Module class name (e.g. "CMyModule"). May differ from `name` in XTI. */
    className: string | null
    iconDataUrl: string | null
    groups: ParsedSymbolGroup[]
    children: ParsedTcomObject[]
}

export interface ParseResult {
    fileName: string
    fileType: 'TMC' | 'XTI' | 'Unknown'
    /** Top-level TcCOM objects (Modules in TMC, TreeItems in XTI). */
    objects: ParsedTcomObject[]
    /** Non-fatal messages (e.g. "no scopable symbols found"). */
    warnings: string[]
}
