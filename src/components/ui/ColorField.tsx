import { ACCOUNT_COLOR_PRESETS } from '@/lib/labels'

interface ColorFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="color-swatches">
        {ACCOUNT_COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-swatch${value === color ? ' active' : ''}`}
            style={{ background: color }}
            aria-label={`Color ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
          />
        ))}
        <label className="color-swatch color-swatch-custom" title="Color personalizado">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            aria-label="Elegir color"
          />
        </label>
      </div>
    </div>
  )
}
