import { describe, expect, it } from 'vitest'
import {
    LOCAL_TARGET_ID,
    acquisitionCount,
    allChannels,
    amsNetIdError,
    createProject,
    fileNameError,
    findAxisGroup,
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

    it('moves a channel between axis groups', () => {
        let p = withChannels(['MAIN.a'])
        p = ops.addAxisGroup(p, p.scopeFiles[0].id)
        const [from, to] = p.scopeFiles[0].axisGroups
        p = ops.moveChannel(p, from.channels[0].id, to.id)
        expect(findAxisGroup(p, from.id)!.channels).toEqual([])
        expect(findAxisGroup(p, to.id)!.channels[0].symbol).toBe('MAIN.a')
        expect(ops.moveChannel(p, 'nope', to.id)).toBe(p)
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
