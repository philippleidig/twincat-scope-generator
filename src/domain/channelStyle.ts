/**
 * How a channel shows up in TwinCAT Scope: its display name and its colour.
 *
 * A display name may insert the symbol template's counters as `{i}` (no range), so
 * `Axis {i} ActPos` with `GVL.aAxis[{i:1:4}].fActPos` names the acquisitions "Axis 1 ActPos" …
 * "Axis 4 ActPos" (counters keep the template's zero padding). A pattern channel with a colour
 * colours its acquisitions with consecutive palette colours starting at that colour, unless
 * `colorMode` is `'same'`. Channels without a colour get palette colours on export.
 */
import type { Channel } from './project'
import { expandTemplateValues, parseCounters } from './pattern'

/**
 * Colours offered by the picker, as `#rrggbb`. The first eight are the colours the exporter
 * assigns to channels without a colour (TwinCAT's own defaults), in that order.
 */
export const CHANNEL_PALETTE: readonly string[] = [
    '#008000', // green
    '#0000ff', // blue
    '#ff0000', // red
    '#ffff00', // yellow
    '#00ffff', // cyan
    '#ff00ff', // magenta
    '#ffa500', // orange
    '#800080', // purple
    '#000080', // navy
    '#808000', // olive
    '#008080', // teal
    '#800000', // maroon
    '#00ff00', // lime
    '#ff69b4', // pink
    '#a52a2a', // brown
    '#808080', // grey
]

/** Palette colours assigned to channels without a colour, cycling by position in the axis group. */
export const AUTO_COLOR_COUNT = 8

export type ColorMode = 'palette' | 'same'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX_COLOR.test(value)

/** `#rrggbb` in lower case (as `<input type="color">` reports it). */
export const normalizeColor = (hex: string): string => hex.toLowerCase()

/** The automatic colour of the acquisition at `index` of an axis group. */
export const autoColor = (index: number): string => CHANNEL_PALETTE[index % AUTO_COLOR_COUNT]

/**
 * Colour of acquisition `k` of a channel coloured `color`: the colour itself for k = 0, then the
 * palette colours after it (from the palette's start when the colour is not in the palette).
 */
export function paletteColor(color: string, k: number, mode: ColorMode = 'palette'): string {
    if (k === 0 || mode === 'same') return normalizeColor(color)
    const at = CHANNEL_PALETTE.indexOf(normalizeColor(color))
    const i = at === -1 ? k - 1 : at + k
    return CHANNEL_PALETTE[i % CHANNEL_PALETTE.length]
}

/** `{name}` in a display name; `{name:1:4}` (a range) and stray braces are errors. */
const NAME_COUNTER = /\{(\w+)\}/g
const RANGED_COUNTER = /\{\w+:-?\d+:-?\d+\}/

/** True when the channel has a display name (blank counts as none). */
export const hasDisplayName = (channel: Pick<Channel, 'name'>): boolean => !!channel.name?.trim()

/** Error message for a display name against its symbol template, or null when it is fine. */
export function displayNameError(name: string, symbol: string): string | null {
    if (RANGED_COUNTER.test(name)) return 'Use a counter without its range, e.g. {i} — the range comes from the symbol path'
    if (/[{}]/.test(name.replace(NAME_COUNTER, ''))) return 'Insert a counter as {name}, e.g. {i}'
    const known = new Set(parseCounters(symbol).map((c) => c.name))
    for (const [, counter] of name.matchAll(NAME_COUNTER)) {
        if (known.has(counter)) continue
        return known.size === 0
            ? `Unknown counter {${counter}}: the symbol path has no counters`
            : `Unknown counter {${counter}}: the symbol path has ${[...known].map((c) => `{${c}}`).join(', ')}`
    }
    return null
}

/** Counters a display name can use, as `{i}`, for hints. */
export const nameCounterHints = (symbol: string): string[] => parseCounters(symbol).map((c) => `{${c.name}}`)

/** One acquisition of a channel as it is exported. */
export interface ExpandedAcquisition {
    symbolName: string
    /** The channel's display name with counters filled in; the symbol name without (or with an invalid) name. */
    displayName: string
    /** `#rrggbb`, or undefined when the channel has no colour (the exporter assigns one). */
    color?: string
}

/** Every acquisition a channel expands to, with its display name and colour. Invalid templates expand to nothing. */
export function expandChannel(channel: Pick<Channel, 'symbol' | 'name' | 'color' | 'colorMode'>): ExpandedAcquisition[] {
    const name = hasDisplayName(channel) && displayNameError(channel.name!, channel.symbol) === null ? channel.name! : null
    const color = isHexColor(channel.color) ? channel.color : undefined
    return expandTemplateValues(channel.symbol).map(({ symbol, values }, k) => ({
        symbolName: symbol,
        displayName: name === null ? symbol : name.replace(NAME_COUNTER, (_, c: string) => values.get(c)!),
        color: color && paletteColor(color, k, channel.colorMode),
    }))
}
