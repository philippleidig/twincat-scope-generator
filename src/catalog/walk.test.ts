import { describe, expect, it } from 'vitest'
import demoTmc from './demo/DemoMachine.tmc?raw'
import { importTwinCatFile } from './importFile'
import { MAX_CANDIDATES, candidatesAt } from './candidates'
import { resolvePath } from './walk'
import type { SymbolSource } from './model'

const [demo] = importTwinCatFile('DemoMachine.tmc', demoTmc)
const symbols = (path: string) => candidatesAt(demo, path).specs.map((s) => s.symbol)

describe('resolvePath', () => {
    it('finds roots, members and concrete or wildcard elements, case-insensitively', () => {
        expect(resolvePath(demo, 'GVL.aAxis')?.resolved.kind).toBe('array')
        expect(resolvePath(demo, 'gvl.aaxis[2].stdrive.ftorque')).toMatchObject({ path: 'GVL.aAxis[2].stDrive.fTorque', ranges: [] })
        expect(resolvePath(demo, 'GVL.aAxis[*].fActPos')).toMatchObject({ ranges: [{ lower: 1, upper: 4 }] })
        expect(resolvePath(demo, 'MAIN.fbConveyor.bBusy')?.resolved).toMatchObject({ kind: 'scalar', scopeType: 'BIT' })
    })
    it('rejects paths that do not exist', () => {
        expect(resolvePath(demo, 'MAIN.nope')).toBeNull()
        expect(resolvePath(demo, 'GVL.aAxis[9].fActPos')).toBeNull()
        expect(resolvePath(demo, 'GVL.aAxis[1,1]')).toBeNull()
        expect(resolvePath(demo, 'GVL.fCycleLoad.x')).toBeNull()
        expect(resolvePath(demo, 'GVL.fCycleLoad]')).toBeNull()
    })
    it('prefers the longest root when roots nest', () => {
        const nested: SymbolSource = {
            ...demo,
            roots: [
                { name: 'MAIN.fb', type: 'FB_Conveyor', area: 'internal', areaName: 'I' },
                { name: 'MAIN.fb.fSpeed', type: 'LREAL', area: 'input', areaName: 'In' },
            ],
        }
        expect(resolvePath(nested, 'MAIN.fb.fSpeed')?.area).toBe('input')
        expect(resolvePath(nested, 'MAIN.fb.bBusy')?.area).toBe('internal')
    })
})

describe('candidatesAt', () => {
    it('turns a struct array into one counter template per recordable member', () => {
        expect(symbols('GVL.aAxis')).toEqual([
            'GVL.aAxis[{i:1:4}].fSetPos',
            'GVL.aAxis[{i:1:4}].fActPos',
            'GVL.aAxis[{i:1:4}].fActVelo',
            'GVL.aAxis[{i:1:4}].bEnabled',
            'GVL.aAxis[{i:1:4}].eState',
            'GVL.aAxis[{i:1:4}].stDrive.fTorque',
            'GVL.aAxis[{i:1:4}].stDrive.nStatusWord',
            'GVL.aAxis[{i:1:4}].stDrive.nControlWord',
        ])
        expect(candidatesAt(demo, 'GVL.aAxis').specs[4]).toMatchObject({ dataType: 'INT16', port: 851 })
    })
    it('keeps concrete indices from the tree and wildcards from search', () => {
        expect(symbols('GVL.aAxis[3].stDrive')).toEqual(['GVL.aAxis[3].stDrive.fTorque', 'GVL.aAxis[3].stDrive.nStatusWord', 'GVL.aAxis[3].stDrive.nControlWord'])
        expect(symbols('MAIN.fbConveyor.aZoneTemp[*]')).toEqual(['MAIN.fbConveyor.aZoneTemp[{i:1:8}]'])
    })
    it('skips strings and hidden members of a function block', () => {
        expect(symbols('MAIN.fbConveyor')).toEqual([
            'MAIN.fbConveyor.bBusy',
            'MAIN.fbConveyor.nErrorId',
            'MAIN.fbConveyor.bStart',
            'MAIN.fbConveyor.fSpeed',
            'MAIN.fbConveyor.aZoneTemp[{i:1:8}]',
        ])
        expect(symbols('MAIN.sOperator')).toEqual([])
        expect(symbols('MAIN.unknown')).toEqual([])
    })
    it('carries the source Net ID', () => {
        expect(candidatesAt({ ...demo, amsNetId: '1.2.3.4.1.1' }, 'MAIN.nCycle').specs).toEqual([
            { symbol: 'MAIN.nCycle', dataType: 'UINT32', port: 851, amsNetId: '1.2.3.4.1.1' },
        ])
    })
    it('caps very large structures', () => {
        const members = Array.from({ length: MAX_CANDIDATES + 5 }, (_, i) => ({ name: `m${i}`, type: 'INT' }))
        const big: SymbolSource = { ...demo, types: { BIG: { kind: 'struct', name: 'BIG', members } }, roots: [{ name: 'X.big', type: 'BIG', area: 'internal', areaName: 'I' }] }
        const r = candidatesAt(big, 'X.big')
        expect(r.specs).toHaveLength(MAX_CANDIDATES)
        expect(r.truncated).toBe(true)
    })
})
