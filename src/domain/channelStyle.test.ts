import { describe, expect, it } from 'vitest'
import {
    CHANNEL_PALETTE,
    autoColor,
    displayNameError,
    expandChannel,
    hasDisplayName,
    isHexColor,
    nameCounterHints,
    paletteColor,
} from './channelStyle'

describe('display names', () => {
    it('fills counters with the template values, keeping their padding', () => {
        const names = expandChannel({ symbol: 'GVL.aAxis[{i:1:3}].fActPos', name: 'Axis {i} ActPos' })
        expect(names.map((a) => [a.symbolName, a.displayName])).toEqual([
            ['GVL.aAxis[1].fActPos', 'Axis 1 ActPos'],
            ['GVL.aAxis[2].fActPos', 'Axis 2 ActPos'],
            ['GVL.aAxis[3].fActPos', 'Axis 3 ActPos'],
        ])
        expect(expandChannel({ symbol: 'M.a{i:08:10}', name: 'A{i}' }).map((a) => a.displayName)).toEqual(['A08', 'A09', 'A10'])
    })

    it('uses several counters and repeats', () => {
        const names = expandChannel({ symbol: 'M.a[{i:1:2},{j:0:1}]', name: '{j}/{i} ({i})' }).map((a) => a.displayName)
        expect(names).toEqual(['0/1 (1)', '1/1 (1)', '0/2 (2)', '1/2 (2)'])
    })

    it('falls back to the symbol name without, with a blank or with an invalid name', () => {
        expect(expandChannel({ symbol: 'MAIN.x' })[0].displayName).toBe('MAIN.x')
        expect(expandChannel({ symbol: 'MAIN.x', name: '  ' })[0].displayName).toBe('MAIN.x')
        expect(expandChannel({ symbol: 'MAIN.x', name: 'X {k}' })[0].displayName).toBe('MAIN.x')
        expect(expandChannel({ symbol: 'MAIN.x', name: 'Speed' })[0].displayName).toBe('Speed')
        expect(hasDisplayName({ name: ' ' })).toBe(false)
    })

    it('expands invalid templates to nothing', () => {
        expect(expandChannel({ symbol: 'broken{', name: 'x', color: '#ff0000' })).toEqual([])
    })

    it('reports unknown counters, ranges and stray braces', () => {
        expect(displayNameError('Axis {i}', 'A[{i:1:2}]')).toBeNull()
        expect(displayNameError('Plain', 'A')).toBeNull()
        expect(displayNameError('Axis {j}', 'A[{i:1:2}]')).toBe('Unknown counter {j}: the symbol path has {i}')
        expect(displayNameError('Axis {i}', 'A')).toBe('Unknown counter {i}: the symbol path has no counters')
        expect(displayNameError('Axis {i:1:2}', 'A[{i:1:2}]')).toMatch(/without its range/)
        expect(displayNameError('Axis {i', 'A[{i:1:2}]')).toMatch(/Insert a counter as \{name\}/)
        expect(nameCounterHints('A[{i:1:2}].b[{j:0:1}]')).toEqual(['{i}', '{j}'])
    })
})

describe('colours', () => {
    it('validates #rrggbb', () => {
        expect(isHexColor('#00ff00')).toBe(true)
        expect(isHexColor('#00FF00')).toBe(true)
        expect(isHexColor('red')).toBe(false)
        expect(isHexColor('#0f0')).toBe(false)
        expect(isHexColor(3)).toBe(false)
    })

    it('continues the palette from the chosen colour and wraps', () => {
        const last = CHANNEL_PALETTE.length - 1
        expect(paletteColor(CHANNEL_PALETTE[last - 1], 0)).toBe(CHANNEL_PALETTE[last - 1])
        expect(paletteColor(CHANNEL_PALETTE[last - 1], 1)).toBe(CHANNEL_PALETTE[last])
        expect(paletteColor(CHANNEL_PALETTE[last - 1], 2)).toBe(CHANNEL_PALETTE[0])
        expect(paletteColor('#FF0000', 1)).toBe('#ffff00')
    })

    it('starts at the palette start after a colour not in the palette', () => {
        expect([0, 1, 2].map((k) => paletteColor('#123456', k))).toEqual(['#123456', CHANNEL_PALETTE[0], CHANNEL_PALETTE[1]])
    })

    it('keeps one colour with "same"', () => {
        const colors = expandChannel({ symbol: 'A[{i:1:3}]', color: '#123456', colorMode: 'same' }).map((a) => a.color)
        expect(colors).toEqual(['#123456', '#123456', '#123456'])
    })

    it('colours pattern channels with consecutive palette colours', () => {
        const colors = expandChannel({ symbol: 'A[{i:1:3}]', color: '#0000ff' }).map((a) => a.color)
        expect(colors).toEqual(['#0000ff', '#ff0000', '#ffff00'])
        expect(expandChannel({ symbol: 'A' })[0].color).toBeUndefined()
    })

    it('assigns the first eight palette colours automatically', () => {
        expect([0, 7, 8].map(autoColor)).toEqual(['#008000', '#800080', '#008000'])
    })
})
