import { test, expect } from '@playwright/test'

test.describe('TwinCAT Scope Generator', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/')
    })

    test('should display the header', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('TwinCAT Scope Generator')
    })

    test('should show global settings section', async ({ page }) => {
        await expect(page.getByText('Global Settings')).toBeVisible()
        await expect(page.getByLabel('Project Name')).toBeVisible()
        await expect(page.getByLabel('AMS Net ID')).toBeVisible()
    })

    test('should have a default scope file', async ({ page }) => {
        await expect(page.getByDisplayValue('Scope_1')).toBeVisible()
        await expect(page.getByText('.tcscopex')).toBeVisible()
    })

    test('should add a new scope file', async ({ page }) => {
        await page.getByRole('button', { name: /add file/i }).click()
        await expect(page.getByDisplayValue('Scope_2')).toBeVisible()
    })

    test('should configure symbol template', async ({ page }) => {
        const input = page.getByPlaceholder(/App\.mover/)
        await input.fill('App.mover[{i:1:5}].position')
        await expect(page.getByText(/5 acquisition/)).toBeVisible()
    })

    test('should validate invalid counter syntax', async ({ page }) => {
        const input = page.getByPlaceholder(/App\.mover/)
        await input.fill('App.item[{n:10:5}]')
        await expect(page.getByText(/start \(10\) must be <= end \(5\)/)).toBeVisible()
    })

    test('should add pattern to a file', async ({ page }) => {
        await page.getByRole('button', { name: /add pattern/i }).click()
        await expect(page.getByText('Pattern 2')).toBeVisible()
    })

    test('should add symbol to pattern', async ({ page }) => {
        await page.getByRole('button', { name: /add symbol/i }).click()
        const inputs = page.getByPlaceholder(/App\.mover/)
        await expect(inputs).toHaveCount(2)
    })

    test('should enable download button when patterns are valid', async ({ page }) => {
        const downloadButton = page.getByRole('button', { name: /download zip/i })

        // Initially may be disabled if no valid patterns
        const input = page.getByPlaceholder(/App\.mover/)
        await input.fill('App.value')

        // Download should be enabled
        await expect(downloadButton).toBeEnabled()
    })

    test('should display example patterns', async ({ page }) => {
        await expect(page.getByText('Example Patterns')).toBeVisible()
        await expect(page.getByText(/Click to copy/)).toBeVisible()
    })

    test('should show syntax help', async ({ page }) => {
        await expect(page.getByText('{name:start:end}')).toBeVisible()
    })

    test('should persist configuration in localStorage', async ({ page }) => {
        // Update file name
        const fileNameInput = page.getByDisplayValue('Scope_1')
        await fileNameInput.fill('TestFile')

        // Add symbol template
        const symbolInput = page.getByPlaceholder(/App\.mover/)
        await symbolInput.fill('Test.Symbol')

        // Reload page
        await page.reload()

        // Verify persistence
        await expect(page.getByDisplayValue('TestFile')).toBeVisible()
        await expect(page.getByDisplayValue('Test.Symbol')).toBeVisible()
    })

    test('should change data type', async ({ page }) => {
        const select = page.locator('select').first()
        await select.selectOption('INT32')
        await expect(select).toHaveValue('INT32')
    })
})
