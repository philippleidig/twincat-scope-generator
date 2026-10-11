/** How channel colours are shown in the editor. */
import { CHANNEL_PALETTE, autoColor } from '@/domain/channelStyle'

/** Background of a swatch standing for "automatic colour": the first automatic colours as a wheel. */
export const AUTO_SWATCH = `conic-gradient(${[0, 1, 2, 3].map((i) => `${autoColor(i)} ${i * 25}% ${(i + 1) * 25}%`).join(', ')})`

/** A colour as people read it: the palette name ("Red"), the hex value, or "automatic colour". */
export function describeColor(color: string | undefined): string {
    if (!color) return 'automatic colour'
    return CHANNEL_PALETTE.find((p) => p.color === color)?.label ?? color
}
