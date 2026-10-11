import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import demoTmc from '@/catalog/demo/DemoMachine.tmc?raw'
import type { SearchEntry, SearchIndex } from '@/catalog/search'
import { useCatalogStore } from '@/state/catalogStore'
import { useBrowserStore } from '@/state/browserStore'
import { useProjectStore } from '@/state/projectStore'
import { SymbolBrowser } from './SymbolBrowser'
import { SearchResults } from './SearchResults'
import { RESULT_LIMIT } from './useSearch'

const VIEW_KEY = 'twincat-scope-browser-view'

function loadDemo() {
    const [report] = useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
    useBrowserStore.getState().expandSources(report.sourceIds)
}

const viewButton = (name: 'Tree' | 'List') => within(screen.getByRole('group', { name: 'Browser view' })).getByRole('button', { name })
const symbolList = () => screen.getByRole('listbox', { name: 'Symbol list' })

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
        const rows = within(symbolList()).getAllByRole('option')
        const shown = rows.map((r) => r.getAttribute('title')!.split(' — ')[0])
        const sortedPaths = entries.map((e) => e.path).sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
        expect(shown[0]).toBe(sortedPaths[0])
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
        expect(localStorage.getItem(VIEW_KEY)).toBe('list')

        // A fresh store module reads the stored preference, as after a reload.
        vi.resetModules()
        const reloaded = await import('@/state/browserStore')
        expect(reloaded.useBrowserStore.getState().view).toBe('list')
        localStorage.setItem(VIEW_KEY, 'bogus')
        expect(reloaded.readStoredView()).toBe('tree')

        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        try {
            expect(reloaded.readStoredView()).toBe('tree')
            await user.click(viewButton('Tree'))
            expect(viewButton('Tree')).toHaveAttribute('aria-pressed', 'true')
        } finally {
            getItem.mockRestore()
            setItem.mockRestore()
        }
    })

    it('caps a long list and says how many there are', () => {
        const total = RESULT_LIMIT + 5
        const entries: SearchEntry[] = Array.from({ length: total }, (_, i) => {
            const path = `GVL.n${String(i).padStart(5, '0')}`
            return {
                key: `s|${path}`,
                sourceId: 's',
                path,
                name: path.slice(4),
                kind: 'scalar',
                typeName: 'INT',
                scopeType: 'INT16',
                area: 'internal',
                port: 851,
                ranges: [],
                haystack: path.toLowerCase(),
            }
        })
        const index: SearchIndex = { entries: [...entries].reverse(), truncated: false }
        render(<SearchResults index={index} mode="list" />)
        expect(
            screen.getByText(`Showing ${RESULT_LIMIT.toLocaleString()} of ${total.toLocaleString()} symbols — refine the search to see more`),
        ).toBeInTheDocument()
        expect(within(symbolList()).getAllByRole('option')[0]).toHaveAttribute('title', 'GVL.n00000')
    })
})
