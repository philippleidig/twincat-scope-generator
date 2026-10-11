/**
 * How a channel shows up in TwinCAT Scope: its display name and its colour.
 *
 * A display name may insert the symbol template's counters as `{i}` (no range), so
 * `Axis {i} ActPos` with `GVL.aAxis[{i:1:4}].fActPos` names the acquisitions "Axis 1 ActPos" …
 * "Axis 4 ActPos" (counters keep the template's zero padding). A pattern channel with a colour
 * colours its acquisitions with consecutive palette colours starting at that colour, unless
 * `colorMode` is `'same'`. Channels without a colour get palette colours by position on export.
 */
import type { Expansion } from './pattern'
import { COUNTER_REF, expandTemplateValues, expansionAt, hasCounterDefinition, parseCounters } from './pattern'

/**
 * The style fields of a channel, as stored: every field is either absent or well-formed
 * (see `normalizeChannelStyle`).
 */
export interface ChannelStyle {
    /** Display name; may insert the template's counters as `{i}`. Absent: the symbol name. */
    name?: string
    /** Lower-case `#rrggbb`. Absent: a palette colour by position, assigned on export. */
    color?: string
    /** A pattern channel's acquisitions all get `color` (only stored with a colour). Absent: consecutive palette colours. */
    colorMode?: 'same'
}

/** What the style rules need to know about a channel. */
type StyledChannel = ChannelStyle & { symbol: string }

export interface PaletteColor {
    color: string
    label: string
}

/**
 * Colours offered by the picker, as lower-case `#rrggbb`. The first eight are the colours the
 * exporter assigns to channels without a colour (TwinCAT's own defaults), in that order.
 */
export const CHANNEL_PALETTE: readonly PaletteColor[] = [
    { color: '#008000', label: 'Green' },
    { color: '#0000ff', label: 'Blue' },
    { color: '#ff0000', label: 'Red' },
    { color: '#ffff00', label: 'Yellow' },
    { color: '#00ffff', label: 'Cyan' },
    { color: '#ff00ff', label: 'Magenta' },
    { color: '#ffa500', label: 'Orange' },
    { color: '#800080', label: 'Purple' },
    { color: '#000080', label: 'Navy' },
    { color: '#808000', label: 'Olive' },
    { color: '#008080', label: 'Teal' },
    { color: '#800000', label: 'Maroon' },
    { color: '#00ff00', label: 'Lime' },
    { color: '#ff69b4', label: 'Pink' },
    { color: '#a52a2a', label: 'Brown' },
    { color: '#808080', label: 'Grey' },
    { color: '#000000', label: 'Black' },
    { color: '#ffffff', label: 'White' },
]

/** Palette colours assigned to channels without a colour, cycling by position in the axis group. */
export const AUTO_COLOR_COUNT = 8

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/**
 * The style fields of untrusted input (an edit, a project file) in their stored form: a name only
 * when it is a non-empty string (kept as typed), a colour only as lower-case `#rrggbb`, and
 * `colorMode: 'same'` only together with a colour.
 */
export function normalizeChannelStyle(raw: { name?: unknown; color?: unknown; colorMode?: unknown }): ChannelStyle {
    const style: ChannelStyle = {}
    if (typeof raw.name === 'string' && raw.name !== '') style.name = raw.name
    if (typeof raw.color === 'string' && HEX_COLOR.test(raw.color)) {
        style.color = raw.color.toLowerCase()
        if (raw.colorMode === 'same') style.colorMode = 'same'
    }
    return style
}

/** The automatic colour of the acquisition at `index` of an axis group. */
export const autoColor = (index: number): string => CHANNEL_PALETTE[index % AUTO_COLOR_COUNT].color

/**
 * Colour of acquisition `k` of a channel: its colour for k = 0 (and for every k with `'same'`),
 * then the palette colours after it (from the palette's start when the colour is not in it).
 */
function acquisitionColor({ color, colorMode }: ChannelStyle, k: number): string | undefined {
    if (color === undefined || k === 0 || colorMode === 'same') return color
    const at = CHANNEL_PALETTE.findIndex((p) => p.color === color)
    return CHANNEL_PALETTE[(at === -1 ? k - 1 : at + k) % CHANNEL_PALETTE.length].color
}

/** True when the channel has a display name (blank counts as none). */
export const hasDisplayName = (channel: Pick<ChannelStyle, 'name'>): boolean => !!channel.name?.trim()

/** Why a channel's display name cannot be used (it then exports the symbol name), or null when it can or there is none. */
export function channelNameError(channel: Pick<StyledChannel, 'name' | 'symbol'>): string | null {
    const { name, symbol } = channel
    if (name === undefined || !hasDisplayName(channel)) return null
    if (hasCounterDefinition(name)) return 'Use a counter without its range, e.g. {i} — the range comes from the symbol path'
    if (/[{}]/.test(name.replace(COUNTER_REF, ''))) return 'Insert a counter as {name}, e.g. {i}'
    const known = parseCounters(symbol).map((c) => c.name)
    for (const [, counter] of name.matchAll(COUNTER_REF)) {
        if (known.includes(counter)) continue
        return known.length === 0
            ? `Unknown counter {${counter}}: the symbol path has no counters`
            : `Unknown counter {${counter}}: the symbol path has ${known.map((c) => `{${c}}`).join(', ')}`
    }
    return null
}

/** Counters a display name can use, as `{i}`, for hints. */
export const nameCounterHints = (symbol: string): string[] => parseCounters(symbol).map((c) => `{${c.name}}`)

/** One acquisition of a channel as it is exported. */
export interface ExpandedAcquisition {
    symbolName: string
    /** The channel's display name with counters filled in; the symbol name without a (usable) name. */
    displayName: string
    /** True when `displayName` comes from the channel's display name. */
    customName: boolean
    /** `#rrggbb`, or undefined when the channel has no colour (the exporter assigns one by position). */
    color?: string
}

/** The name usable for export, or null. */
const usableName = ({ name, symbol }: StyledChannel): string | null =>
    name !== undefined && hasDisplayName({ name }) && channelNameError({ name, symbol }) === null ? name : null

function acquisition(channel: StyledChannel, name: string | null, { symbol, values }: Expansion, k: number): ExpandedAcquisition {
    return {
        symbolName: symbol,
        displayName: name === null ? symbol : name.replace(COUNTER_REF, (_, c: string) => values.get(c)!),
        customName: name !== null,
        color: acquisitionColor(channel, k),
    }
}

/** Every acquisition a channel expands to, with its display name and colour. Invalid templates expand to nothing. */
export function expandChannel(channel: StyledChannel): ExpandedAcquisition[] {
    const name = usableName(channel)
    return expandTemplateValues(channel.symbol).map((e, k) => acquisition(channel, name, e, k))
}

/** Acquisition `index` of a channel alone (for previews, without expanding the rest); null when there is none. */
export function expandChannelAt(channel: StyledChannel, index: number): ExpandedAcquisition | null {
    const e = expansionAt(channel.symbol, index)
    return e && acquisition(channel, usableName(channel), e, index)
}
