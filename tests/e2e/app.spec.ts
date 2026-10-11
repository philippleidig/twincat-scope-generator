import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'

test.beforeEach(async ({ page }) => {
    await page.goto('./')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
})

test('starts with an empty browser and a default project', async ({ page }) => {
    await expect(page.getByText('Drop TwinCAT files here')).toBeVisible()
    await expect(page.getByLabel('Scope file name')).toHaveValue('Scope_1')
    await expect(page.getByRole('button', { name: /Export ZIP/ })).toBeDisabled()
})

test('builds a scope project offline from the demo machine and exports it', async ({ page }) => {
    await page.getByRole('button', { name: 'Try the demo machine' }).click()
    await page.getByLabel('Search symbols').fill('fActPos')
    await page.getByRole('option').getByRole('checkbox').check()
    await page.getByLabel('Search symbols').fill('fbConveyor')
    await page.getByRole('checkbox', { name: 'Select MAIN.fbConveyor', exact: true }).check()
    await page.getByRole('button', { name: /Add to scope/ }).click()

    await expect(page.getByLabel('Symbol path')).toHaveCount(6)
    await expect(page.getByLabel('Symbol path').first()).toHaveValue('GVL.aAxis[{i:1:4}].fActPos')

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /Export ZIP/ }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('Scope_Project_scope.zip')
    const zip = readFileSync((await file.path())!)
    expect(zip.subarray(0, 2).toString()).toBe('PK')
})

test('drags symbols from the browser onto an axis group', async ({ page }) => {
    await page.getByRole('button', { name: 'Try the demo machine' }).click()
    await page.getByRole('button', { name: 'Expand MAIN', exact: true }).click()
    await page.getByRole('treeitem', { name: /nCycle/ }).dragTo(page.getByRole('region', { name: 'Axis group Axis Group 1' }))
    await expect(page.getByLabel('Symbol path')).toHaveValue('MAIN.nCycle')
})

test('keeps the project across reloads', async ({ page }) => {
    await page.getByRole('button', { name: 'Add channel' }).click()
    await page.getByLabel('Symbol path').fill('MAIN.mover[{i:1:5}].position')
    await expect(page.getByText('×5')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Symbol path')).toHaveValue('MAIN.mover[{i:1:5}].position')
})

test('switches panes on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await expect(page.getByRole('region', { name: 'Symbol browser' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Scope project' })).toBeHidden()
    await page.getByRole('button', { name: 'Project', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Scope project' })).toBeVisible()
})

test('reorders channels by dragging and moves one to another file', async ({ page }) => {
    const symbols = page.getByLabel('Symbol path')
    const values = () => symbols.evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value))
    for (const symbol of ['MAIN.a', 'MAIN.b']) {
        await page.getByRole('button', { name: 'Add channel' }).click()
        await symbols.last().fill(symbol)
    }
    const rows = page.getByRole('region', { name: 'Axis group Axis Group 1' }).getByRole('listitem')
    await rows.nth(1).locator('.drag-handle').dragTo(rows.nth(0), { targetPosition: { x: 40, y: 2 } })
    await expect.poll(values).toEqual(['MAIN.b', 'MAIN.a'])

    await page.getByRole('button', { name: 'Add scope file' }).click()
    await page.getByRole('tab', { name: /Scope_1/ }).click()
    await rows.nth(0).locator('.drag-handle').dragTo(page.getByRole('tab', { name: /Scope_2/ }))
    await expect.poll(values).toEqual(['MAIN.a'])
    await page.getByRole('tab', { name: /Scope_2/ }).click()
    await expect.poll(values).toEqual(['MAIN.b'])
})

test('adds symbols picked in the flat list view', async ({ page }) => {
    await page.getByRole('button', { name: 'Try the demo machine' }).click()
    await page.getByRole('group', { name: 'Browser view' }).getByRole('button', { name: 'List' }).click()
    const list = page.getByRole('listbox', { name: 'Symbol list' })
    await list.getByRole('checkbox', { name: 'Select GVL.aAxis[{i:1:4}].fActPos', exact: true }).check()
    await list.getByRole('checkbox', { name: 'Select GVL.fCycleLoad', exact: true }).check()
    await page.getByRole('button', { name: /Add to scope/ }).click()

    await expect(page.getByLabel('Symbol path')).toHaveCount(2)
    await expect(page.getByLabel('Symbol path').first()).toHaveValue('GVL.aAxis[{i:1:4}].fActPos')

    // The choice survives a reload.
    await page.reload()
    await expect(page.getByRole('listbox', { name: 'Symbol list' })).toBeVisible()
})

test('names and colours a channel and exports both', async ({ page }) => {
    await page.getByRole('button', { name: 'Add channel' }).click()
    await page.getByLabel('Symbol path').fill('GVL.aAxis[{i:1:2}].fActPos')
    await page.getByRole('button', { name: /^Name and colour/ }).click()
    const name = page.getByLabel('Display name')
    await name.fill('Axis {j}')
    await expect(page.getByText('Unknown counter {j}: the symbol path has {i}')).toBeVisible()
    await name.fill('Axis {i} pos')
    await expect(page.getByText('→ Axis 1 pos … Axis 2 pos (2)')).toBeVisible()
    await page.getByRole('button', { name: 'Red', exact: true }).click()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /Export ZIP/ }).click()
    const zip = await JSZip.loadAsync(readFileSync((await (await download).path())!))
    const xml = await zip.file('Scope_1.tcscopex')!.async('string')
    expect(xml).toContain('<Name>Axis 1 pos</Name>')
    expect(xml).toContain('<Name>Axis 2 pos</Name>')
    expect(xml).toContain('<UsedNameType>Custom</UsedNameType>')
    expect(xml).toContain('<SymbolName>GVL.aAxis[1].fActPos</SymbolName>')
    // #ff0000, then the next palette colour (#ffff00), each in DisplayColor, SeriesStyle DisplayColor and MarkColor.
    expect(xml.match(/<MarkColor>-65536<\/MarkColor>/g)).toHaveLength(1)
    expect(xml.match(/<MarkColor>-256<\/MarkColor>/g)).toHaveLength(1)
    expect(xml.match(/<DisplayColor>-65536<\/DisplayColor>/g)).toHaveLength(2)
})
