import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScopeFileManager } from '@/components/ScopeFileManager'
import { useConfigStore } from '@/stores/configStore'

describe('ScopeFileManager Component', () => {
    beforeEach(() => {
        useConfigStore.getState().resetAll()
    })

    // Helpers
    const getFirstAxisGroup = () => useConfigStore.getState().scopeFiles[0].axisGroups[0]
    const getFirstPattern = () => getFirstAxisGroup().patterns[0]

    describe('initial rendering', () => {
        it('should render with one default file', () => {
            render(<ScopeFileManager />)

            expect(screen.getByDisplayValue('Scope_1')).toBeInTheDocument()
            expect(screen.getByText('.tcscopex')).toBeInTheDocument()
        })

        it('should render section header', () => {
            render(<ScopeFileManager />)

            expect(screen.getByRole('heading', { name: /scope files/i })).toBeInTheDocument()
        })

        it('should show Axis Group 1 and Pattern 1 label', () => {
            render(<ScopeFileManager />)

            expect(screen.getByDisplayValue('Axis Group 1')).toBeInTheDocument()
            expect(screen.getByText('Pattern 1')).toBeInTheDocument()
        })
    })

    describe('file operations', () => {
        it('should add a new scope file', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add file/i }))

            expect(screen.getByDisplayValue('Scope_2')).toBeInTheDocument()
            expect(useConfigStore.getState().scopeFiles).toHaveLength(2)
        })

        it('should update file name', () => {
            render(<ScopeFileManager />)

            const input = screen.getByDisplayValue('Scope_1')
            fireEvent.change(input, { target: { value: 'MoverData' } })

            expect(useConfigStore.getState().scopeFiles[0].name).toBe('MoverData')
        })

        it('should remove a file when multiple files exist', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add file/i }))
            expect(useConfigStore.getState().scopeFiles).toHaveLength(2)

            const removeButtons = screen.getAllByTitle('Remove File')
            await user.click(removeButtons[0])

            expect(useConfigStore.getState().scopeFiles).toHaveLength(1)
            expect(screen.getByDisplayValue('Scope_2')).toBeInTheDocument()
        })

        it('should not show remove button for single file', () => {
            render(<ScopeFileManager />)

            expect(screen.queryByTitle('Remove File')).not.toBeInTheDocument()
        })

        it('should duplicate a file', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Test.Value' } })

            await user.click(screen.getByTitle('Duplicate File'))

            expect(useConfigStore.getState().scopeFiles).toHaveLength(2)
            expect(useConfigStore.getState().scopeFiles[1].name).toBe('Scope_1_copy')
            expect(useConfigStore.getState().scopeFiles[1].axisGroups[0].patterns[0].symbols[0].template).toBe('Test.Value')
        })
    })

    describe('axis group operations', () => {
        it('should add an axis group', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add axis group/i }))

            expect(useConfigStore.getState().scopeFiles[0].axisGroups).toHaveLength(2)
            expect(screen.getByDisplayValue('Axis Group 2')).toBeInTheDocument()
        })

        it('should update axis group name', () => {
            render(<ScopeFileManager />)

            const input = screen.getByDisplayValue('Axis Group 1')
            fireEvent.change(input, { target: { value: 'Positions' } })

            expect(getFirstAxisGroup().name).toBe('Positions')
        })

        it('should duplicate an axis group', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByTitle('Duplicate Axis Group'))

            expect(useConfigStore.getState().scopeFiles[0].axisGroups).toHaveLength(2)
        })

        it('should remove an axis group when multiple exist', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add axis group/i }))
            expect(useConfigStore.getState().scopeFiles[0].axisGroups).toHaveLength(2)

            const removeButtons = screen.getAllByTitle('Remove Axis Group')
            await user.click(removeButtons[0])

            expect(useConfigStore.getState().scopeFiles[0].axisGroups).toHaveLength(1)
        })

        it('should not show remove button for single axis group', () => {
            render(<ScopeFileManager />)

            expect(screen.queryByTitle('Remove Axis Group')).not.toBeInTheDocument()
        })
    })

    describe('symbol operations', () => {
        it('should update symbol template', () => {
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Test.Symbol[{i:1:5}]' } })

            expect(getFirstPattern().symbols[0].template).toBe('Test.Symbol[{i:1:5}]')
        })

        it('should add symbol to pattern', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add symbol/i }))

            expect(getFirstPattern().symbols).toHaveLength(2)
        })

        it('should remove symbol when multiple symbols exist', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add symbol/i }))
            expect(getFirstPattern().symbols).toHaveLength(2)

            const removeButtons = screen.getAllByTitle('Remove Symbol')
            await user.click(removeButtons[0])

            expect(getFirstPattern().symbols).toHaveLength(1)
        })

        it('should update data type', () => {
            render(<ScopeFileManager />)

            const select = screen.getByDisplayValue('REAL64 (LREAL)')
            fireEvent.change(select, { target: { value: 'INT32' } })

            expect(getFirstPattern().symbols[0].dataType).toBe('INT32')
            expect(getFirstPattern().symbols[0].variableSize).toBe(4)
        })
    })

    describe('pattern operations', () => {
        it('should add pattern to axis group', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add pattern/i }))

            expect(getFirstAxisGroup().patterns).toHaveLength(2)
            expect(screen.getByText('Pattern 2')).toBeInTheDocument()
        })

        it('should remove pattern when multiple patterns exist', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add pattern/i }))
            expect(getFirstAxisGroup().patterns).toHaveLength(2)

            const removeButtons = screen.getAllByTitle('Remove Pattern')
            await user.click(removeButtons[0])

            expect(getFirstAxisGroup().patterns).toHaveLength(1)
        })

        it('should duplicate pattern', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Original.Value' } })

            await user.click(screen.getByTitle('Duplicate Pattern'))

            expect(getFirstAxisGroup().patterns).toHaveLength(2)
            expect(getFirstAxisGroup().patterns[1].symbols[0].template).toBe('Original.Value')
        })

        it('should change port using preset dropdown', () => {
            render(<ScopeFileManager />)

            const select = screen.getByDisplayValue('851 - PLC 1')
            fireEvent.change(select, { target: { value: '852' } })

            expect(getFirstPattern().targetPort).toBe(852)
        })
    })

    describe('validation and display', () => {
        it('should show expansion count for valid template', () => {
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Item[{n:1:10}]' } })

            const elements = screen.getAllByText(/10 acquisition/)
            expect(elements.length).toBeGreaterThan(0)
        })

        it('should show validation error for invalid template', () => {
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Item[{n:10:5}]' } })

            expect(screen.getByText(/start \(10\) must be <= end \(5\)/)).toBeInTheDocument()
        })

        it('should show total acquisitions for file', () => {
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Item[{n:1:5}]' } })

            expect(screen.getByText('5 acquisitions')).toBeInTheDocument()
        })

        it('should not show acquisition count for empty template', () => {
            render(<ScopeFileManager />)

            expect(screen.queryByText(/acquisition/)).not.toBeInTheDocument()
        })

        it('should handle template with mismatched braces', () => {
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Item[{n:1:5]' } })

            expect(screen.getByText(/Mismatched braces/)).toBeInTheDocument()
        })
    })

    describe('hierarchy display', () => {
        it('should label each level of the tree', () => {
            const { container } = render(<ScopeFileManager />)

            expect(container.querySelector('.level-kicker--file')).toHaveTextContent('Scope File')
            expect(container.querySelector('.level-kicker--group')).toHaveTextContent('Axis Group')
            expect(screen.getByText('Pattern 1')).toBeInTheDocument()
        })

        it('should show child counts per level', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            expect(screen.getByText('1 axis group')).toBeInTheDocument()
            expect(screen.getByText('1 pattern')).toBeInTheDocument()

            await user.click(screen.getByRole('button', { name: /add pattern/i }))

            expect(screen.getByText('2 patterns')).toBeInTheDocument()
        })
    })

    describe('collapsing', () => {
        it('should collapse and expand an axis group', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            expect(screen.getByText('Pattern 1')).toBeInTheDocument()

            await user.click(screen.getByRole('button', { name: 'Collapse Axis Group 1' }))
            expect(screen.queryByText('Pattern 1')).not.toBeInTheDocument()

            await user.click(screen.getByRole('button', { name: 'Expand Axis Group 1' }))
            expect(screen.getByText('Pattern 1')).toBeInTheDocument()
        })

        it('should collapse a scope file without losing its state', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Item[{n:1:5}]' } })

            await user.click(screen.getByRole('button', { name: 'Collapse Scope_1' }))

            expect(screen.queryByDisplayValue('Axis Group 1')).not.toBeInTheDocument()
            // The summary stays visible while collapsed.
            expect(screen.getByText('5 acquisitions')).toBeInTheDocument()

            await user.click(screen.getByRole('button', { name: 'Expand Scope_1' }))

            expect(screen.getByDisplayValue('Item[{n:1:5}]')).toBeInTheDocument()
        })

        it('should collapse a pattern', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: 'Collapse Pattern 1' }))

            expect(screen.queryByPlaceholderText(/MAIN\.mover/)).not.toBeInTheDocument()
            expect(screen.getByText('Pattern 1')).toBeInTheDocument()
        })
    })

    describe('multiple files interaction', () => {
        it('should maintain separate state for each file', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            const input1 = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input1, { target: { value: 'File1.Value' } })

            await user.click(screen.getByRole('button', { name: /add file/i }))

            const inputs = screen.getAllByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(inputs[1], { target: { value: 'File2.Value' } })

            expect(useConfigStore.getState().scopeFiles[0].axisGroups[0].patterns[0].symbols[0].template).toBe('File1.Value')
            expect(useConfigStore.getState().scopeFiles[1].axisGroups[0].patterns[0].symbols[0].template).toBe('File2.Value')
        })
    })
})
