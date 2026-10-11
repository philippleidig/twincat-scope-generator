import { describe, expect, it } from 'vitest'
import { CHANNEL_PALETTE, autoColor, channelNameError, expandChannel, expandChannelAt, hasDisplayName, nameCounterHints, normalizeChannelStyle } from './channelStyle'

const colors = (symbol: string, color: string, colorMode?: 'same') => expandChannel({ symbol, color, colorMode }).map((a) => a.color)

describe('display names', () => {
    it('fills counters with the template values, keeping their padding', () => {
        const names = expandChannel({ symbol: 'GVL.aAxis[{i:1:3}].fActPos', name: 'Axis {i} ActPos' })
        expect(names.map((a) => [a.symbolName, a.displayName, a.customName])).toEqual([
            ['GVL.aAxis[1].fActPos', 'Axis 1 ActPos', true],
            ['GVL.aAxis[2].fActPos', 'Axis 2 ActPos', true],
            ['GVL.aAxis[3].fActPos', 'Axis 3 ActPos', true],
        ])
        expect(expandChannel({ symbol: 'M.a{i:08:10}', name: 'A{i}' }).map((a) => a.displayName)).toEqual(['A08', 'A09', 'A10'])
    })

    it('uses several counters and repeats', () => {
        const names = expandChannel({ symbol: 'M.a[{i:1:2},{j:0:1}]', name: '{j}/{i} ({i})' }).map((a) => a.displayName)
        expect(names).toEqual(['0/1 (1)', '1/1 (1)', '0/2 (2)', '1/2 (2)'])
    })

    it('falls back to the symbol name without, with a blank or with an unusable name', () => {
        const first = (name?: string) => expandChannel({ symbol: 'MAIN.x', name })[0]
        expect(first()).toMatchObject({ displayName: 'MAIN.x', customName: false })
        expect(first('  ')).toMatchObject({ displayName: 'MAIN.x', customName: false })
        expect(first('X {k}')).toMatchObject({ displayName: 'MAIN.x', customName: false })
        expect(first('MAIN.x')).toMatchObject({ displayName: 'MAIN.x', customName: true })
        expect(hasDisplayName({ name: ' ' })).toBe(false)
    })

    it('expands invalid templates to nothing', () => {
        expect(expandChannel({ symbol: 'broken{', name: 'x', color: '#ff0000' })).toEqual([])
        expect(expandChannelAt({ symbol: 'broken{' }, 0)).toBeNull()
    })

    it('expands one acquisition alone, like the full expansion', () => {
        const channel = { symbol: 'M.a[{i:1:3},{j:0:1}]', name: 'A{i}.{j}', color: '#0000ff' }
        const all = expandChannel(channel)
        expect(all.map((_, k) => expandChannelAt(channel, k))).toEqual(all)
        expect(expandChannelAt(channel, all.length)).toBeNull()
    })

    it('says why a name cannot be used', () => {
        expect(channelNameError({ name: 'Axis {i}', symbol: 'A[{i:1:2}]' })).toBeNull()
        expect(channelNameError({ name: 'Plain', symbol: 'A' })).toBeNull()
        expect(channelNameError({ symbol: 'A' })).toBeNull()
        expect(channelNameError({ name: ' {x} ', symbol: 'A' })).toMatch(/Unknown counter/)
        expect(channelNameError({ name: '  ', symbol: 'A' })).toBeNull()
        expect(channelNameError({ name: 'Axis {j}', symbol: 'A[{i:1:2}]' })).toBe('Unknown counter {j}: the symbol path has {i}')
        expect(channelNameError({ name: 'Axis {i}', symbol: 'A' })).toBe('Unknown counter {i}: the symbol path has no counters')
        expect(channelNameError({ name: 'Axis {i:1:2}', symbol: 'A[{i:1:2}]' })).toMatch(/without its range/)
        expect(channelNameError({ name: 'Axis {i', symbol: 'A[{i:1:2}]' })).toMatch(/Insert a counter as \{name\}/)
        expect(nameCounterHints('A[{i:1:2}].b[{j:0:1}]')).toEqual(['{i}', '{j}'])
    })
})

describe('normalizeChannelStyle', () => {
    it('keeps well-formed fields only, colours in lower case', () => {
        expect(normalizeChannelStyle({ name: ' Axis', color: '#AABBCC', colorMode: 'same' })).toEqual({ name: ' Axis', color: '#aabbcc', colorMode: 'same' })
        expect(normalizeChannelStyle({ name: '', color: 'red', colorMode: 'same' })).toEqual({})
        expect(normalizeChannelStyle({ name: 3, color: '#0f0', colorMode: 'palette' })).toEqual({})
        expect(normalizeChannelStyle({ color: '#000000', colorMode: 'palette' })).toEqual({ color: '#000000' })
    })
})

describe('colours', () => {
    const palette = CHANNEL_PALETTE.map((p) => p.color)

    it('continues the palette from the chosen colour and wraps', () => {
        const last = palette.length - 1
        expect(colors('A[{i:1:3}]', palette[last - 1])).toEqual([palette[last - 1], palette[last], palette[0]])
        expect(colors('A[{i:1:3}]', '#0000ff')).toEqual(['#0000ff', '#ff0000', '#ffff00'])
    })

    it('starts at the palette start after a colour not in the palette', () => {
        expect(colors('A[{i:1:3}]', '#123456')).toEqual(['#123456', palette[0], palette[1]])
    })

    it('keeps one colour with "same"', () => {
        expect(colors('A[{i:1:3}]', '#123456', 'same')).toEqual(['#123456', '#123456', '#123456'])
    })

    it('leaves channels without a colour to the exporter', () => {
        expect(expandChannel({ symbol: 'A' })[0].color).toBeUndefined()
    })

    it('assigns the first eight palette colours automatically', () => {
        expect([0, 7, 8].map(autoColor)).toEqual(['#008000', '#800080', '#008000'])
    })
})
