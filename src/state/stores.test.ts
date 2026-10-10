import { beforeEach, describe, expect, it, vi } from 'vitest'
import demoTmc from '@/catalog/demo/DemoMachine.tmc?raw'
import { selectActiveGroup, useProjectStore } from './projectStore'
import { useCatalogStore } from './catalogStore'
import { useSampleStore, DEFAULT_SAMPLES } from './sampleStore'
import { PICK_MIME, useBrowserStore, isFiltering } from './browserStore'
import { addPicks, addSpecs, describeAddResult, dropOnAxisGroup, openProjectFile, resolvePicks, saveProjectFile } from './actions'
import { toast, useToasts } from './toastStore'
import type { BrowserPick } from './browserStore'

const group = () => useProjectStore.getState().project.scopeFiles[0].axisGroups[0]

beforeEach(() => {
    useProjectStore.getState().reset()
    useCatalogStore.getState().clear()
})

describe('projectStore', () => {
    it('binds every pure operation to the store', () => {
        const s = useProjectStore.getState()
        s.addChannels(group().id, [{ symbol: 'MAIN.a' }])
        s.updateSettings({ name: 'Line 3' })
        expect(group().channels[0].symbol).toBe('MAIN.a')
        expect(useProjectStore.getState().project.settings.name).toBe('Line 3')
    })

    it('tracks the active file and axis group', () => {
        const s = useProjectStore.getState()
        s.addScopeFile()
        const second = useProjectStore.getState().project.scopeFiles[1]
        s.selectFile(second.id)
        expect(useProjectStore.getState()).toMatchObject({ activeFileId: second.id, activeAxisGroupId: second.axisGroups[0].id })
        s.setActiveAxisGroup(group().id)
        expect(useProjectStore.getState().activeFileId).toBe(useProjectStore.getState().project.scopeFiles[0].id)
        s.setActiveAxisGroup('missing')
        expect(useProjectStore.getState().activeAxisGroupId).toBe(group().id)
        s.selectFile('missing')
        expect(useProjectStore.getState().activeFileId).toBe(useProjectStore.getState().project.scopeFiles[0].id)
    })

    it('keeps the selection valid when the active group or file is removed', () => {
        const s = useProjectStore.getState()
        const fileId = s.project.scopeFiles[0].id
        s.addAxisGroup(fileId)
        const second = useProjectStore.getState().project.scopeFiles[0].axisGroups[1]
        s.setActiveAxisGroup(second.id)
        s.removeAxisGroup(second.id)
        expect(selectActiveGroup(useProjectStore.getState())?.id).toBe(group().id)
        s.addScopeFile('f2')
        s.selectFile('f2')
        s.removeScopeFile('f2')
        expect(useProjectStore.getState().activeFileId).toBe(fileId)
    })

    it('persists the project to localStorage and restores it validated', async () => {
        useProjectStore.getState().addChannels(group().id, [{ symbol: 'GVL.x' }])
        const stored = JSON.parse(localStorage.getItem('twincat-scope-project')!)
        expect(stored.state.project.scopeFiles[0].axisGroups[0].channels[0].symbol).toBe('GVL.x')

        stored.state.project.scopeFiles[0].name = 'Restored'
        localStorage.setItem('twincat-scope-project', JSON.stringify(stored))
        await useProjectStore.persist.rehydrate()
        expect(useProjectStore.getState().project.scopeFiles[0].name).toBe('Restored')

        localStorage.setItem('twincat-scope-project', JSON.stringify({ state: { project: { version: 99 } }, version: 2 }))
        await useProjectStore.persist.rehydrate()
        expect(useProjectStore.getState().project.scopeFiles[0].name).toBe('Restored')
    })
})

describe('catalogStore', () => {
    it('imports files, reports per file and replaces re-imported files', () => {
        const reports = useCatalogStore.getState().importFiles([
            { name: 'DemoMachine.tmc', text: demoTmc },
            { name: 'broken.tmc', text: '<TcModuleClass>' },
        ])
        expect(reports[0]).toMatchObject({ fileName: 'DemoMachine.tmc', sourceIds: ['DemoMachine.tmc#0'], symbols: 10 })
        expect(reports[1].error).toMatch(/Not a valid XML/)
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        expect(useCatalogStore.getState().sources).toHaveLength(1)
        expect(useCatalogStore.getState().index.entries).toHaveLength(26)
    })

    it('drops a PLC I/O listing when the same PLC .tmc is present', () => {
        const xti = `<TcSmItem><Project Name="DemoMachine" AmsPort="851"><Instance><Vars VarGrpType="1"><Name>In</Name><Var><Name>GVL_IO.bEmergencyStop</Name><Type>BOOL</Type></Var></Vars></Instance></Project></TcSmItem>`
        useCatalogStore.getState().importFiles([{ name: 'plc.xti', text: xti }])
        expect(useCatalogStore.getState().sources.map((s) => s.kind)).toEqual(['PLC'])
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        expect(useCatalogStore.getState().sources.map((s) => s.fileName)).toEqual(['DemoMachine.tmc'])
    })

    it('updates and removes sources, rebuilds the index and drops stale picks', () => {
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        const id = useCatalogStore.getState().sources[0].id
        useBrowserStore.getState().toggleSelected({ key: 'k', sourceId: id, path: 'MAIN.nCycle', kind: 'scalar' })
        useCatalogStore.getState().updateSource(id, { port: 852, pathPrefix: 'P' })
        expect(useCatalogStore.getState().index.entries[0]).toMatchObject({ port: 852 })
        expect(useCatalogStore.getState().index.entries[0].path.startsWith('P.')).toBe(true)
        expect(useBrowserStore.getState().selection.size).toBe(0)
        useCatalogStore.getState().removeSource(id)
        expect(useCatalogStore.getState().index.entries).toEqual([])
    })

    it('hydrates without IndexedDB', async () => {
        await useCatalogStore.getState().hydrate()
        expect(useCatalogStore.getState().hydrated).toBe(true)
    })
})

describe('actions', () => {
    const pick = (path: string, kind: BrowserPick['kind'] = 'scalar'): BrowserPick => ({ key: path, sourceId: 'DemoMachine.tmc#0', path, kind })

    it('adds picks as channels and skips duplicates and unrecordable symbols', () => {
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        const r1 = addPicks(group().id, [pick('GVL.aAxis[*].fActPos'), pick('MAIN.sOperator', 'unsupported')])
        expect(r1).toEqual({ added: 1, duplicates: 0, truncated: false, empty: 1, tooLarge: 0 })
        expect(group().channels[0]).toMatchObject({ symbol: 'GVL.aAxis[{i:1:4}].fActPos', dataType: 'REAL64', port: 851, targetId: 'local' })
        const r2 = addPicks(group().id, [pick('GVL.aAxis', 'array')])
        expect(r2).toMatchObject({ added: 7, duplicates: 1 })
        expect(describeAddResult(r2, 'G')).toBe('7 channels added to G · 1 already present')
    })

    it('resolves picks against the current catalog (prefix changed after picking)', () => {
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        useCatalogStore.getState().updateSource('DemoMachine.tmc#0', { pathPrefix: 'P' })
        expect(resolvePicks([pick('MAIN.nCycle')]).specs).toEqual([])
        expect(resolvePicks([pick('P.MAIN.nCycle')]).specs[0].symbol).toBe('P.MAIN.nCycle')
        expect(resolvePicks([{ ...pick('x'), sourceId: 'gone' }]).empty).toBe(1)
    })

    it('reports arrays too large for one channel', () => {
        const big = `<TcModuleClass><Modules><Module><Name>P</Name><CLSID ClassFactory="TcPlc30"/><DataAreas><DataArea><AreaNo AreaType="Internal">3</AreaNo><Name>I</Name>
            <Symbol><Name>MAIN.z</Name><BaseType>LREAL</BaseType><ArrayInfo><LBound>0</LBound><Elements>7000</Elements></ArrayInfo></Symbol>
        </DataArea></DataAreas></Module></Modules></TcModuleClass>`
        useCatalogStore.getState().importFiles([{ name: 'big.tmc', text: big }])
        const r = addPicks(group().id, [{ key: 'z', sourceId: 'big.tmc#0', path: 'MAIN.z', kind: 'array' }])
        expect(r).toMatchObject({ added: 0, tooLarge: 1, empty: 0 })
        expect(describeAddResult(r, 'G')).toMatch(/1 array too large/)
    })

    it('creates one target for a Net ID the project does not know yet, in one commit', () => {
        const spy = vi.fn()
        const unsubscribe = useProjectStore.subscribe(spy)
        const r = addSpecs(group().id, [
            { symbol: 'MAIN.x', dataType: 'BIT', port: 851, amsNetId: '9.9.9.9.1.1' },
            { symbol: 'MAIN.y', dataType: 'BIT', port: 851, amsNetId: '9.9.9.9.1.1' },
        ], 'IPC')
        unsubscribe()
        expect(r).toEqual({ added: 2, duplicates: 0 })
        expect(spy).toHaveBeenCalledTimes(1)
        const { targets } = useProjectStore.getState().project
        expect(targets.map((t) => [t.name, t.amsNetId])).toEqual([
            ['Local', '127.0.0.1.1.1'],
            ['IPC', '9.9.9.9.1.1'],
        ])
        expect(group().channels.every((c) => c.targetId === targets[1].id)).toBe(true)
        expect(addSpecs('missing', [])).toEqual({ added: 0, duplicates: 0 })
    })

    it('handles drops of browser picks, Target Browser XML and garbage', () => {
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        const data = (type: string, value: string) => ({ types: [type], getData: (t: string) => (t === type ? value : '') })
        expect(dropOnAxisGroup(group().id, data(PICK_MIME, JSON.stringify([pick('MAIN.nCycle')]))).added).toBe(1)
        expect(dropOnAxisGroup(group().id, data(PICK_MIME, '{broken')).added).toBe(0)
        const xml = '<TargetBrowserExportInfo><Symbols><Symbol><Name>MAIN.q</Name><BaseType>BOOL</BaseType></Symbol></Symbols></TargetBrowserExportInfo>'
        expect(dropOnAxisGroup(group().id, data('text/plain', xml))).toMatchObject({ added: 1 })
        expect(describeAddResult(dropOnAxisGroup(group().id, data('text/plain', 'hello')), 'G')).toMatch(/Nothing to add/)
    })

    it('describes partial results', () => {
        expect(describeAddResult({ added: 1, duplicates: 0, empty: 2, truncated: true, tooLarge: 0 }, 'G')).toBe(
            '1 channel added to G · 2 not recordable · limit reached, not everything was added',
        )
    })

    it('saves and opens project files', async () => {
        const text = vi.fn()
        Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(text)
        saveProjectFile()
        expect(text).toHaveBeenCalled()
        const saved = { ...useProjectStore.getState().project, settings: { ...useProjectStore.getState().project.settings, name: 'X' } }
        await openProjectFile(new File([JSON.stringify(saved)], 'p.json'))
        expect(useProjectStore.getState().project.settings.name).toBe('X')
        await expect(openProjectFile(new File(['nope'], 'p.json'))).rejects.toThrow('not a JSON file')
        await expect(openProjectFile(new File(['{}'], 'p.json'))).rejects.toThrow('Unsupported')
    })
})

describe('sampleStore', () => {
    it('adds, updates, removes, exports and imports patterns', () => {
        const s = useSampleStore.getState()
        s.resetToDefaults()
        s.addSample('A.b[{i:1:2}]', 'two')
        const added = useSampleStore.getState().samples.at(-1)!
        s.updateSample(added.id, { description: 'zwei' })
        expect(JSON.parse(useSampleStore.getState().exportSamples()).at(-1)).toEqual({ template: 'A.b[{i:1:2}]', description: 'zwei' })
        s.removeSample(added.id)
        expect(useSampleStore.getState().samples).toEqual(DEFAULT_SAMPLES)
        expect(s.importSamples([{ template: 'X' }, { template: '' }, 5, null])).toBe(1)
        expect(useSampleStore.getState().samples.map((x) => x.template)).toEqual(['X'])
        expect(s.importSamples({})).toBe(0)
        expect(useSampleStore.getState().samples).toHaveLength(1)
    })
})

describe('browserStore', () => {
    it('toggles filters, selection and expansion', () => {
        const s = useBrowserStore.getState()
        expect(isFiltering(useBrowserStore.getState())).toBe(false)
        s.toggleScopeType('BIT')
        s.toggleArea('input')
        s.setRecordableOnly(true)
        s.setQuery('x')
        expect(isFiltering(useBrowserStore.getState())).toBe(true)
        s.clearFilters()
        expect(isFiltering(useBrowserStore.getState())).toBe(false)
        const pick: BrowserPick = { key: 'k', sourceId: 's', path: 'p', kind: 'scalar' }
        s.toggleSelected(pick)
        expect(useBrowserStore.getState().selection.size).toBe(1)
        s.toggleSelected(pick)
        s.setSelection([pick, { ...pick, key: 'k2' }])
        expect(useBrowserStore.getState().selection.size).toBe(2)
        s.clearSelection()
        s.toggleExpanded('a')
        s.toggleExpanded('b')
        s.toggleExpanded('a')
        expect([...useBrowserStore.getState().expanded]).toEqual(['b'])
        s.collapseAll()
        s.setFocused(pick)
        expect(useBrowserStore.getState().focused).toBe(pick)
        s.expandSources(['a.tmc#0'])
        expect(useBrowserStore.getState().expanded.has('source:a.tmc#0')).toBe(true)
        s.resetPicks()
        expect(useBrowserStore.getState().focused).toBeNull()
    })
})

describe('toastStore', () => {
    it('queues and auto-dismisses toasts', () => {
        vi.useFakeTimers()
        toast.success('a')
        toast.warning('b')
        toast.info('c')
        expect(useToasts.getState().toasts.map((t) => t.tone)).toEqual(['success', 'warning', 'info'])
        vi.advanceTimersByTime(4000)
        expect(useToasts.getState().toasts.map((t) => t.message)).toEqual(['b'])
        vi.advanceTimersByTime(4000)
        expect(useToasts.getState().toasts).toEqual([])
        vi.useRealTimers()
    })
})
