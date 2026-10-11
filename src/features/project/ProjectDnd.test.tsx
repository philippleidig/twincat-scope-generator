import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { allChannels } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import { useToasts } from '@/state/toastStore'
import { AXIS_GROUP_MIME, CHANNEL_MIME } from '@/state/projectDrag'
import { ProjectPanel } from './ProjectPanel'

/** A DataTransfer stand-in: jsdom has none. */
function transfer() {
    const data = new Map<string, string>()
    return {
        types: [] as string[],
        dropEffect: 'none',
        effectAllowed: 'all',
        getData: (type: string) => data.get(type) ?? '',
        setData(type: string, value: string) {
            if (!data.has(type)) this.types.push(type)
            data.set(type, value)
        },
        setDragImage: vi.fn(),
    }
}

const project = () => useProjectStore.getState().project
const symbols = (fileIndex = 0, groupIndex = 0) => project().scopeFiles[fileIndex].axisGroups[groupIndex].channels.map((c) => c.symbol)
const groupNames = (fileIndex = 0) => project().scopeFiles[fileIndex].axisGroups.map((a) => a.name)
const card = (name: string) => screen.getByRole('region', { name: `Axis group ${name}` })
const rows = (name: string) => within(card(name)).getAllByRole('listitem')
const handleOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.drag-handle')!

interface DragInit {
    dataTransfer: unknown
    clientY?: number
    ctrlKey?: boolean
}

/** jsdom has no DragEvent, so mouse properties are set on the plain event by hand. */
function drag(type: 'dragOver' | 'drop', el: HTMLElement, { dataTransfer, clientY = 0, ctrlKey = false }: DragInit) {
    const event = createEvent[type](el, { dataTransfer })
    Object.defineProperties(event, { clientY: { value: clientY }, ctrlKey: { value: ctrlKey }, altKey: { value: false } })
    fireEvent(el, event)
}

/** Starts a drag on a channel row (or axis group card) by its handle and returns the transfer. */
function dragStart(el: HTMLElement) {
    const dataTransfer = transfer()
    fireEvent.dragStart(handleOf(el), { dataTransfer })
    return dataTransfer
}

beforeEach(() => {
    useProjectStore.getState().reset()
    useToasts.setState({ toasts: [] })
    // Channel row i spans y = 26i … 26i + 20 (6px gaps between rows); everything else y = 0 … 20.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const index = this instanceof HTMLElement ? Number(this.dataset.channelIndex ?? 0) : 0
        return DOMRect.fromRect({ x: 0, y: index * 26, width: 100, height: 20 })
    })
    const s = useProjectStore.getState()
    const fileId = s.project.scopeFiles[0].id
    s.addChannels(s.project.scopeFiles[0].axisGroups[0].id, [{ symbol: 'a' }, { symbol: 'b' }, { symbol: 'c' }])
    s.addAxisGroup(fileId)
    s.addChannels(project().scopeFiles[0].axisGroups[1].id, [{ symbol: 'd' }])
    s.addScopeFile()
})

afterEach(() => vi.restoreAllMocks())

describe('dragging channels', () => {
    it('puts the channel id on the drag as JSON under its own type', () => {
        render(<ProjectPanel />)
        const dataTransfer = dragStart(rows('Axis Group 1')[1])
        expect(dataTransfer.types).toEqual([CHANNEL_MIME])
        expect(JSON.parse(dataTransfer.getData(CHANNEL_MIME))).toEqual({ channelId: project().scopeFiles[0].axisGroups[0].channels[1].id })
        expect(dataTransfer.effectAllowed).toBe('copyMove')
        expect(dataTransfer.setDragImage).toHaveBeenCalledWith(rows('Axis Group 1')[1], 16, 16)
    })

    it('reorders within an axis group with an indicator line', () => {
        render(<ProjectPanel />)
        const dataTransfer = dragStart(rows('Axis Group 1')[2])
        const target = within(rows('Axis Group 1')[0]).getByLabelText('Symbol path')
        drag('dragOver', target, { dataTransfer, clientY: 5 })
        expect(rows('Axis Group 1')[0]).toHaveAttribute('data-drop', 'before')
        expect(dataTransfer.dropEffect).toBe('move')
        drag('dragOver', target, { dataTransfer, clientY: 15 })
        expect(rows('Axis Group 1')[0]).not.toHaveAttribute('data-drop')
        expect(rows('Axis Group 1')[1]).toHaveAttribute('data-drop', 'before')
        drag('drop', target, { dataTransfer, clientY: 15 })
        expect(symbols()).toEqual(['a', 'c', 'b'])
        expect(rows('Axis Group 1')[1]).not.toHaveAttribute('data-drop')
        expect(useToasts.getState().toasts[0].message).toBe('Moved channel to Scope_1 › Axis Group 1')
    })

    it('drops in the gap between two rows at that position', () => {
        render(<ProjectPanel />)
        const dataTransfer = dragStart(rows('Axis Group 1')[0])
        const list = within(card('Axis Group 1')).getByRole('list')
        drag('dragOver', list, { dataTransfer, clientY: 49 })
        expect(rows('Axis Group 1')[2]).toHaveAttribute('data-drop', 'before')
        expect(screen.queryByText('Move to Axis Group 1')).not.toBeInTheDocument()
        drag('drop', list, { dataTransfer, clientY: 49 })
        expect(symbols()).toEqual(['b', 'a', 'c'])
    })

    it('clears the indicator when the drag is cancelled', () => {
        render(<ProjectPanel />)
        const dataTransfer = dragStart(rows('Axis Group 1')[0])
        drag('dragOver', rows('Axis Group 1')[2], { dataTransfer, clientY: 60 })
        expect(rows('Axis Group 1')[2]).toHaveAttribute('data-drop', 'before')
        fireEvent.dragEnd(document)
        expect(rows('Axis Group 1')[2]).not.toHaveAttribute('data-drop')
        expect(symbols()).toEqual(['a', 'b', 'c'])
    })

    it('moves into another axis group at the indicated position or appended on the header', () => {
        render(<ProjectPanel />)
        let dataTransfer = dragStart(rows('Axis Group 1')[0])
        drag('dragOver', rows('Axis Group 2')[0], { dataTransfer, clientY: 5 })
        drag('drop', rows('Axis Group 2')[0], { dataTransfer, clientY: 5 })
        expect(symbols(0, 0)).toEqual(['b', 'c'])
        expect(symbols(0, 1)).toEqual(['a', 'd'])

        dataTransfer = dragStart(rows('Axis Group 1')[0])
        const header = within(card('Axis Group 2')).getByLabelText('Axis group name')
        drag('dragOver', header, { dataTransfer })
        expect(within(card('Axis Group 2')).getByText('Move to Axis Group 2')).toBeInTheDocument()
        drag('drop', header, { dataTransfer })
        expect(symbols(0, 1)).toEqual(['a', 'd', 'b'])
    })

    it('moves to another file via its tab (appended to its first axis group)', () => {
        render(<ProjectPanel />)
        const tab = screen.getByRole('tab', { name: /Scope_2/ })
        const dataTransfer = dragStart(rows('Axis Group 1')[1])
        drag('dragOver', tab, { dataTransfer })
        expect(tab).toHaveClass('file-tab--drop')
        drag('drop', tab, { dataTransfer })
        expect(tab).not.toHaveClass('file-tab--drop')
        expect(symbols(0, 0)).toEqual(['a', 'c'])
        expect(symbols(1, 0)).toEqual(['b'])
        expect(useToasts.getState().toasts[0].message).toBe('Moved channel to Scope_2 › Axis Group 1')
        expect(tab).toHaveAttribute('aria-selected', 'false')
    })

    it('copies with new ids while Ctrl is held and shows a "+" badge', () => {
        render(<ProjectPanel />)
        const dataTransfer = dragStart(rows('Axis Group 1')[0])
        drag('dragOver', rows('Axis Group 1')[2], { dataTransfer, clientY: 70, ctrlKey: true })
        expect(rows('Axis Group 1')[2]).toHaveAttribute('data-drop-copy')
        expect(dataTransfer.dropEffect).toBe('copy')
        drag('drop', rows('Axis Group 1')[2], { dataTransfer, clientY: 70, ctrlKey: true })
        expect(symbols()).toEqual(['a', 'b', 'c', 'a'])
        expect(new Set(allChannels(project()).map((c) => c.id)).size).toBe(5)

        const tab = screen.getByRole('tab', { name: /Scope_2/ })
        const toTab = dragStart(rows('Axis Group 2')[0])
        drag('dragOver', tab, { dataTransfer: toTab, ctrlKey: true })
        expect(within(tab).getByText('+')).toBeInTheDocument()
        drag('drop', tab, { dataTransfer: toTab, ctrlKey: true })
        expect(symbols(0, 1)).toEqual(['d'])
        expect(symbols(1, 0)).toEqual(['d'])
        expect(useToasts.getState().toasts.at(-1)?.message).toBe('Copied channel to Scope_2 › Axis Group 1')
    })

    it('inserts Target Browser symbols at the row they are dropped on', () => {
        render(<ProjectPanel />)
        const xml = '<TargetBrowserExportInfo><Symbols><Symbol><Name>MAIN.q</Name><BaseType>BOOL</BaseType></Symbol></Symbols></TargetBrowserExportInfo>'
        const dataTransfer = { types: ['text/plain'], getData: () => xml, dropEffect: '' }
        drag('dragOver', rows('Axis Group 1')[1], { dataTransfer, clientY: 30 })
        drag('drop', rows('Axis Group 1')[1], { dataTransfer, clientY: 30 })
        expect(symbols()).toEqual(['a', 'MAIN.q', 'b', 'c'])
    })

    it('ignores drops with a broken payload', () => {
        render(<ProjectPanel />)
        const before = project()
        const dataTransfer = { types: [CHANNEL_MIME], getData: () => '{nope', dropEffect: '' }
        drag('drop', rows('Axis Group 1')[0], { dataTransfer })
        drag('drop', screen.getByRole('tab', { name: /Scope_2/ }), { dataTransfer })
        expect(project()).toBe(before)
    })
})

describe('dragging axis groups', () => {
    it('reorders within the file', () => {
        render(<ProjectPanel />)
        const dataTransfer = dragStart(card('Axis Group 2'))
        expect(dataTransfer.types).toEqual([AXIS_GROUP_MIME])
        drag('dragOver', card('Axis Group 1'), { dataTransfer, clientY: 5 })
        expect(card('Axis Group 1')).toHaveAttribute('data-drop', 'before')
        drag('drop', card('Axis Group 1'), { dataTransfer, clientY: 5 })
        expect(groupNames()).toEqual(['Axis Group 2', 'Axis Group 1'])
    })

    it('moves or copies to another file via its tab', () => {
        render(<ProjectPanel />)
        const tab = screen.getByRole('tab', { name: /Scope_2/ })
        let dataTransfer = dragStart(card('Axis Group 2'))
        drag('dragOver', tab, { dataTransfer, ctrlKey: true })
        drag('drop', tab, { dataTransfer, ctrlKey: true })
        expect(groupNames(1)).toEqual(['Axis Group 1', 'Axis Group 2'])
        expect(groupNames(0)).toEqual(['Axis Group 1', 'Axis Group 2'])

        dataTransfer = dragStart(card('Axis Group 2'))
        drag('drop', tab, { dataTransfer })
        expect(groupNames(0)).toEqual(['Axis Group 1'])
        expect(groupNames(1)).toEqual(['Axis Group 1', 'Axis Group 2', 'Axis Group 2'])
        expect(useToasts.getState().toasts.at(-1)?.message).toBe('Moved axis group to Scope_2')
    })

    it('does not accept channels on the tab of a file without axis groups', () => {
        const s = useProjectStore.getState()
        s.removeAxisGroup(project().scopeFiles[1].axisGroups[0].id)
        render(<ProjectPanel />)
        const tab = screen.getByRole('tab', { name: /Scope_2/ })
        const dataTransfer = dragStart(rows('Axis Group 1')[0])
        drag('dragOver', tab, { dataTransfer })
        expect(tab).not.toHaveClass('file-tab--drop')
        drag('drop', tab, { dataTransfer })
        expect(symbols()).toEqual(['a', 'b', 'c'])
    })
})

describe('"Move to…" menus', () => {
    it('moves a channel up, down and to another axis group', async () => {
        const user = userEvent.setup()
        render(<ProjectPanel />)
        await user.click(within(rows('Axis Group 1')[0]).getByRole('button', { name: 'Move channel to…' }))
        expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeDisabled()
        await user.click(screen.getByRole('menuitem', { name: 'Move down' }))
        expect(symbols()).toEqual(['b', 'a', 'c'])
        // Focus stays on the moved row's menu button for further keyboard moves.
        expect(within(rows('Axis Group 1')[1]).getByRole('button', { name: 'Move channel to…' })).toHaveFocus()

        await user.click(within(rows('Axis Group 1')[1]).getByRole('button', { name: 'Move channel to…' }))
        await user.click(screen.getByRole('menuitem', { name: 'Move up' }))
        expect(symbols()).toEqual(['a', 'b', 'c'])

        await user.click(within(rows('Axis Group 1')[2]).getByRole('button', { name: 'Move channel to…' }))
        expect(screen.getByRole('menuitem', { name: 'Move down' })).toBeDisabled()
        expect(screen.queryByRole('menuitem', { name: 'Move to Scope_1 › Axis Group 1' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('menuitem', { name: 'Move to Scope_2 › Axis Group 1' }))
        expect(symbols(1, 0)).toEqual(['c'])
    })

    it('keeps focus on a channel moved to another axis group, or on the tab of its new file', async () => {
        const user = userEvent.setup()
        render(<ProjectPanel />)
        await user.click(within(rows('Axis Group 1')[0]).getByRole('button', { name: 'Move channel to…' }))
        await user.click(screen.getByRole('menuitem', { name: 'Move to Scope_1 › Axis Group 2' }))
        expect(symbols(0, 1)).toEqual(['d', 'a'])
        await waitFor(() => expect(within(rows('Axis Group 2')[1]).getByRole('button', { name: 'Move channel to…' })).toHaveFocus())

        await user.click(within(rows('Axis Group 2')[1]).getByRole('button', { name: 'Move channel to…' }))
        await user.click(screen.getByRole('menuitem', { name: 'Move to Scope_2 › Axis Group 1' }))
        await waitFor(() => expect(screen.getByRole('tab', { name: /Scope_2/ })).toHaveFocus())
    })

    it('moves an axis group up, down and to another file', async () => {
        const user = userEvent.setup()
        render(<ProjectPanel />)
        await user.click(within(card('Axis Group 1')).getByRole('button', { name: 'Move axis group to…' }))
        expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeDisabled()
        await user.click(screen.getByRole('menuitem', { name: 'Move down' }))
        expect(groupNames()).toEqual(['Axis Group 2', 'Axis Group 1'])

        await user.click(within(card('Axis Group 1')).getByRole('button', { name: 'Move axis group to…' }))
        await user.click(screen.getByRole('menuitem', { name: 'Move up' }))
        expect(groupNames()).toEqual(['Axis Group 1', 'Axis Group 2'])

        await user.click(within(card('Axis Group 1')).getByRole('button', { name: 'Move axis group to…' }))
        await user.click(screen.getByRole('menuitem', { name: 'Move to Scope_2' }))
        expect(groupNames(0)).toEqual(['Axis Group 2'])
        expect(groupNames(1)).toEqual(['Axis Group 1', 'Axis Group 1'])
        await waitFor(() => expect(screen.getByRole('tab', { name: /Scope_2/ })).toHaveFocus())
    })

    it('can be used with the keyboard and names untitled files like the tabs', async () => {
        const user = userEvent.setup()
        useProjectStore.getState().updateScopeFile(project().scopeFiles[1].id, { name: '' })
        render(<ProjectPanel />)
        const trigger = within(rows('Axis Group 1')[0]).getByRole('button', { name: 'Move channel to…' })
        trigger.focus()
        await user.keyboard('{Enter}')
        expect(screen.getByRole('menuitem', { name: 'Move to Untitled › Axis Group 1' })).toBeInTheDocument()
        await user.keyboard('{Escape}')
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()
    })
})
