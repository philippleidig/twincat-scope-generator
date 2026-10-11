import { describe, expect, it } from 'vitest'
import demoTmc from './demo/DemoMachine.tmc?raw'
import { importTwinCatFile } from './importFile'
import { MAX_ENTRIES, buildIndex, parseTerms, search, templateOf } from './search'
import type { SymbolSource } from './model'
import { expectSortedByPath } from '@/test/sortedByPath'

const [demo] = importTwinCatFile('DemoMachine.tmc', demoTmc)
const index = buildIndex([demo])
const paths = (text: string, extra = {}) => search(index, { text, ...extra }).entries.map((e) => e.path)

describe('buildIndex', () => {
    it('indexes array members once, as wildcard paths with ranges', () => {
        const e = index.entries.find((x) => x.path === 'GVL.aAxis[*].fActPos')!
        expect(e).toMatchObject({ kind: 'scalar', scopeType: 'REAL64', ranges: [{ lower: 1, upper: 4 }], area: 'internal', port: 851 })
        expect(templateOf(e)).toBe('GVL.aAxis[{i:1:4}].fActPos')
        expect(index.entries.some((x) => x.path.includes('aAxis[1]'))).toBe(false)
        expect(index.truncated).toBe(false)
    })
    it('sorts entries by path', () => {
        expectSortedByPath(index.entries.map((e) => e.path))
    })
    it('never contains a path twice', () => {
        const keys = index.entries.map((e) => e.key)
        expect(new Set(keys).size).toBe(keys.length)
    })
    /** A source with `structs` roots of 600 INT members each (601 entries per root). */
    const bigSource = (id: string, structs: number): SymbolSource => ({
        ...demo,
        id,
        types: { BIG: { kind: 'struct', name: 'BIG', members: Array.from({ length: 600 }, (_, i) => ({ name: `m${i}`, type: 'INT' })) } },
        roots: Array.from({ length: structs }, (_, i) => ({ name: `X.b${i}`, type: 'BIG', area: 'internal' as const, areaName: 'I' })),
    })
    const small: SymbolSource = { ...demo, id: 'small' }
    const count = (r: { entries: Array<{ sourceId: string }> }, id: string) => r.entries.filter((e) => e.sourceId === id).length

    it('stops at MAX_ENTRIES and says so; a huge source does not starve a small one', () => {
        const huge = bigSource('huge', Math.ceil(MAX_ENTRIES / 600) + 1)
        const r = buildIndex([huge])
        expect(r.entries).toHaveLength(MAX_ENTRIES)
        expect(r.truncated).toBe(true)
        const both = buildIndex([huge, small])
        expect(count(both, 'small')).toBe(index.entries.length)
        expect(both.entries).toHaveLength(MAX_ENTRIES)
        expect(both.truncated).toBe(true)
    })
    it('cuts nothing while all sources together fit', () => {
        const big = bigSource('big', 250) // 150,250 entries
        const r = buildIndex([small, big])
        expect(count(r, 'big')).toBe(250 * 601)
        expect(count(r, 'small')).toBe(index.entries.length)
        expect(r.truncated).toBe(false)
    })
    it('follows each pointer declaration once per root, so mutually pointing FBs stay linear', () => {
        const names = Array.from({ length: 8 }, (_, i) => `FB_${i}`)
        const types = Object.fromEntries(
            names.map((n) => [
                n.toUpperCase(),
                { kind: 'struct' as const, name: n, members: [{ name: 'v', type: 'INT' }, ...names.filter((o) => o !== n).map((o) => ({ name: `p${o}`, type: `POINTER TO ${o}` }))] },
            ]),
        )
        const web: SymbolSource = { ...demo, types, roots: [{ name: 'MAIN.fb', type: 'FB_0', area: 'internal', areaName: 'I' }] }
        const r = buildIndex([web])
        // 56 pointer declarations, each followed once into an FB of 15 entries: linear, not 8! paths.
        expect(r.entries.length).toBeLessThan(56 * 16)
        // Chains of pointers cut by the depth limit are by design, not an incomplete index.
        expect(r.truncated).toBe(false)
        expect(r.entries.map((e) => e.path)).toContain('MAIN.fb.pFB_1^.v')
    })
})

describe('search', () => {
    it('matches every word anywhere in the path, case-insensitively', () => {
        expect(paths('axis actpos')).toEqual(['GVL.aAxis[*].fActPos'])
    })
    it('ranks exact and prefix name matches first', () => {
        expect(paths('fbConveyor')[0]).toBe('MAIN.fbConveyor')
    })
    it('treats words with * or ? as globs over the whole path', () => {
        expect(paths('MAIN.*Speed')).toEqual(['MAIN.fbConveyor.fSpeed'])
        expect(paths('GVL_IO.b????????')).toEqual(['GVL_IO.bHeaterOn'])
    })
    it('supports type:, area: and port: terms', () => {
        expect(paths('type:REAL32').sort()).toEqual(['GVL.aAxis[*].stDrive.fTorque', 'GVL.fCycleLoad', 'MAIN.fbConveyor.aZoneTemp[*]'])
        expect(paths('type:E_AxisState')).toEqual(['GVL.aAxis[*].eState', 'MAIN.eMachineState'])
        expect(paths('area:out')).toEqual(['GVL_IO.bHeaterOn', 'GVL_IO.nValvePosition'])
        expect(paths('port:852')).toEqual([])
    })
    it('filters by scope type, area, source and recordability', () => {
        expect(paths('', { scopeTypes: new Set(['BIT']), areas: new Set(['input']) })).toEqual(['GVL_IO.bEmergencyStop'])
        expect(paths('conveyor', { recordableOnly: true })).not.toContain('MAIN.fbConveyor')
        expect(paths('', { sourceIds: new Set(['other']) })).toEqual([])
    })
    it('reports the total beyond the limit', () => {
        const r = search(index, { text: '' }, 3)
        expect(r.entries).toHaveLength(3)
        expect(r.total).toBe(index.entries.length)
    })
    it('keeps path order instead of ranking on request', () => {
        const all = index.entries.map((e) => e.path)
        expect(paths('', { order: 'path' })).toEqual(all)
        expect(search(index, { text: '', order: 'path' }, 2).entries.map((e) => e.path)).toEqual(all.slice(0, 2))
        // A query narrows but does not re-rank.
        const state = paths('state', { order: 'path' })
        expect(state).toEqual(all.filter((p) => p.toLowerCase().includes('state')))
        expect(state).not.toEqual(paths('state'))
    })
    it('parses an empty query to no terms', () => {
        expect(parseTerms('   ')).toEqual([])
    })
})
