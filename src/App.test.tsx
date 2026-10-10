import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useProjectStore } from '@/state/projectStore'
import { useCatalogStore } from '@/state/catalogStore'
import { useBrowserStore } from '@/state/browserStore'
import { useToasts } from '@/state/toastStore'
import demoTmc from '@/catalog/demo/DemoMachine.tmc?raw'

const channels = () => useProjectStore.getState().project.scopeFiles[0].axisGroups[0].channels

beforeEach(() => {
    useProjectStore.getState().reset()
    useCatalogStore.getState().clear()
    useCatalogStore.setState({ hydrated: true })
    useBrowserStore.setState({ expanded: new Set(), selection: new Map(), focused: null })
    useBrowserStore.getState().clearFilters()
    useToasts.setState({ toasts: [] })
})

describe('App', () => {
    it('shows the empty browser and the default project', () => {
        render(<App />)
        expect(screen.getByText('Drop TwinCAT files here')).toBeInTheDocument()
        expect(screen.getByLabelText('Scope file name')).toHaveValue('Scope_1')
        expect(screen.getByLabelText('Axis group name')).toHaveValue('Axis Group 1')
        expect(screen.getByRole('button', { name: /Export ZIP/ })).toBeDisabled()
        expect(screen.getByText(/not a Beckhoff product/)).toBeInTheDocument()
    })

    it('browses the demo, searches, selects and adds symbols to the active axis group', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.click(screen.getByRole('button', { name: 'Try the demo machine' }))

        // Tree: source is open, folders expand.
        await user.click(screen.getByRole('button', { name: 'Expand GVL' }))
        await user.click(screen.getByRole('button', { name: 'Expand aAxis' }))
        expect(screen.getByText('[3]')).toBeInTheDocument()

        // Search and select a wildcard result plus a struct.
        await user.type(screen.getByLabelText('Search symbols'), 'fActPos')
        const results = screen.getByRole('listbox', { name: 'Search results' })
        expect(within(results).getAllByRole('option')).toHaveLength(1)
        await user.click(within(results).getByRole('checkbox'))
        await user.clear(screen.getByLabelText('Search symbols'))
        await user.type(screen.getByLabelText('Search symbols'), 'fbConveyor')
        await user.click(screen.getByRole('checkbox', { name: 'Select MAIN.fbConveyor' }))

        const bar = screen.getByRole('region', { name: 'Selection' })
        expect(bar).toHaveTextContent('2 selected')
        expect(bar).toHaveTextContent('Scope_1 › Axis Group 1')
        await user.click(within(bar).getByRole('button', { name: /Add to scope/ }))

        expect(channels().map((c) => c.symbol)).toEqual([
            'GVL.aAxis[{i:1:4}].fActPos',
            'MAIN.fbConveyor.bBusy',
            'MAIN.fbConveyor.nErrorId',
            'MAIN.fbConveyor.bStart',
            'MAIN.fbConveyor.fSpeed',
            'MAIN.fbConveyor.aZoneTemp[{i:1:8}]',
        ])
        expect(screen.getByText('6 channels added to Axis Group 1')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Export ZIP/ })).toBeEnabled()
        expect(screen.getByText('16', { selector: 'strong' })).toBeInTheDocument()
    })

    it('filters by chips and shows an empty result', async () => {
        const user = userEvent.setup()
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        render(<App />)
        await user.click(screen.getByRole('button', { name: 'Output' }))
        expect(screen.getByText('2 matches')).toBeInTheDocument()
        await user.type(screen.getByLabelText('Search symbols'), 'nothing-like-this')
        expect(screen.getByText('No matching symbols')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Clear' }))
        expect(screen.getByRole('tree')).toBeInTheDocument()
    })

    it('imports files through the file picker and reports failures', async () => {
        const user = userEvent.setup()
        render(<App />)
        const input = screen.getByTestId('import-input')
        await user.upload(input, [
            new File([demoTmc], 'DemoMachine.tmc'),
            new File(['<nope'], 'broken.xti'),
        ])
        expect(await screen.findByText(/Imported 1 file · 10 symbols/)).toBeInTheDocument()
        expect(screen.getByText(/broken\.xti|Not a valid XML/)).toBeInTheDocument()
        expect(screen.getByText('DemoMachine (PLC)', { selector: '.source-card__title' })).toBeInTheDocument()
    })

    it('edits source settings and removes a source', async () => {
        const user = userEvent.setup()
        useCatalogStore.getState().importFiles([{ name: 'DemoMachine.tmc', text: demoTmc }])
        render(<App />)
        await user.click(screen.getByRole('button', { name: 'Settings for DemoMachine (PLC)' }))
        const port = screen.getByLabelText('ADS port')
        await user.clear(port)
        await user.type(port, '852')
        // Applied on Enter/blur only: every change re-indexes the source.
        expect(useCatalogStore.getState().sources[0].port).toBe(851)
        await user.type(port, '{Enter}')
        expect(useCatalogStore.getState().sources[0].port).toBe(852)
        const prefix = screen.getByLabelText('Path prefix')
        await user.type(prefix, 'Object1 (X) ')
        await user.tab()
        expect(useCatalogStore.getState().sources[0].pathPrefix).toBe('Object1 (X)')
        await user.click(screen.getByRole('button', { name: 'Remove DemoMachine (PLC)' }))
        expect(screen.getByText('Drop TwinCAT files here')).toBeInTheDocument()
    })
})

describe('project editor', () => {
    it('edits channels and validates templates', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.click(screen.getByRole('button', { name: 'Add channel' }))
        const symbol = screen.getByLabelText('Symbol path')
        await user.type(symbol, 'MAIN.item[[{{n:10:5}]')
        expect(screen.getByRole('alert')).toHaveTextContent('start (10) must be <= end (5)')
        await user.clear(symbol)
        await user.type(symbol, 'MAIN.mover[[{{i:1:5}].pos')
        expect(screen.getByText('×5')).toBeInTheDocument()
        await user.selectOptions(screen.getByLabelText('Data type'), 'BIT')
        expect(channels()[0].dataType).toBe('BIT')
        await user.click(screen.getByRole('button', { name: 'Duplicate channel' }))
        expect(channels()).toHaveLength(2)
        await user.click(screen.getAllByRole('button', { name: 'Remove channel' })[0])
        expect(channels()).toHaveLength(1)
    })

    it('manages scope files and axis groups', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.click(screen.getByRole('button', { name: 'Add scope file' }))
        expect(screen.getByRole('tab', { name: /Scope_2/ })).toHaveAttribute('aria-selected', 'true')
        const name = screen.getByLabelText('Scope file name')
        await user.clear(name)
        await user.type(name, 'Scope_1')
        expect(screen.getByText('Another scope file has this name')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Scope file actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Delete file' }))
        expect(screen.getAllByRole('tab')).toHaveLength(1)

        await user.click(screen.getByRole('button', { name: /Axis group/ }))
        expect(screen.getAllByLabelText('Axis group name')).toHaveLength(2)
        await user.click(screen.getAllByRole('button', { name: 'Add here' })[0])
        expect(useProjectStore.getState().activeAxisGroupId).toBe(useProjectStore.getState().project.scopeFiles[0].axisGroups[1].id)
        await user.click(screen.getAllByRole('button', { name: 'Duplicate axis group' })[1])
        expect(screen.getAllByLabelText('Axis group name')).toHaveLength(3)
        await user.click(screen.getAllByRole('button', { name: 'Remove axis group' })[2])
        expect(screen.getAllByLabelText('Axis group name')).toHaveLength(2)
        await user.click(screen.getAllByRole('button', { name: /Collapse Axis Group/ })[0])
        expect(screen.getAllByRole('button', { name: 'Add channel' })).toHaveLength(1)
    })

    it('accepts symbols dropped from the TwinCAT Target Browser', () => {
        render(<App />)
        const xml = `<TargetBrowserExportInfo><TargetInfo><AmsAddress><Port>852</Port></AmsAddress></TargetInfo><Symbols><Symbol><Name>MAIN.fVelo</Name><BaseType>LREAL</BaseType></Symbol></Symbols></TargetBrowserExportInfo>`
        const card = screen.getByRole('region', { name: 'Axis group Axis Group 1' })
        const dataTransfer = { types: ['text/plain'], getData: () => xml, dropEffect: '' }
        fireEvent.dragOver(card, { dataTransfer })
        expect(screen.getByText('Drop to add to Axis Group 1')).toBeInTheDocument()
        fireEvent.drop(card, { dataTransfer })
        expect(channels()[0]).toMatchObject({ symbol: 'MAIN.fVelo', port: 852, dataType: 'REAL64' })
        fireEvent.drop(card, { dataTransfer: { types: ['text/plain'], getData: () => 'hello' } })
        expect(screen.getByText(/Nothing to add/)).toBeInTheDocument()
    })

    it('inserts patterns from the library', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.click(screen.getByRole('button', { name: 'Pattern library' }))
        const dialog = screen.getByRole('dialog', { name: 'Pattern library' })
        await user.click(within(dialog).getAllByRole('button', { name: 'Insert' })[0])
        expect(channels()[0].symbol).toBe('MAIN.mover[{i:1:5}].position')
        await user.type(within(dialog).getByLabelText('New pattern'), 'X{{i:1:2}')
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))
        expect(within(dialog).getByText('X{i:1:2}')).toBeInTheDocument()
        await user.click(within(dialog).getByRole('button', { name: 'Close' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})

describe('header', () => {
    it('edits settings and targets', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.click(screen.getByRole('button', { name: 'Project settings' }))
        const dialog = screen.getByRole('dialog', { name: 'Project settings' })
        const sample = within(dialog).getByLabelText('Base sample time')
        await user.clear(sample)
        await user.type(sample, '2')
        expect(useProjectStore.getState().project.settings.baseSampleTime).toBe(20_000)
        await user.click(within(dialog).getByRole('button', { name: 'Add target' }))
        const netIds = within(dialog).getAllByLabelText(/AMS Net ID of/)
        await user.clear(netIds[1])
        await user.type(netIds[1], '10.0.0')
        expect(within(dialog).getByText(/Six numbers/)).toBeInTheDocument()
        await user.click(within(dialog).getByRole('button', { name: 'Remove target Target 2' }))
        expect(useProjectStore.getState().project.targets).toHaveLength(1)
        await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    })

    it('renames the project and cycles the theme', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.clear(screen.getByLabelText('Project name'))
        await user.type(screen.getByLabelText('Project name'), 'Line 3')
        expect(useProjectStore.getState().project.settings.name).toBe('Line 3')
        await user.click(screen.getByRole('button', { name: 'Theme: system' }))
        expect(document.documentElement).toHaveAttribute('data-theme', 'light')
        await user.click(screen.getByRole('button', { name: 'Theme: light' }))
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
        await user.click(screen.getByRole('button', { name: 'Theme: dark' }))
        expect(document.documentElement).not.toHaveAttribute('data-theme')
    })

    it('exports a zip of the project', async () => {
        const user = userEvent.setup()
        const createObjectURL = vi.fn(() => 'blob:x')
        Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
        useProjectStore.getState().addChannels(useProjectStore.getState().project.scopeFiles[0].axisGroups[0].id, [{ symbol: 'MAIN.a' }, { symbol: 'bad{' }])
        render(<App />)
        expect(screen.getByLabelText(/1 issues/)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /Export ZIP/ }))
        expect(await screen.findByText('Exported 1 scope file · 1 acquisitions')).toBeInTheDocument()
        expect(screen.getByText(/invalid symbol paths/)).toBeInTheDocument()
        expect(createObjectURL).toHaveBeenCalled()
    })

    it('saves and opens project files', async () => {
        const user = userEvent.setup()
        Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
        const { container } = render(<App />)
        await user.click(screen.getByRole('button', { name: 'Project menu' }))
        await user.click(screen.getByRole('menuitem', { name: 'Save project file' }))

        const saved = { ...useProjectStore.getState().project, settings: { ...useProjectStore.getState().project.settings, name: 'Opened' } }
        const input = container.querySelector('input[accept=".json,application/json"]') as HTMLInputElement
        await user.upload(input, new File([JSON.stringify(saved)], 'p.scope.json', { type: 'application/json' }))
        expect(await screen.findByText('Opened p.scope.json')).toBeInTheDocument()
        expect(useProjectStore.getState().project.settings.name).toBe('Opened')

        await user.upload(input, new File(['{}'], 'bad.json', { type: 'application/json' }))
        expect(await screen.findByText(/Cannot open bad.json/)).toBeInTheDocument()

        vi.spyOn(window, 'confirm').mockReturnValue(true)
        await user.click(screen.getByRole('button', { name: 'Project menu' }))
        await act(() => user.click(screen.getByRole('menuitem', { name: 'New project' })))
        expect(useProjectStore.getState().project.settings.name).toBe('Scope Project')
    })
})
