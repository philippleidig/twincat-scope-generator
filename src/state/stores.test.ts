import { beforeEach, describe, expect, it, vi } from 'vitest'
import demoTmc from '@/catalog/demo/DemoMachine.tmc?raw'
import { candidatesForEntry } from '@/catalog/candidates'
import { useProjectStore } from './projectStore'
import { useCatalogStore } from './catalogStore'
import { useSampleStore, DEFAULT_SAMPLES } from './sampleStore'
import { useBrowserStore, isFiltering } from './browserStore'
import { addChannels, addPicks, describeAddResult } from './actions'
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
        s.selectFile('missing')
        s.setActiveAxisGroup('missing')
        expect(useProjectStore.getState().activeAxisGroupId).toBe(group().id)
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
        expect(reports[0]).toMatchObject({ fileName: 'DemoMachine.tmc', sources: 1, symbols: 10 })
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

    it('updates and removes sources and rebuilds the index', () => {
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        const id = useCatalogStore.getState().sources[0].id
        useCatalogStore.getState().updateSource(id, { port: 852, pathPrefix: 'P' })
        expect(useCatalogStore.getState().index.entries[0]).toMatchObject({ port: 852 })
        expect(useCatalogStore.getState().index.entries[0].path.startsWith('P.')).toBe(true)
        useCatalogStore.getState().removeSource(id)
        expect(useCatalogStore.getState().index.entries).toEqual([])
    })

    it('hydrates without IndexedDB', async () => {
        await useCatalogStore.getState().hydrate()
        expect(useCatalogStore.getState().hydrated).toBe(true)
    })
})

describe('actions', () => {
    const pickFor = (path: string): BrowserPick => {
        const { index } = useCatalogStore.getState()
        const entry = index.entries.find((e) => e.path === path)!
        return { key: entry.key, sourceId: entry.sourceId, path, kind: entry.kind, candidates: () => candidatesForEntry(index, entry) }
    }

    it('adds picks as channels and skips duplicates', () => {
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        const r1 = addPicks(group().id, [pickFor('GVL.aAxis[*].fActPos'), pickFor('MAIN.sOperator')])
        expect(r1).toEqual({ added: 1, duplicates: 0, truncated: false, empty: 1 })
        expect(group().channels[0]).toMatchObject({ symbol: 'GVL.aAxis[{i:1:4}].fActPos', dataType: 'REAL64', port: 851, targetId: 'local' })
        const r2 = addPicks(group().id, [pickFor('GVL.aAxis')])
        expect(r2).toMatchObject({ added: 7, duplicates: 1 })
        expect(describeAddResult(r2, 'G')).toBe('7 channels added to G · 1 already present')
    })

    it('creates a target for a Net ID the project does not know yet', () => {
        const r = addChannels(group().id, [{ symbol: 'MAIN.x', dataType: 'BIT', port: 851, amsNetId: '9.9.9.9.1.1' }], 'IPC')
        expect(r.added).toBe(1)
        const { targets } = useProjectStore.getState().project
        expect(targets.map((t) => [t.name, t.amsNetId])).toEqual([
            ['Local', '127.0.0.1.1.1'],
            ['IPC', '9.9.9.9.1.1'],
        ])
        expect(group().channels[0].targetId).toBe(targets[1].id)
        expect(addChannels('missing', [])).toEqual({ added: 0, duplicates: 0 })
    })

    it('describes partial results', () => {
        expect(describeAddResult({ added: 1, duplicates: 0, empty: 2, truncated: true }, 'G')).toBe(
            '1 channel added to G · 2 not recordable · limit reached, not everything was added',
        )
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
        const pick = { key: 'k', sourceId: 's', path: 'p', kind: 'scalar', candidates: () => ({ candidates: [], truncated: false }) }
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
