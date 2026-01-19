import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScopeFileManager } from '@/components/ScopeFileManager'
import { useConfigStore } from '@/stores/configStore'

describe('ScopeFileManager Component', () => {
    beforeEach(() => {
        useConfigStore.getState().resetAll()
    })

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

        it('should show Pattern 1 label', () => {
            render(<ScopeFileManager />)

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

            // Add a second file first
            await user.click(screen.getByRole('button', { name: /add file/i }))
            expect(useConfigStore.getState().scopeFiles).toHaveLength(2)

            // Find and click the remove button for the first file
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

            // Set a template first
            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Test.Value' } })

            // Click duplicate
            await user.click(screen.getByTitle('Duplicate File'))

            expect(useConfigStore.getState().scopeFiles).toHaveLength(2)
            expect(useConfigStore.getState().scopeFiles[1].name).toBe('Scope_1_copy')
            expect(useConfigStore.getState().scopeFiles[1].patterns[0].symbols[0].template).toBe('Test.Value')
        })
    })

    describe('symbol operations', () => {
        it('should update symbol template', () => {
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Test.Symbol[{i:1:5}]' } })

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].template).toBe(
                'Test.Symbol[{i:1:5}]'
            )
        })

        it('should add symbol to pattern', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add symbol/i }))

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols).toHaveLength(2)
        })

        it('should remove symbol when multiple symbols exist', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            // Add a second symbol
            await user.click(screen.getByRole('button', { name: /add symbol/i }))
            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols).toHaveLength(2)

            // Remove a symbol
            const removeButtons = screen.getAllByTitle('Remove Symbol')
            await user.click(removeButtons[0])

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols).toHaveLength(1)
        })

        it('should update data type', () => {
            render(<ScopeFileManager />)

            const select = screen.getByDisplayValue('REAL64 (LREAL)')
            fireEvent.change(select, { target: { value: 'INT32' } })

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].dataType).toBe('INT32')
            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].variableSize).toBe(4)
        })
    })

    describe('pattern operations', () => {
        it('should add pattern to file', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            await user.click(screen.getByRole('button', { name: /add pattern/i }))

            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(2)
            expect(screen.getByText('Pattern 2')).toBeInTheDocument()
        })

        it('should remove pattern when multiple patterns exist', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            // Add a second pattern first
            await user.click(screen.getByRole('button', { name: /add pattern/i }))
            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(2)

            // Remove a pattern
            const removeButtons = screen.getAllByTitle('Remove Pattern')
            await user.click(removeButtons[0])

            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(1)
        })

        it('should duplicate pattern', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            // Set a template in the pattern
            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Original.Value' } })

            // Click duplicate pattern
            await user.click(screen.getByTitle('Duplicate Pattern'))

            expect(useConfigStore.getState().scopeFiles[0].patterns).toHaveLength(2)
            expect(useConfigStore.getState().scopeFiles[0].patterns[1].symbols[0].template).toBe('Original.Value')
        })

        it('should change port using preset dropdown', () => {
            render(<ScopeFileManager />)

            // Find the port selector (should default to 851)
            const select = screen.getByDisplayValue('851 - PLC 1')
            fireEvent.change(select, { target: { value: '852' } })

            expect(useConfigStore.getState().scopeFiles[0].patterns[0].targetPort).toBe(852)
        })
    })

    describe('validation and display', () => {
        it('should show expansion count for valid template', () => {
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Item[{n:1:10}]' } })

            // May have multiple elements showing acquisition counts
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

            // Default template is empty, so no acquisition count should be shown
            expect(screen.queryByText(/acquisition/)).not.toBeInTheDocument()
        })

        it('should handle template with mismatched braces', () => {
            render(<ScopeFileManager />)

            const input = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input, { target: { value: 'Item[{n:1:5]' } })

            expect(screen.getByText(/Mismatched braces/)).toBeInTheDocument()
        })
    })

    describe('multiple files interaction', () => {
        it('should maintain separate state for each file', async () => {
            const user = userEvent.setup()
            render(<ScopeFileManager />)

            // Set template in first file
            const input1 = screen.getByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(input1, { target: { value: 'File1.Value' } })

            // Add second file
            await user.click(screen.getByRole('button', { name: /add file/i }))

            // Set template in second file
            const inputs = screen.getAllByPlaceholderText(/MAIN\.mover/)
            fireEvent.change(inputs[1], { target: { value: 'File2.Value' } })

            // Verify both templates are stored correctly
            expect(useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].template).toBe('File1.Value')
            expect(useConfigStore.getState().scopeFiles[1].patterns[0].symbols[0].template).toBe('File2.Value')
        })
    })
})
