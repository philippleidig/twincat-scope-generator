import { describe, expect, it } from 'vitest'
import demoTmc from './demo/DemoMachine.tmc?raw'
import { importTwinCatFile } from './importFile'
import { MAX_CANDIDATES, buildIndex, channelCandidates, entryTemplate, parseTerms, search } from './search'
import { candidatesForEntry, candidatesForNode } from './candidates'
import { childrenOf, sourceChildren, MAX_ARRAY_CHILDREN, elementCount } from './tree'
import type { SymbolSource } from './model'

const [demo] = importTwinCatFile('DemoMachine.tmc', demoTmc)
const index = buildIndex([demo])
const paths = (text: string, extra = {}) => search(index, { text, ...extra }).entries.map((e) => e.path)

describe('buildIndex', () => {
    it('indexes array members once, as wildcard paths with ranges', () => {
        const e = index.entries.find((x) => x.path === 'GVL.aAxis[*].fActPos')!
        expect(e).toMatchObject({ kind: 'scalar', scopeType: 'REAL64', ranges: [{ lower: 1, upper: 4 }], area: 'internal', port: 851 })
        expect(entryTemplate(e)).toBe('GVL.aAxis[{i:1:4}].fActPos')
        expect(index.entries.some((x) => x.path.includes('aAxis[1]'))).toBe(false)
        expect(index.truncated).toBe(false)
    })
    it('never contains a path twice', () => {
        const keys = index.entries.map((e) => e.key)
        expect(new Set(keys).size).toBe(keys.length)
    })
})

describe('search', () => {
    it('matches every word anywhere in the path, case-insensitively', () => {
        expect(paths('axis actpos')).toEqual(['GVL.aAxis[*].fActPos'])
    })
    it('ranks exact and prefix name matches first', () => {
        expect(paths('fbConveyor')[0]).toBe('MAIN.fbConveyor')
    })
    it('supports wildcards', () => {
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
    it('parses an empty query to no terms', () => {
        expect(parseTerms('   ')).toEqual([])
    })
})

describe('candidates', () => {
    it('turns a struct array into one counter template per scalar member', () => {
        const aAxis = index.entries.find((e) => e.path === 'GVL.aAxis')!
        const { candidates, truncated } = candidatesForEntry(index, aAxis)
        expect(truncated).toBe(false)
        expect(candidates.map((c) => c.template)).toEqual([
            'GVL.aAxis[{i:1:4}].fSetPos',
            'GVL.aAxis[{i:1:4}].fActPos',
            'GVL.aAxis[{i:1:4}].fActVelo',
            'GVL.aAxis[{i:1:4}].bEnabled',
            'GVL.aAxis[{i:1:4}].eState',
            'GVL.aAxis[{i:1:4}].stDrive.fTorque',
            'GVL.aAxis[{i:1:4}].stDrive.nStatusWord',
            'GVL.aAxis[{i:1:4}].stDrive.nControlWord',
        ])
        expect(candidates[4].scopeType).toBe('INT16')
    })
    it('skips strings and pointers inside a struct', () => {
        const fb = index.entries.find((e) => e.path === 'MAIN.fbConveyor')!
        expect(candidatesForEntry(index, fb).candidates.map((c) => c.template)).not.toContain('MAIN.fbConveyor.sRecipe')
    })
    it('a scalar entry is its own candidate', () => {
        const e = index.entries.find((x) => x.path === 'MAIN.nCycle')!
        expect(candidatesForEntry(index, e).candidates).toEqual([{ template: 'MAIN.nCycle', scopeType: 'UINT32', port: 851 }])
    })
    it('caps very large structures', () => {
        const members = Array.from({ length: MAX_CANDIDATES + 5 }, (_, i) => ({ name: `m${i}`, type: 'INT' }))
        const big: SymbolSource = {
            ...demo,
            id: 'big',
            types: { BIG: { kind: 'struct', name: 'BIG', members } },
            roots: [{ name: 'X.big', type: 'BIG', area: 'internal', areaName: 'I' }],
        }
        const r = channelCandidates(big, { path: 'X.big', name: 'big', resolved: { kind: 'struct', typeName: 'BIG', members }, area: 'internal', port: 851 })
        expect(r.candidates).toHaveLength(MAX_CANDIDATES)
        expect(r.truncated).toBe(true)
    })
})

describe('tree', () => {
    const top = sourceChildren(demo)
    it('groups roots by their first segment', () => {
        expect(top.map((n) => [n.label, n.kind])).toEqual([
            ['GVL_IO', 'folder'],
            ['GVL', 'folder'],
            ['MAIN', 'folder'],
        ])
    })
    it('expands folders, structs and arrays lazily with concrete paths', () => {
        const gvl = childrenOf(demo, top[1])
        const aAxis = gvl.find((n) => n.label === 'aAxis')!
        expect(aAxis).toMatchObject({ kind: 'array', path: 'GVL.aAxis', typeName: 'ARRAY[1..4] OF ST_Axis' })
        const elements = childrenOf(demo, aAxis)
        expect(elements.map((n) => n.label)).toEqual(['[1]', '[2]', '[3]', '[4]'])
        const drive = childrenOf(demo, elements[2]).find((n) => n.label === 'stDrive')!
        expect(childrenOf(demo, drive).map((n) => n.path)).toEqual([
            'GVL.aAxis[3].stDrive.fTorque',
            'GVL.aAxis[3].stDrive.nStatusWord',
            'GVL.aAxis[3].stDrive.nControlWord',
        ])
        expect(candidatesForNode(demo, elements[2]).candidates[1]).toEqual({ template: 'GVL.aAxis[3].fActPos', scopeType: 'REAL64', port: 851 })
        expect(childrenOf(demo, drive.resolved ? { ...drive, kind: 'scalar', resolved: undefined } : drive)).toEqual([])
    })
    it('truncates huge arrays and enumerates multi-dimensional indices', () => {
        const node = {
            key: 'k', sourceId: demo.id, label: 'm', path: 'X.m', kind: 'array' as const, depth: 0, port: 851, area: 'internal' as const,
            resolved: { kind: 'array' as const, typeName: 'x', element: 'INT', dims: [{ lower: 0, length: 2 }, { lower: 1, length: 2 }] },
        }
        expect(childrenOf(demo, node).map((n) => n.label)).toEqual(['[0,1]', '[0,2]', '[1,1]', '[1,2]'])
        const huge = { ...node, resolved: { ...node.resolved, dims: [{ lower: 0, length: 5000 }] } }
        expect(childrenOf(demo, huge)).toHaveLength(MAX_ARRAY_CHILDREN)
        expect(elementCount(huge.resolved.dims)).toBe(5000)
    })
})
