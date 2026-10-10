import { describe, expect, it } from 'vitest'
import demoTmc from './demo/DemoMachine.tmc?raw'
import { importTwinCatFile } from './importFile'
import type { BrowserNode } from './tree'
import { MAX_ARRAY_CHILDREN, cachedChildren, childrenOf, isExpandable, sourceChildren } from './tree'
import type { SymbolSource } from './model'

const [demo] = importTwinCatFile('DemoMachine.tmc', demoTmc)
const find = (nodes: BrowserNode[], label: string) => nodes.find((n) => n.label === label)!

describe('symbol tree', () => {
    const top = sourceChildren(demo)

    it('groups roots by their first segment', () => {
        expect(top.map((n) => [n.label, n.kind])).toEqual([
            ['GVL_IO', 'folder'],
            ['GVL', 'folder'],
            ['MAIN', 'folder'],
        ])
        expect(top.every(isExpandable)).toBe(true)
    })

    it('expands folders, structs and arrays lazily with concrete paths', () => {
        const aAxis = find(childrenOf(demo, find(top, 'GVL')), 'aAxis')
        expect(aAxis).toMatchObject({ kind: 'array', typeName: 'ARRAY[1..4] OF ST_Axis' })
        const elements = childrenOf(demo, aAxis)
        expect(elements.map((n) => n.label)).toEqual(['[1]', '[2]', '[3]', '[4]'])
        const drive = find(childrenOf(demo, elements[2]), 'stDrive')
        expect(childrenOf(demo, drive).map((n) => n.kind !== 'folder' && n.symbol.path)).toEqual([
            'GVL.aAxis[3].stDrive.fTorque',
            'GVL.aAxis[3].stDrive.nStatusWord',
            'GVL.aAxis[3].stDrive.nControlWord',
        ])
        const torque = childrenOf(demo, drive)[0]
        expect(isExpandable(torque)).toBe(false)
        expect(childrenOf(demo, torque)).toEqual([])
    })

    it('nests dotted root names and shows a root that has nested roots once', () => {
        const nc: SymbolSource = {
            ...demo,
            roots: [
                { name: 'Axes.Axis 1.ActPos', type: 'LREAL', area: 'internal', areaName: 'Axis state' },
                { name: 'Axes.Axis 1.ToPlc', type: 'ST_Drive', area: 'output', areaName: 'Outputs' },
                { name: 'Axes.Axis 1.ToPlc.fTorque', type: 'REAL', area: 'output', areaName: 'Outputs' },
                { name: 'Axes.Axis 2.ActPos', type: 'LREAL', area: 'internal', areaName: 'Axis state' },
            ],
        }
        const axes = sourceChildren(nc)
        expect(axes.map((n) => n.label)).toEqual(['Axes'])
        const axisList = childrenOf(nc, axes[0])
        expect(axisList.map((n) => n.label)).toEqual(['Axis 1', 'Axis 2'])
        expect(childrenOf(nc, axisList[0]).map((n) => [n.label, n.kind])).toEqual([
            ['ActPos', 'scalar'],
            ['ToPlc', 'struct'],
        ])
    })

    it('enumerates multi-dimensional indices and truncates huge arrays', () => {
        const grid: SymbolSource = {
            ...demo,
            roots: [
                { name: 'G.m', type: 'INT', dims: [{ lower: 0, upper: 1 }, { lower: 1, upper: 2 }], area: 'internal', areaName: 'I' },
                { name: 'G.huge', type: 'INT', dims: [{ lower: 0, upper: 4999 }], area: 'internal', areaName: 'I' },
            ],
        }
        const [m, huge] = childrenOf(grid, sourceChildren(grid)[0])
        expect(childrenOf(grid, m).map((n) => n.label)).toEqual(['[0,1]', '[0,2]', '[1,1]', '[1,2]'])
        expect(childrenOf(grid, huge)).toHaveLength(MAX_ARRAY_CHILDREN)
    })

    it('caches children per source and key', () => {
        let calls = 0
        const compute = () => (calls++, [])
        cachedChildren(demo, 'k', compute)
        cachedChildren(demo, 'k', compute)
        expect(calls).toBe(1)
    })
})
