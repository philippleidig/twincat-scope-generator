import { describe, expect, it } from 'vitest'
import { LOCAL_TARGET_ID, createProject, ops } from './project'
import { amsNetIdError, fileNameError, parseProject, projectIssues } from './projectValidation'

const firstGroup = (p = createProject()) => p.scopeFiles[0].axisGroups[0]

function withChannels(symbols: string[]) {
    const p = createProject()
    return ops.addChannels(p, firstGroup(p).id, symbols.map((symbol) => ({ symbol })))
}

describe('validators', () => {
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

describe('channel names and colours', () => {
    const styled = () => {
        const p = withChannels(['A[{i:1:2}]', 'B'])
        const [a, b] = firstGroup(p).channels
        let q = ops.updateChannel(p, a.id, { name: 'Axis {i}', color: '#ff0000', colorMode: 'same' })
        q = ops.updateChannel(q, b.id, { name: 'B {x}' })
        return q
    }

    it('round-trips names, colours and the colour mode', () => {
        const p = styled()
        expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
    })

    it('keeps old files without the fields valid', () => {
        const [c] = firstGroup(parseProject(JSON.parse(JSON.stringify(withChannels(['A'])))))!.channels
        expect(c).not.toHaveProperty('name')
        expect(c).not.toHaveProperty('color')
        expect(c).not.toHaveProperty('colorMode')
    })

    it('drops malformed fields and normalises colours', () => {
        const json = JSON.parse(JSON.stringify(withChannels(['A'])))
        Object.assign(json.scopeFiles[0].axisGroups[0].channels[0], { name: 3, color: 'red', colorMode: 'rainbow' })
        const [c] = firstGroup(parseProject(json)).channels
        expect(c).not.toHaveProperty('name')
        expect(c).not.toHaveProperty('color')
        expect(c).not.toHaveProperty('colorMode')
        Object.assign(json.scopeFiles[0].axisGroups[0].channels[0], { name: ' ', color: '#AABBCC', colorMode: 'palette' })
        expect(firstGroup(parseProject(json)).channels[0]).toEqual({ ...c, name: ' ', color: '#aabbcc' })
    })

    it('reports names the template cannot fill as one issue, with the first reason', () => {
        expect(projectIssues(styled())).toContain(
            'Channel name "B {x}": Unknown counter {x}: the symbol path has no counters — the symbol path is used instead',
        )
        const p = styled()
        const [a, b] = firstGroup(p).channels
        let q = ops.updateChannel(p, b.id, { name: 'B {i:1:2}' })
        q = ops.updateChannel(q, a.id, { name: 'A {j}' })
        const nameIssues = projectIssues(q).filter((i) => i.startsWith('Channel name'))
        expect(nameIssues).toEqual(['Channel name "A {j}": Unknown counter {j}: the symbol path has {i} (and 1 more) — the symbol path is used instead'])
    })

    it('does not report the name of a channel skipped for its symbol path', () => {
        const p = withChannels(['broken{', ''])
        const [a, b] = firstGroup(p).channels
        let q = ops.updateChannel(p, a.id, { name: 'A {x}' })
        q = ops.updateChannel(q, b.id, { name: 'B {x}' })
        expect(projectIssues(q).filter((i) => i.startsWith('Channel name'))).toEqual([])
    })
})
