import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DownloadButton } from '@/components/DownloadButton'
import { useConfigStore } from '@/stores/configStore'

// Mock the zip archiver module
vi.mock('@/lib/zip', () => ({
    createZipArchive: vi.fn().mockResolvedValue(new Blob(['mock-zip-content'])),
    downloadBlob: vi.fn(),
}))

import { createZipArchive, downloadBlob } from '@/lib/zip'

describe('DownloadButton Component', () => {
    beforeEach(() => {
        useConfigStore.getState().resetAll()
        vi.clearAllMocks()
    })

    describe('initial state', () => {
        it('should render download button', () => {
            render(<DownloadButton />)

            expect(screen.getByRole('button', { name: /download zip/i })).toBeInTheDocument()
        })

        it('should be disabled when no valid patterns exist', () => {
            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            expect(button).toBeDisabled()
        })

        it('should show hint when disabled', () => {
            render(<DownloadButton />)

            expect(screen.getByText(/add symbols to enable download/i)).toBeInTheDocument()
        })
    })

    describe('with valid patterns', () => {
        beforeEach(() => {
            // Set up a valid pattern
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                template: 'MAIN.value[{n:1:3}]',
            })
        })

        it('should enable button when valid pattern exists', () => {
            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            expect(button).not.toBeDisabled()
        })

        it('should not show hint when enabled', () => {
            render(<DownloadButton />)

            expect(screen.queryByText(/add symbols to enable download/i)).not.toBeInTheDocument()
        })

        it('should call zip functions on click', async () => {
            const user = userEvent.setup()
            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            await user.click(button)

            await waitFor(() => {
                expect(createZipArchive).toHaveBeenCalled()
                expect(downloadBlob).toHaveBeenCalled()
            })
        })

        it('should download with correct filename', async () => {
            const user = userEvent.setup()
            useConfigStore.getState().updateGlobalSettings({ projectName: 'My Test Project' })

            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            await user.click(button)

            await waitFor(() => {
                expect(downloadBlob).toHaveBeenCalledWith(
                    expect.any(Blob),
                    'My_Test_Project_scope_config.zip'
                )
            })
        })

        it('should show generating state during download', async () => {
            const user = userEvent.setup()

            // Delay the mock to test loading state
            vi.mocked(createZipArchive).mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve(new Blob()), 100))
            )

            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            await user.click(button)

            // Should show generating state
            expect(screen.getByText(/generating/i)).toBeInTheDocument()

            // Wait for completion
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /download zip/i })).toBeInTheDocument()
            })
        })

        it('should disable button while generating', async () => {
            const user = userEvent.setup()

            // Delay the mock
            vi.mocked(createZipArchive).mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve(new Blob()), 100))
            )

            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            await user.click(button)

            // Button should be disabled during generation
            const generatingButton = screen.getByRole('button')
            expect(generatingButton).toBeDisabled()

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /download zip/i })).not.toBeDisabled()
            })
        })
    })

    describe('validation', () => {
        it('should remain disabled with empty template', () => {
            render(<DownloadButton />)

            expect(screen.getByRole('button', { name: /download zip/i })).toBeDisabled()
        })

        it('should remain disabled with whitespace-only template', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                template: '   ',
            })

            render(<DownloadButton />)

            expect(screen.getByRole('button', { name: /download zip/i })).toBeDisabled()
        })

        it('should remain disabled with invalid template', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                template: 'Item[{n:10:5}]', // Invalid: start > end
            })

            render(<DownloadButton />)

            expect(screen.getByRole('button', { name: /download zip/i })).toBeDisabled()
        })

        it('should enable with at least one valid template among multiple', () => {
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id

            // Add a second symbol
            useConfigStore.getState().addSymbol(fileId, patternId)

            const symbols = useConfigStore.getState().scopeFiles[0].patterns[0].symbols

            // First symbol invalid
            useConfigStore.getState().updateSymbol(fileId, patternId, symbols[0].id, {
                template: 'Item[{n:10:5}]',
            })

            // Second symbol valid
            useConfigStore.getState().updateSymbol(fileId, patternId, symbols[1].id, {
                template: 'Valid.Template',
            })

            render(<DownloadButton />)

            expect(screen.getByRole('button', { name: /download zip/i })).not.toBeDisabled()
        })
    })

    describe('error handling', () => {
        it('should show error message on generation failure', async () => {
            const user = userEvent.setup()

            // Set up valid pattern
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                template: 'MAIN.value',
            })

            // Mock error
            vi.mocked(createZipArchive).mockRejectedValueOnce(new Error('Generation failed'))

            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            await user.click(button)

            await waitFor(() => {
                expect(screen.getByText('Generation failed')).toBeInTheDocument()
            })
        })

        it('should show generic error for non-Error exceptions', async () => {
            const user = userEvent.setup()

            // Set up valid pattern
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                template: 'MAIN.value',
            })

            // Mock non-Error rejection
            vi.mocked(createZipArchive).mockRejectedValueOnce('Some string error')

            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            await user.click(button)

            await waitFor(() => {
                expect(screen.getByText('Failed to generate files')).toBeInTheDocument()
            })
        })

        it('should clear error on successful retry', async () => {
            const user = userEvent.setup()

            // Set up valid pattern
            const fileId = useConfigStore.getState().scopeFiles[0].id
            const patternId = useConfigStore.getState().scopeFiles[0].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[0].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(fileId, patternId, symbolId, {
                template: 'MAIN.value',
            })

            // First call fails
            vi.mocked(createZipArchive).mockRejectedValueOnce(new Error('First failure'))

            render(<DownloadButton />)

            const button = screen.getByRole('button', { name: /download zip/i })
            await user.click(button)

            await waitFor(() => {
                expect(screen.getByText('First failure')).toBeInTheDocument()
            })

            // Reset mock for success
            vi.mocked(createZipArchive).mockResolvedValueOnce(new Blob(['success']))

            // Click again
            await user.click(button)

            await waitFor(() => {
                expect(screen.queryByText('First failure')).not.toBeInTheDocument()
            })
        })
    })

    describe('multiple files', () => {
        it('should enable download when any file has valid pattern', () => {
            // Add second file
            useConfigStore.getState().addScopeFile()

            // Set valid template in second file
            const secondFileId = useConfigStore.getState().scopeFiles[1].id
            const patternId = useConfigStore.getState().scopeFiles[1].patterns[0].id
            const symbolId = useConfigStore.getState().scopeFiles[1].patterns[0].symbols[0].id

            useConfigStore.getState().updateSymbol(secondFileId, patternId, symbolId, {
                template: 'Valid.Template',
            })

            render(<DownloadButton />)

            expect(screen.getByRole('button', { name: /download zip/i })).not.toBeDisabled()
        })
    })
})
