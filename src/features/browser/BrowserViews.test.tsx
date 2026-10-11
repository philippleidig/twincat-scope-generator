import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import demoTmc from '@/catalog/demo/DemoMachine.tmc?raw'
import { buildIndex } from '@/catalog/search'
import { importTwinCatFile } from '@/catalog/importFile'
import { expectSortedByPath } from '@/test/sortedByPath'
import { useCatalogStore } from '@/state/catalogStore'
import { useBrowserStore } from '@/state/browserStore'
import { useProjectStore } from '@/state/projectStore'
import { SymbolBrowser } from './SymbolBrowser'
import { EntryList } from './EntryList'
import { RESULT_LIMIT } from './useSearch'

const VIEW_KEY = 'twincat-scope-browser-view'

function loadDemo() {
    const [report] = useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
    useBrowserStore.getState().expandSources(report.sourceIds)
}

const viewButton = (name: 'Tree' | 'List') => within(screen.getByRole('group', { name: 'Browser view' })).getByRole('button', { name })
const symbolList = () => screen.getByRole('listbox', { name: 'Symbol list' })
/** Paths of the rendered list rows, top to bottom. */
const renderedPaths = () =>
    within(symbolList())
        .getAllByRole('option')
        .map((row) => row.querySelector('.tree-row__label')!.textContent)

beforeEach(() => {
    useProjectStore.getState().reset()
    useCatalogStore.getState().clear()
    useCatalogStore.setState({ hydrated: true })
    useBrowserStore.setState({ view: 'tree', expanded: new Set(), selection: new Map(), focused: null })
    useBrowserStore.getState().clearFilters()
    loadDemo()
})

describe('browser views', () => {
    it('toggles between the tree and the flat list', async () => {
        const user = userEvent.setup()
        render(<SymbolBrowser />)
        expect(viewButton('Tree')).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('tree', { name: 'Symbols' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument()

        // A query in the tree view shows search results; Collapse only goes with the tree.
        await user.type(screen.getByLabelText('Search symbols'), 'fActPos')
        expect(screen.getByRole('listbox', { name: 'Search results' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Collapse' })).not.toBeInTheDocument()
        await user.clear(screen.getByLabelText('Search symbols'))

        await user.click(viewButton('List'))
        expect(viewButton('List')).toHaveAttribute('aria-pressed', 'true')
        expect(symbolList()).toBeInTheDocument()
        expect(screen.queryByRole('tree')).not.toBeInTheDocument()
        // Collapsing only means something in the tree.
        expect(screen.queryByRole('button', { name: 'Collapse' })).not.toBeInTheDocument()

        await user.click(viewButton('Tree'))
        expect(screen.getByRole('tree', { name: 'Symbols' })).toBeInTheDocument()
    })

    it('lists every search entry sorted by path without a query', async () => {
        const user = userEvent.setup()
        render(<SymbolBrowser />)
        await user.click(viewButton('List'))

        const { entries } = useCatalogStore.getState().index
        expect(screen.getByText(`${entries.length} symbols`)).toBeInTheDocument()
        const shown = renderedPaths()
        expect(shown.length).toBeGreaterThan(10)
        expect(shown).toEqual(entries.slice(0, shown.length).map((e) => e.path))
        expectSortedByPath(shown)
        // Arrays appear once, as patterns with their element count.
        expect(within(symbolList()).getAllByText('×4').length).toBeGreaterThan(0)
    })

    it('narrows the list by search text and filter chips without leaving List mode', async () => {
        const user = userEvent.setup()
        render(<SymbolBrowser />)
        await user.click(viewButton('List'))

        await user.type(screen.getByLabelText('Search symbols'), 'fActPos')
        expect(within(symbolList()).getAllByRole('option')).toHaveLength(1)
        expect(screen.getByText('1 symbol')).toBeInTheDocument()
        expect(screen.queryByRole('listbox', { name: 'Search results' })).not.toBeInTheDocument()

        await user.clear(screen.getByLabelText('Search symbols'))
        await user.click(screen.getByRole('button', { name: 'BOOL' }))
        const bools = useCatalogStore.getState().index.entries.filter((e) => e.scopeType === 'BIT')
        expect(within(symbolList()).getAllByRole('option')).toHaveLength(bools.length)

        await user.click(screen.getByRole('button', { name: 'Input' }))
        await user.click(screen.getByRole('button', { name: 'Output' }))
        await user.type(screen.getByLabelText('Search symbols'), 'nothing-matches')
        expect(screen.getByText('No matching symbols')).toBeInTheDocument()
    })

    it('keeps selection and focus across view switches and adds from the list', async () => {
        const user = userEvent.setup()
        render(<SymbolBrowser />)

        // Tree pick.
        await user.click(screen.getByRole('button', { name: 'Expand MAIN' }))
        await user.click(screen.getByRole('checkbox', { name: 'Select MAIN.nCycle' }))

        // List pick (a pattern) plus focus for the inspector.
        await user.click(viewButton('List'))
        await user.type(screen.getByLabelText('Search symbols'), 'fActPos')
        const row = within(symbolList()).getByRole('option')
        await user.click(within(row).getByRole('checkbox'))
        await user.click(row)
        expect(screen.getByText('GVL.aAxis[*].fActPos', { selector: 'code' })).toBeInTheDocument()

        await user.click(viewButton('Tree'))
        await user.clear(screen.getByLabelText('Search symbols'))
        expect(screen.getByRole('checkbox', { name: 'Select MAIN.nCycle' })).toBeChecked()
        expect(screen.getByRole('region', { name: 'Selection' })).toHaveTextContent('2 selected')
        expect(screen.getByText('GVL.aAxis[*].fActPos', { selector: 'code' })).toBeInTheDocument()

        await user.click(viewButton('List'))
        await user.click(within(screen.getByRole('region', { name: 'Selection' })).getByRole('button', { name: /Add to scope/ }))
        const channels = useProjectStore.getState().project.scopeFiles[0].axisGroups[0].channels
        expect(channels.map((c) => c.symbol)).toEqual(['MAIN.nCycle', 'GVL.aAxis[{i:1:4}].fActPos'])
    })

    it('remembers the view across reloads and works without storage', async () => {
        const user = userEvent.setup()
        render(<SymbolBrowser />)
        await user.click(viewButton('List'))
        expect(JSON.parse(localStorage.getItem(VIEW_KEY)!).state).toEqual({ view: 'list' })

        // A reload reads the stored preference; anything else stored is ignored.
        useBrowserStore.setState({ view: 'tree' })
        localStorage.setItem(VIEW_KEY, JSON.stringify({ state: { view: 'list', query: 'x' }, version: 0 }))
        await act(() => useBrowserStore.persist.rehydrate())
        expect(useBrowserStore.getState()).toMatchObject({ view: 'list', query: '' })
        expect(viewButton('List')).toHaveAttribute('aria-pressed', 'true')

        localStorage.setItem(VIEW_KEY, JSON.stringify({ state: { view: 'bogus' }, version: 0 }))
        await act(() => useBrowserStore.persist.rehydrate())
        expect(useBrowserStore.getState().view).toBe('list')

        const blocked = () => {
            throw new Error('blocked')
        }
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
        try {
            await user.click(viewButton('Tree'))
            expect(viewButton('Tree')).toHaveAttribute('aria-pressed', 'true')
            await act(() => useBrowserStore.persist.rehydrate())
            expect(useBrowserStore.getState().view).toBe('tree')
        } finally {
            getItem.mockRestore()
            setItem.mockRestore()
        }
    })

    it('caps a long list and says how many there are', () => {
        const [demo] = importTwinCatFile('DemoMachine.tmc', demoTmc)
        const total = RESULT_LIMIT + 5
        // Declared in reverse, so the list has to come out sorted.
        const roots = Array.from({ length: total }, (_, i) => ({
            name: `GVL.n${String(total - 1 - i).padStart(5, '0')}`,
            type: 'INT',
            area: 'internal' as const,
            areaName: 'Internal',
        }))
        render(<EntryList index={buildIndex([{ ...demo, roots }])} mode="list" />)
        expect(
            screen.getByText(`Showing ${RESULT_LIMIT.toLocaleString()} of ${total.toLocaleString()} symbols — refine the search to see more`),
        ).toBeInTheDocument()
        expect(renderedPaths().slice(0, 3)).toEqual(['GVL.n00000', 'GVL.n00001', 'GVL.n00002'])
    })

    it('says when there are no symbols at all', () => {
        render(<EntryList index={buildIndex([])} mode="list" />)
        expect(screen.getByText('No symbols')).toBeInTheDocument()
    })
})
