import { CHANNEL_PALETTE } from '@/domain/channelStyle'

interface ColorPickerProps {
    /** Lower-case `#rrggbb`, or undefined for the automatic colour. */
    value: string | undefined
    onChange: (color: string | undefined) => void
}

/** "Auto" (no colour), the palette, and a native colour input for any other colour. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
    return (
        <div className="color-picker" role="group" aria-label="Colour">
            <button
                type="button"
                className="color-picker__auto"
                aria-pressed={!value}
                title="Automatic: a palette colour by position"
                onClick={() => onChange(undefined)}
            >
                Auto
            </button>
            {CHANNEL_PALETTE.map(({ color, label }) => (
                <button
                    key={color}
                    type="button"
                    className="color-swatch"
                    style={{ background: color }}
                    aria-label={label}
                    title={`${label} ${color}`}
                    aria-pressed={value === color}
                    onClick={() => onChange(color)}
                />
            ))}
            {/* While on Auto the input shows black; black is in the palette, so it stays reachable. */}
            <input
                type="color"
                className="color-picker__custom"
                aria-label="Custom colour"
                title="Custom colour"
                value={value ?? '#000000'}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    )
}
