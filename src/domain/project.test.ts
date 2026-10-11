import { describe, expect, it } from 'vitest'
import {
    LOCAL_TARGET_ID,
    acquisitionCount,
    allChannels,
    amsNetIdError,
    createProject,
    fileNameError,
    findAxisGroup,
    mergeChannelSpecs,
    nextName,
    ops,
    parseProject,
    projectIssues,
    sanitizeFileName,
    uniqueName,
} from './project'

const firstGroup = (p = createProject()) => p.scopeFiles[0].axisGroups[0]

function withChannels(symbols: string[]) {
    const p = createProject()
    return ops.addChannels(p, firstGroup(p).id, symbols.map((symbol) => ({ symbol })))
}

describe('createProject', () => {
    it('starts with one file, one axis group and the local target', () => {
        const p = createProject()
        expect(p.version).toBe(2)
        expect(p.scopeFiles).toHaveLength(1)
        expect(p.scopeFiles[0].name).toBe('Scope_1')
        expect(firstGroup(p).channels).toEqual([])
        expect(p.targets).toEqual([{ id: LOCAL_TARGET_ID, name: 'Local', amsNetId: '127.0.0.1.1.1' }])
    })
})

describe('names', () => {
    it('nextName skips taken names case-insensitively', () => {
        expect(nextName('Scope_', ['Scope_1', 'scope_2'])).toBe('Scope_3')
        expect(nextName('Scope_', ['Scope_2'])).toBe('Scope_1')
    })
    it('uniqueName appends a counter only when needed', () => {
        expect(uniqueName('A', [])).toBe('A')
        expect(uniqueName('A', ['a', 'A_2'])).toBe('A_3')
    })
    it('sanitizes file names', () => {
        expect(sanitizeFileName('../evil:name?.')).toBe('.._evil_name_')
        expect(sanitizeFileName('  ')).toBe('Scope')
    })
    it('validates file names', () => {
        expect(fileNameError('', [])).toBe('Name is required')
        expect(fileNameError('a/b', [])).toMatch(/not allowed/)
        expect(fileNameError('Scope_1', ['scope_1'])).toMatch(/Another/)
        expect(fileNameError('Scope_1', ['Scope_2'])).toBeNull()
    })
    it('validates AMS Net IDs', () => {
        expect(amsNetIdError('192.168.0.10.1.1')).toBeNull()
        expect(amsNetIdError('5.80.201.232.1.1')).toBeNull()
        expect(amsNetIdError('192.168.0.10')).toMatch(/Six numbers/)
        expect(amsNetIdError('300.1.1.1.1.1')).toMatch(/between 0 and 255/)
    })
})

describe('ops', () => {
    it('adds scope files with a free name (no duplicates after deleting)', () => {
        let p = ops.addScopeFile(createProject())
        p = ops.removeScopeFile(p, p.scopeFiles[0].id)
        p = ops.addScopeFile(p)
        expect(p.scopeFiles.map((f) => f.name)).toEqual(['Scope_2', 'Scope_1'])
    })

    it('duplicates a scope file with fresh ids and a unique name', () => {
        let p = withChannels(['MAIN.a'])
        const id = p.scopeFiles[0].id
        p = ops.duplicateScopeFile(p, id)
        p = ops.duplicateScopeFile(p, id)
        expect(p.scopeFiles.map((f) => f.name)).toEqual(['Scope_1', 'Scope_1_copy_2', 'Scope_1_copy'])
        const ids = allChannels(p).map((c) => c.id)
        expect(new Set(ids).size).toBe(3)
    })

    it('adds, updates, duplicates and removes channels by id', () => {
        let p = withChannels(['MAIN.a', 'MAIN.b'])
        const [a, b] = firstGroup(p).channels
        expect(a).toMatchObject({ symbol: 'MAIN.a', dataType: 'REAL64', port: 851, targetId: LOCAL_TARGET_ID })
        p = ops.updateChannel(p, a.id, { symbol: 'MAIN.c', dataType: 'BIT' })
        p = ops.duplicateChannel(p, b.id)
        p = ops.removeChannel(p, a.id)
        expect(firstGroup(p).channels.map((c) => c.symbol)).toEqual(['MAIN.b', 'MAIN.b'])
    })

    it('manages axis groups', () => {
        let p = createProject()
        const fileId = p.scopeFiles[0].id
        p = ops.addAxisGroup(p, fileId)
        const second = p.scopeFiles[0].axisGroups[1]
        expect(second.name).toBe('Axis Group 2')
        p = ops.updateAxisGroup(p, second.id, { name: 'Velocities' })
        p = ops.duplicateAxisGroup(p, second.id)
        expect(p.scopeFiles[0].axisGroups.map((a) => a.name)).toEqual(['Axis Group 1', 'Velocities', 'Velocities (copy)'])
        p = ops.removeAxisGroup(p, second.id)
        expect(p.scopeFiles[0].axisGroups).toHaveLength(2)
    })

    it('reassigns channels when their target is removed and keeps the last target', () => {
        let p = ops.addTarget(createProject(), { name: 'IPC', amsNetId: '10.0.0.1.1.1' })
        const ipc = p.targets[1].id
        p = ops.addChannels(p, firstGroup(p).id, [{ symbol: 'x', targetId: ipc }])
        p = ops.updateTarget(p, ipc, { name: 'IPC 2' })
        expect(p.targets[1].name).toBe('IPC 2')
        p = ops.removeTarget(p, ipc)
        expect(firstGroup(p).channels[0].targetId).toBe(LOCAL_TARGET_ID)
        expect(ops.removeTarget(p, LOCAL_TARGET_ID)).toBe(p)
    })

    it('counts acquisitions of valid channels only', () => {
        const p = withChannels(['a[{i:1:4}]', 'b', 'broken{', ''])
        expect(acquisitionCount(firstGroup(p))).toBe(5)
    })
})

describe('parseProject', () => {
    it('round-trips a project through JSON', () => {
        const p = withChannels(['MAIN.a[{i:1:3}]'])
        expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
    })
    it('rejects foreign files', () => {
        expect(() => parseProject(null)).toThrow('Not a project file')
        expect(() => parseProject({ version: 1 })).toThrow('Unsupported')
    })
    it('repairs malformed parts instead of trusting them', () => {
        const p = parseProject({
            version: 2,
            settings: { name: 42 },
            targets: [],
            scopeFiles: [{ name: 'F', axisGroups: [{ channels: [{ symbol: 'x', dataType: 'LREAL', targetId: 'ghost', port: 'x' }, 7] }] }],
        })
        expect(p.settings.name).toBe('Scope Project')
        expect(p.targets).toHaveLength(1)
        const ch = p.scopeFiles[0].axisGroups[0].channels
        expect(ch).toHaveLength(1)
        expect(ch[0]).toMatchObject({ symbol: 'x', dataType: 'REAL64', targetId: LOCAL_TARGET_ID, port: 851 })
    })
})

describe('projectIssues', () => {
    it('is empty for a clean project', () => {
        expect(projectIssues(withChannels(['MAIN.a']))).toEqual([])
    })
    it('reports invalid and empty channels, bad names and Net IDs', () => {
        let p = withChannels(['bad{', ''])
        p = ops.addScopeFile(p)
        p = ops.updateScopeFile(p, p.scopeFiles[1].id, { name: 'Scope_1' })
        p = ops.updateTarget(p, LOCAL_TARGET_ID, { amsNetId: 'x' })
        p = ops.updateSettings(p, { mainServer: 'y' })
        const issues = projectIssues(p)
        expect(issues).toHaveLength(6)
        expect(issues[0]).toMatch(/1 channel has an invalid/)
        expect(issues[1]).toMatch(/1 empty channel/)
    })
})

describe('moving and copying', () => {
    /** Scope_1: [A: a b c, B: d], Scope_2: [C: (empty)] */
    function setup() {
        let p = withChannels(['a', 'b', 'c'])
        p = ops.addAxisGroup(p, p.scopeFiles[0].id)
        p = ops.updateAxisGroup(p, p.scopeFiles[0].axisGroups[0].id, { name: 'A' })
        p = ops.updateAxisGroup(p, p.scopeFiles[0].axisGroups[1].id, { name: 'B' })
        p = ops.addChannels(p, p.scopeFiles[0].axisGroups[1].id, [{ symbol: 'd' }])
        p = ops.addScopeFile(p)
        p = ops.updateAxisGroup(p, p.scopeFiles[1].axisGroups[0].id, { name: 'C' })
        const [A, B] = p.scopeFiles[0].axisGroups
        const C = p.scopeFiles[1].axisGroups[0]
        const ch = (symbol: string) => allChannels(p).find((c) => c.symbol === symbol)!.id
        return { p, A: A.id, B: B.id, C: C.id, f1: p.scopeFiles[0].id, f2: p.scopeFiles[1].id, ch }
    }
    const symbols = (p: ReturnType<typeof setup>['p'], groupId: string) => findAxisGroup(p, groupId)!.channels.map((c) => c.symbol)
    const groupNames = (p: ReturnType<typeof setup>['p'], fileIndex: number) => p.scopeFiles[fileIndex].axisGroups.map((a) => a.name)

    describe('moveChannel', () => {
        it('reorders within a group using slots of the list as shown', () => {
            const { p, A, ch } = setup()
            expect(symbols(ops.moveChannel(p, ch('a'), A, 2), A)).toEqual(['b', 'a', 'c'])
            expect(symbols(ops.moveChannel(p, ch('a'), A, 3), A)).toEqual(['b', 'c', 'a'])
            expect(symbols(ops.moveChannel(p, ch('c'), A, 0), A)).toEqual(['c', 'a', 'b'])
            expect(symbols(ops.moveChannel(p, ch('c'), A, 1), A)).toEqual(['a', 'c', 'b'])
        })

        it('returns the same project when the position does not change', () => {
            const { p, A, ch } = setup()
            expect(ops.moveChannel(p, ch('b'), A, 1)).toBe(p)
            expect(ops.moveChannel(p, ch('b'), A, 2)).toBe(p)
            expect(ops.moveChannel(p, ch('c'), A)).toBe(p)
            expect(ops.moveChannel(p, ch('c'), A, 99)).toBe(p)
        })

        it('moves to the last position when the index is omitted or out of range', () => {
            const { p, A, B, ch } = setup()
            expect(symbols(ops.moveChannel(p, ch('a'), A), A)).toEqual(['b', 'c', 'a'])
            expect(symbols(ops.moveChannel(p, ch('a'), B), B)).toEqual(['d', 'a'])
            expect(symbols(ops.moveChannel(p, ch('a'), B, 42), B)).toEqual(['d', 'a'])
            expect(symbols(ops.moveChannel(p, ch('a'), B, NaN), B)).toEqual(['d', 'a'])
            expect(symbols(ops.moveChannel(p, ch('a'), B, -3), B)).toEqual(['a', 'd'])
        })

        it('moves into another group and another file, keeping the id', () => {
            const { p, A, B, C, ch } = setup()
            let q = ops.moveChannel(p, ch('b'), B, 0)
            expect(symbols(q, A)).toEqual(['a', 'c'])
            expect(symbols(q, B)).toEqual(['b', 'd'])
            expect(findAxisGroup(q, B)!.channels[0].id).toBe(ch('b'))
            q = ops.moveChannel(q, ch('b'), C)
            expect(symbols(q, B)).toEqual(['d'])
            expect(symbols(q, C)).toEqual(['b'])
            expect(allChannels(q)).toHaveLength(4)
        })

        it('ignores unknown ids', () => {
            const { p, A, ch } = setup()
            expect(ops.moveChannel(p, 'nope', A)).toBe(p)
            expect(ops.moveChannel(p, ch('a'), 'nope')).toBe(p)
        })
    })

    describe('copyChannel', () => {
        it('inserts a copy with a new id at the position', () => {
            const { p, A, B, C, ch } = setup()
            let q = ops.copyChannel(p, ch('a'), A, 1)
            expect(symbols(q, A)).toEqual(['a', 'a', 'b', 'c'])
            expect(new Set(allChannels(q).map((c) => c.id)).size).toBe(5)
            q = ops.copyChannel(q, ch('c'), B)
            expect(symbols(q, B)).toEqual(['d', 'c'])
            q = ops.copyChannel(q, ch('d'), C, 7)
            expect(symbols(q, C)).toEqual(['d'])
            expect(findAxisGroup(q, C)!.channels[0]).toMatchObject({ dataType: 'REAL64', port: 851, targetId: LOCAL_TARGET_ID })
            expect(symbols(q, B)).toEqual(['d', 'c'])
        })

        it('ignores unknown ids', () => {
            const { p, A, ch } = setup()
            expect(ops.copyChannel(p, 'nope', A)).toBe(p)
            expect(ops.copyChannel(p, ch('a'), 'nope')).toBe(p)
        })
    })

    describe('moveAxisGroup', () => {
        it('reorders within its file', () => {
            const { p, A, B, f1 } = setup()
            expect(groupNames(ops.moveAxisGroup(p, A, f1, 2), 0)).toEqual(['B', 'A'])
            expect(groupNames(ops.moveAxisGroup(p, B, f1, 0), 0)).toEqual(['B', 'A'])
            expect(groupNames(ops.moveAxisGroup(p, A, f1), 0)).toEqual(['B', 'A'])
        })

        it('returns the same project when the position does not change, also for its own file', () => {
            const { p, A, B, f1 } = setup()
            expect(ops.moveAxisGroup(p, A, f1, 0)).toBe(p)
            expect(ops.moveAxisGroup(p, A, f1, 1)).toBe(p)
            expect(ops.moveAxisGroup(p, B, f1)).toBe(p)
        })

        it('moves to another file with its channels', () => {
            const { p, A, f2 } = setup()
            const q = ops.moveAxisGroup(p, A, f2, 0)
            expect(groupNames(q, 0)).toEqual(['B'])
            expect(groupNames(q, 1)).toEqual(['A', 'C'])
            expect(symbols(q, A)).toEqual(['a', 'b', 'c'])
            expect(groupNames(ops.moveAxisGroup(p, A, f2), 1)).toEqual(['C', 'A'])
        })

        it('may leave a file without axis groups', () => {
            const { p, C, f1 } = setup()
            const q = ops.moveAxisGroup(p, C, f1)
            expect(q.scopeFiles[1].axisGroups).toEqual([])
            expect(groupNames(q, 0)).toEqual(['A', 'B', 'C'])
        })

        it('ignores unknown ids', () => {
            const { p, A, f1 } = setup()
            expect(ops.moveAxisGroup(p, 'nope', f1)).toBe(p)
            expect(ops.moveAxisGroup(p, A, 'nope')).toBe(p)
        })
    })

    describe('copyAxisGroup', () => {
        it('copies with new ids; "(copy)" only within the same file', () => {
            const { p, A, f1, f2 } = setup()
            let q = ops.copyAxisGroup(p, A, f1, 1)
            expect(groupNames(q, 0)).toEqual(['A', 'A (copy)', 'B'])
            q = ops.copyAxisGroup(q, A, f2)
            expect(groupNames(q, 1)).toEqual(['C', 'A'])
            const ids = [...allChannels(q).map((c) => c.id), ...q.scopeFiles.flatMap((f) => f.axisGroups.map((a) => a.id))]
            expect(new Set(ids).size).toBe(ids.length)
            expect(allChannels(q)).toHaveLength(10)
        })

        it('ignores unknown ids', () => {
            const { p, A, f1 } = setup()
            expect(ops.copyAxisGroup(p, 'nope', f1)).toBe(p)
            expect(ops.copyAxisGroup(p, A, 'nope')).toBe(p)
        })
    })

    it('mergeChannelSpecs inserts at a position', () => {
        const { p, A } = setup()
        const { project } = mergeChannelSpecs(p, A, [{ symbol: 'x', dataType: 'BIT', port: 851 }], 'T', 1)
        expect(symbols(project, A)).toEqual(['a', 'x', 'b', 'c'])
    })
})
