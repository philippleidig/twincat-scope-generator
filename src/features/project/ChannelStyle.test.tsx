import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useProjectStore } from '@/state/projectStore'
import { ProjectPanel } from './ProjectPanel'

const channel = (i = 0) => useProjectStore.getState().project.scopeFiles[0].axisGroups[0].channels[i]
const row = (i = 0) => within(screen.getByRole('region', { name: 'Axis group Axis Group 1' })).getAllByRole('listitem')[i]

beforeEach(() => {
    useProjectStore.getState().reset()
    const s = useProjectStore.getState()
    s.addChannels(s.project.scopeFiles[0].axisGroups[0].id, [{ symbol: 'GVL.aAxis[{i:01:12}].fActPos' }, { symbol: 'MAIN.x' }])
})

async function openEditor(i = 0) {
    const user = userEvent.setup()
    render(<ProjectPanel />)
    const toggle = within(row(i)).getByRole('button', { name: /^Name and colour/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    return user
}

describe('channel name and colour', () => {
    it('sets a name with counters and shows the effective names', async () => {
        const user = await openEditor()
        const name = within(row()).getByLabelText('Display name')
        // Empty: the effective name (the symbol path) is the placeholder.
        expect(name).toHaveAttribute('placeholder', 'GVL.aAxis[01].fActPos')
        expect(within(row()).getByText('Counters: {i}')).toBeInTheDocument()
        await user.type(name, 'Axis {{i} pos')
        expect(channel().name).toBe('Axis {i} pos')
        expect(within(row()).getByText('→ Axis 01 pos … Axis 12 pos (12)')).toBeInTheDocument()
        expect(name).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('shows an error for unknown counters', async () => {
        const user = await openEditor(1)
        const name = within(row(1)).getByLabelText('Display name')
        await user.type(name, 'X {{i}')
        expect(within(row(1)).getByRole('alert')).toHaveTextContent('Unknown counter {i}: the symbol path has no counters')
        expect(name).toHaveAttribute('aria-invalid', 'true')
        // Collapsed, the row shows the (invalid) name.
        await user.click(within(row(1)).getByRole('button', { name: /^Name and colour/ }))
        expect(within(row(1)).getByTitle('Display name')).toHaveClass('channel__name--invalid')
    })

    it('clears the name when emptied', async () => {
        const user = await openEditor(1)
        const name = within(row(1)).getByLabelText('Display name')
        await user.type(name, 'X')
        expect(channel(1).name).toBe('X')
        await user.clear(name)
        expect(channel(1)).not.toHaveProperty('name')
    })

    it('picks palette, custom and automatic colours', async () => {
        const user = await openEditor()
        const picker = within(row()).getByRole('group', { name: 'Colour' })
        expect(within(picker).getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
        await user.click(within(picker).getByRole('button', { name: 'Red' }))
        expect(channel().color).toBe('#ff0000')
        expect(within(picker).getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true')
        expect(within(row()).getByRole('button', { name: /^Name and colour/ })).toHaveStyle({ background: '#ff0000' })

        fireEvent.change(within(picker).getByLabelText('Custom colour'), { target: { value: '#ABCDEF' } })
        expect(channel().color).toBe('#abcdef')

        await user.click(within(picker).getByRole('button', { name: 'Auto' }))
        expect(channel()).not.toHaveProperty('color')

        // Black stays reachable while the native input shows black for Auto.
        await user.click(within(picker).getByRole('button', { name: 'Black' }))
        expect(channel().color).toBe('#000000')
    })

    it('names the name and colour in the toggle', async () => {
        const user = await openEditor()
        const toggle = within(row()).getByRole('button', { name: /^Name and colour/ })
        expect(toggle).toHaveAccessibleName('Name and colour (no name, automatic colour)')
        await user.type(within(row()).getByLabelText('Display name'), ' Axis {{i}')
        await user.click(within(row()).getByRole('button', { name: 'Red' }))
        // The name is kept as typed, leading space included.
        expect(channel().name).toBe(' Axis {i}')
        expect(toggle).toHaveAccessibleName('Name and colour ( Axis {i}, Red)')
    })

    it('offers "same colour for all" only for coloured patterns', async () => {
        const user = await openEditor()
        expect(within(row()).queryByLabelText('Same colour for all')).not.toBeInTheDocument()
        await user.click(within(row()).getByRole('button', { name: 'Blue' }))
        await user.click(within(row()).getByLabelText('Same colour for all'))
        expect(channel().colorMode).toBe('same')
        await user.click(within(row()).getByLabelText('Same colour for all'))
        expect(channel()).not.toHaveProperty('colorMode')
        // Back to Auto drops "same colour for all" with the colour.
        await user.click(within(row()).getByLabelText('Same colour for all'))
        await user.click(within(row()).getByRole('button', { name: 'Auto' }))
        expect(channel()).not.toHaveProperty('colorMode')

        await user.click(within(row(1)).getByRole('button', { name: /^Name and colour/ }))
        await user.click(within(row(1)).getByRole('button', { name: 'Blue' }))
        expect(within(row(1)).queryByLabelText('Same colour for all')).not.toBeInTheDocument()
    })
})
