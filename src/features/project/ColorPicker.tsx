import { CHANNEL_PALETTE, normalizeColor } from '@/domain/channelStyle'

interface ColorPickerProps {
    /** `#rrggbb`, or undefined for the automatic colour. */
    value: string | undefined
    onChange: (color: string | undefined) => void
}

/** Palette swatches, a native colour input for any other colour, and "Auto" (no colour). */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
    const current = value && normalizeColor(value)
    return (
        <div className="color-picker" role="group" aria-label="Colour">
            <button
                type="button"
                className="color-picker__auto"
                aria-pressed={!current}
                title="Automatic: a palette colour by position"
                onClick={() => onChange(undefined)}
            >
                Auto
            </button>
            {CHANNEL_PALETTE.map((color) => (
                <button
                    key={color}
                    type="button"
                    className="color-swatch"
                    style={{ background: color }}
                    aria-label={`Colour ${color}`}
                    title={color}
                    aria-pressed={current === color}
                    onClick={() => onChange(color)}
                />
            ))}
            <input
                type="color"
                className="color-picker__custom"
                aria-label="Custom colour"
                title="Custom colour"
                value={current ?? '#000000'}
                onChange={(e) => onChange(normalizeColor(e.target.value))}
            />
        </div>
    )
}
