import { test, expect } from '@playwright/test'

test.describe('TwinCAT Scope Generator', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/')
        await page.evaluate(() => localStorage.clear())
        await page.reload()
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
        await expect(page.getByLabel('Scope file name')).toHaveValue('Scope_1')
        await expect(page.locator('.file-ext')).toHaveText('.tcscopex')
    })

    test('should label each level of the hierarchy', async ({ page }) => {
        await expect(page.locator('.level-kicker--file')).toHaveText('Scope File')
        await expect(page.locator('.level-kicker--group')).toHaveText('Axis Group')
        await expect(page.getByText('Pattern 1')).toBeVisible()
    })

    test('should add a new scope file', async ({ page }) => {
        await page.getByRole('button', { name: /add file/i }).click()
        await expect(page.getByLabel('Scope file name')).toHaveCount(2)
        await expect(page.getByLabel('Scope file name').nth(1)).toHaveValue('Scope_2')
    })

    test('should configure symbol template', async ({ page }) => {
        const input = page.getByPlaceholder(/MAIN\.mover/)
        await input.fill('MAIN.mover[{i:1:5}].position')
        await expect(page.getByText(/5 acquisition/).first()).toBeVisible()
    })

    test('should validate invalid counter syntax', async ({ page }) => {
        const input = page.getByPlaceholder(/MAIN\.mover/)
        await input.fill('MAIN.item[{n:10:5}]')
        await expect(page.getByText(/start \(10\) must be <= end \(5\)/)).toBeVisible()
    })

    test('should add pattern to an axis group', async ({ page }) => {
        await page.getByRole('button', { name: /add pattern/i }).click()
        await expect(page.getByText('Pattern 2')).toBeVisible()
    })

    test('should add axis group to a file', async ({ page }) => {
        await page.getByRole('button', { name: /add axis group/i }).click()
        await expect(page.getByLabel('Axis group name')).toHaveCount(2)
        await expect(page.getByLabel('Axis group name').nth(1)).toHaveValue('Axis Group 2')
    })

    test('should add symbol to pattern', async ({ page }) => {
        await page.getByRole('button', { name: /add symbol/i }).click()
        await expect(page.getByPlaceholder(/MAIN\.mover/)).toHaveCount(2)
    })

    test('should collapse and expand an axis group', async ({ page }) => {
        await page.getByPlaceholder(/MAIN\.mover/).fill('MAIN.mover[{i:1:5}].position')

        const collapse = page.getByRole('button', { name: 'Collapse Axis Group 1' })
        await collapse.click()

        // Contents are hidden, but the header still summarises the group.
        await expect(page.getByPlaceholder(/MAIN\.mover/)).toHaveCount(0)
        await expect(page.getByText('1 pattern')).toBeVisible()
        await expect(page.getByText('5 acq.')).toBeVisible()

        await page.getByRole('button', { name: 'Expand Axis Group 1' }).click()
        await expect(page.getByPlaceholder(/MAIN\.mover/)).toHaveCount(1)
    })

    test('should enable download button when patterns are valid', async ({ page }) => {
        const downloadButton = page.getByRole('button', { name: /download zip/i })

        await page.getByPlaceholder(/MAIN\.mover/).fill('MAIN.value')

        await expect(downloadButton).toBeEnabled()
    })

    test('should display sample patterns', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Sample Patterns' })).toBeVisible()
    })

    test('should show syntax help', async ({ page }) => {
        await expect(page.getByText('{name:start:end}')).toBeVisible()
    })

    // Note: only the sample-pattern store is persisted (zustand `persist`).
    // The scope configuration itself lives in memory and is lost on reload.
    test('should persist sample patterns in localStorage', async ({ page }) => {
        await page.getByTitle('Add new sample').click()
        await page.getByPlaceholder('Pattern template...').fill('MAIN.persisted[{i:1:2}]')
        await page.getByRole('button', { name: 'Add', exact: true }).click()

        await page.reload()

        await expect(page.getByText('MAIN.persisted[{i:1:2}]')).toBeVisible()
    })

    test('should change data type', async ({ page }) => {
        const select = page.locator('.symbol-input-row select').first()
        await select.selectOption('INT32')
        await expect(select).toHaveValue('INT32')
    })
})
