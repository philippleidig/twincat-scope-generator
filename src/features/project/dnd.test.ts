import { afterEach, describe, expect, it, vi } from 'vitest'
import { dropAttrs, isCopyDrag, rowAt } from './dnd'

afterEach(() => vi.restoreAllMocks())

describe('dnd', () => {
    it('copies with Ctrl, or with Option on macOS', () => {
        expect(isCopyDrag({ ctrlKey: true, altKey: false })).toBe(true)
        expect(isCopyDrag({ ctrlKey: false, altKey: true })).toBe(false)
        vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
        expect(isCopyDrag({ ctrlKey: false, altKey: true })).toBe(true)
        expect(isCopyDrag({ ctrlKey: true, altKey: false })).toBe(false)
    })

    it('finds the row a drop over a list refers to, also in the gaps', () => {
        const list = document.createElement('ul')
        for (let i = 0; i < 3; i++) {
            const li = document.createElement('li')
            li.dataset.channelIndex = String(i)
            vi.spyOn(li, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: i * 26, height: 20 }))
            list.append(li)
        }
        expect(rowAt(list, 2)).toEqual({ row: 0, edge: 'before' })
        expect(rowAt(list, 23)).toEqual({ row: 1, edge: 'before' })
        expect(rowAt(list, 99)).toEqual({ row: 2, edge: 'after' })
        expect(rowAt(document.createElement('ul'), 0)).toBeNull()
    })

    it('draws the "+" only on an indicated, copying drop', () => {
        expect(dropAttrs('before', true)).toEqual({ 'data-drop': 'before', 'data-drop-copy': '' })
        expect(dropAttrs(undefined, true)).toEqual({ 'data-drop': undefined, 'data-drop-copy': undefined })
    })
})
