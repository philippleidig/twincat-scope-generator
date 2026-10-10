import { describe, expect, it } from 'vitest'
import { parseTargetBrowserDrop } from './targetBrowserDrop'

const payload = (symbols: string, port = '852') => `<?xml version="1.0"?>
<TargetBrowserExportInfo>
  <TargetInfo><AmsAddress><NetId>5.1.2.3.1.1</NetId><Port>${port}</Port></AmsAddress></TargetInfo>
  <DataTypes>
    <DataType><Name>OTCID_ALIAS</Name><BaseType>OTCID</BaseType></DataType>
    <DataType><Name>T_Status</Name><BaseType>WORD</BaseType></DataType>
  </DataTypes>
  <Symbols>${symbols}</Symbols>
</TargetBrowserExportInfo>`

describe('parseTargetBrowserDrop', () => {
    it('reads symbols, resolves aliases and picks up port and Net ID', () => {
        const r = parseTargetBrowserDrop(
            payload(`<Symbol><Name>MAIN.fPos</Name><BaseType>LREAL</BaseType></Symbol>
                     <Symbol><Name>MAIN.nStatus</Name><BaseType>T_Status</BaseType></Symbol>
                     <Symbol><Name>MAIN.id</Name><BaseType>OTCID_ALIAS</BaseType></Symbol>`),
        )
        expect(r.symbols).toEqual([
            { symbol: 'MAIN.fPos', dataType: 'REAL64', port: 852, amsNetId: '5.1.2.3.1.1' },
            { symbol: 'MAIN.nStatus', dataType: 'UINT16', port: 852, amsNetId: '5.1.2.3.1.1' },
            { symbol: 'MAIN.id', dataType: 'UINT32', port: 852, amsNetId: '5.1.2.3.1.1' },
        ])
    })
    it('reports symbols that cannot be recorded', () => {
        const r = parseTargetBrowserDrop(payload('<Symbol><Name>MAIN.s</Name><BaseType>STRING(80)</BaseType></Symbol>'))
        expect(r).toEqual({ symbols: [], skipped: ['MAIN.s (STRING(80))'] })
    })
    it('falls back to port 851 and ignores text that is not XML', () => {
        expect(parseTargetBrowserDrop(payload('<Symbol><Name>A</Name><BaseType>BOOL</BaseType></Symbol>', 'x')).symbols[0].port).toBe(851)
        expect(parseTargetBrowserDrop('just text')).toEqual({ symbols: [], skipped: [] })
    })
})
