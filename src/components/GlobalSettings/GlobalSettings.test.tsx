import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlobalSettings } from '@/components/GlobalSettings'
import { useConfigStore } from '@/stores/configStore'

describe('GlobalSettings Component', () => {
    beforeEach(() => {
        useConfigStore.getState().resetAll()
    })

    describe('rendering', () => {
        it('should render all form fields', () => {
            render(<GlobalSettings />)

            expect(screen.getByLabelText('Project Name')).toBeInTheDocument()
            expect(screen.getByLabelText('AMS Net ID')).toBeInTheDocument()
            expect(screen.getByLabelText('Main Server')).toBeInTheDocument()
            expect(screen.getByLabelText('Base Sample Time (100ns units)')).toBeInTheDocument()
        })

        it('should render with default values', () => {
            render(<GlobalSettings />)

            expect(screen.getByDisplayValue('Scope Project')).toBeInTheDocument()
            expect(screen.getAllByDisplayValue('127.0.0.1.1.1')).toHaveLength(2) // AMS Net ID and Main Server
            expect(screen.getByDisplayValue('100000')).toBeInTheDocument()
        })

        it('should display sample time in milliseconds', () => {
            render(<GlobalSettings />)

            // Default sample time is 100000 (10ms)
            expect(screen.getByText('= 10.00 ms')).toBeInTheDocument()
        })
    })

    describe('project name', () => {
        it('should update project name', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('Project Name')
            await user.clear(input)
            await user.type(input, 'My Custom Project')

            expect(useConfigStore.getState().globalSettings.projectName).toBe('My Custom Project')
        })

        it('should handle empty project name', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('Project Name')
            await user.clear(input)

            expect(useConfigStore.getState().globalSettings.projectName).toBe('')
        })

        it('should handle project name with special characters', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('Project Name')
            await user.clear(input)
            await user.type(input, 'Test_Project-2024')

            expect(useConfigStore.getState().globalSettings.projectName).toBe('Test_Project-2024')
        })
    })

    describe('AMS Net ID', () => {
        it('should update AMS Net ID', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('AMS Net ID')
            await user.clear(input)
            await user.type(input, '192.168.1.1.1.1')

            expect(useConfigStore.getState().globalSettings.amsNetId).toBe('192.168.1.1.1.1')
        })

        it('should show validation error for invalid AMS Net ID format', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('AMS Net ID')
            await user.clear(input)
            await user.type(input, 'invalid-format')

            expect(screen.getByText(/Format: IP-Adresse\.1\.1/)).toBeInTheDocument()
        })

        it('should show validation error for missing .1.1 suffix', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('AMS Net ID')
            await user.clear(input)
            await user.type(input, '192.168.1.1')

            expect(screen.getByText(/Format: IP-Adresse\.1\.1/)).toBeInTheDocument()
        })

        it('should not show error for valid AMS Net ID', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('AMS Net ID')
            await user.clear(input)
            await user.type(input, '10.0.0.1.1.1')

            expect(screen.queryByText(/Format: IP-Adresse\.1\.1/)).not.toBeInTheDocument()
        })
    })

    describe('Main Server', () => {
        it('should update Main Server', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('Main Server')
            await user.clear(input)
            await user.type(input, '192.168.0.100.1.1')

            expect(useConfigStore.getState().globalSettings.mainServer).toBe('192.168.0.100.1.1')
        })

        it('should show validation error for invalid Main Server format', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('Main Server')
            await user.clear(input)
            await user.type(input, 'bad-server')

            expect(screen.getByText(/Format: IP-Adresse\.1\.1/)).toBeInTheDocument()
        })
    })

    describe('Base Sample Time', () => {
        it('should update Base Sample Time', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('Base Sample Time (100ns units)')
            await user.clear(input)
            await user.type(input, '50000')

            expect(useConfigStore.getState().globalSettings.baseSampleTime).toBe(50000)
        })

        it('should display updated sample time in milliseconds', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('Base Sample Time (100ns units)')
            await user.clear(input)
            await user.type(input, '200000') // 20ms

            expect(screen.getByText('= 20.00 ms')).toBeInTheDocument()
        })

        it('should handle 0 sample time', async () => {
            const user = userEvent.setup()
            render(<GlobalSettings />)

            const input = screen.getByLabelText('Base Sample Time (100ns units)')
            await user.clear(input)
            await user.type(input, '0')

            expect(useConfigStore.getState().globalSettings.baseSampleTime).toBe(0)
            expect(screen.getByText('= 0.00 ms')).toBeInTheDocument()
        })
    })
})
