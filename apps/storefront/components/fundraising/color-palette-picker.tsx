'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface NamedColor {
  name: string
  hex: string
  family:
    | 'red'
    | 'orange'
    | 'amber'
    | 'yellow'
    | 'lime'
    | 'green'
    | 'teal'
    | 'cyan'
    | 'blue'
    | 'indigo'
    | 'violet'
    | 'purple'
    | 'pink'
    | 'rose'
    | 'neutral'
}

export const PALETTE: NamedColor[] = [
  // Red
  { name: 'Crimson',        hex: '#DC143C', family: 'red' },
  { name: 'Cherry Red',     hex: '#D2042D', family: 'red' },
  { name: 'Salsa Red',      hex: '#B91C1C', family: 'red' },
  { name: 'Firebrick',      hex: '#B22222', family: 'red' },
  { name: 'Ruby',           hex: '#E0115F', family: 'red' },
  // Orange
  { name: 'Tangerine',      hex: '#F28C28', family: 'orange' },
  { name: 'Pumpkin',        hex: '#FF7518', family: 'orange' },
  { name: 'Sunset Orange',  hex: '#FD5E53', family: 'orange' },
  { name: 'Coral',          hex: '#FF7F50', family: 'orange' },
  { name: 'Rust',           hex: '#B7410E', family: 'orange' },
  // Amber / Yellow
  { name: 'Amber',          hex: '#F59E0B', family: 'amber' },
  { name: 'Mustard',        hex: '#D4A017', family: 'amber' },
  { name: 'Goldenrod',      hex: '#DAA520', family: 'amber' },
  { name: 'Sunflower',      hex: '#FFC312', family: 'yellow' },
  { name: 'Lemon',          hex: '#FFF44F', family: 'yellow' },
  // Lime / Green
  { name: 'Lime',           hex: '#84CC16', family: 'lime' },
  { name: 'Chartreuse',     hex: '#DFFF00', family: 'lime' },
  { name: 'Verde',          hex: '#16A34A', family: 'green' },
  { name: 'Forest Green',   hex: '#228B22', family: 'green' },
  { name: 'Emerald',        hex: '#10B981', family: 'green' },
  { name: 'Sage',           hex: '#9CAF88', family: 'green' },
  { name: 'Mint',           hex: '#98FF98', family: 'green' },
  { name: 'Olive',          hex: '#808000', family: 'green' },
  // Teal / Cyan
  { name: 'Teal',           hex: '#14B8A6', family: 'teal' },
  { name: 'Pine',           hex: '#01796F', family: 'teal' },
  { name: 'Turquoise',      hex: '#40E0D0', family: 'cyan' },
  { name: 'Cyan',           hex: '#06B6D4', family: 'cyan' },
  { name: 'Sky Blue',       hex: '#38BDF8', family: 'cyan' },
  // Blue
  { name: 'Azure',          hex: '#3B82F6', family: 'blue' },
  { name: 'Royal Blue',     hex: '#2563EB', family: 'blue' },
  { name: 'Navy',           hex: '#0A2647', family: 'blue' },
  { name: 'Cobalt',          hex: '#0047AB', family: 'blue' },
  { name: 'Denim',          hex: '#1560BD', family: 'blue' },
  { name: 'Steel Blue',     hex: '#4682B4', family: 'blue' },
  // Indigo / Violet / Purple
  { name: 'Indigo',         hex: '#4F46E5', family: 'indigo' },
  { name: 'Midnight',       hex: '#191970', family: 'indigo' },
  { name: 'Violet',         hex: '#7C3AED', family: 'violet' },
  { name: 'Amethyst',       hex: '#9966CC', family: 'violet' },
  { name: 'Lavender',       hex: '#B57EDC', family: 'violet' },
  { name: 'Purple',         hex: '#A855F7', family: 'purple' },
  { name: 'Plum',           hex: '#8E4585', family: 'purple' },
  { name: 'Eggplant',       hex: '#614051', family: 'purple' },
  // Pink / Rose
  { name: 'Magenta',        hex: '#D946EF', family: 'pink' },
  { name: 'Hot Pink',       hex: '#FF69B4', family: 'pink' },
  { name: 'Bubblegum',      hex: '#FFC1CC', family: 'pink' },
  { name: 'Pink',           hex: '#EC4899', family: 'pink' },
  { name: 'Rose',           hex: '#F43F5E', family: 'rose' },
  { name: 'Blush',          hex: '#F8C8DC', family: 'rose' },
  { name: 'Dusty Rose',     hex: '#C08081', family: 'rose' },
  // Neutrals
  { name: 'Cream',          hex: '#FFFDD0', family: 'neutral' },
  { name: 'Ivory',          hex: '#FFFFF0', family: 'neutral' },
  { name: 'Sand',           hex: '#C2B280', family: 'neutral' },
  { name: 'Tan',            hex: '#D2B48C', family: 'neutral' },
  { name: 'Taupe',          hex: '#8B7D6B', family: 'neutral' },
  { name: 'Bronze',         hex: '#CD7F32', family: 'neutral' },
  { name: 'Chocolate',      hex: '#7B3F00', family: 'neutral' },
  { name: 'Espresso',       hex: '#4E342E', family: 'neutral' },
  { name: 'Slate',          hex: '#64748B', family: 'neutral' },
  { name: 'Charcoal',       hex: '#36454F', family: 'neutral' },
  { name: 'Gunmetal',       hex: '#2A3439', family: 'neutral' },
  { name: 'Silver',         hex: '#C0C0C0', family: 'neutral' },
  { name: 'Pewter',         hex: '#8B8B83', family: 'neutral' },
  { name: 'Black',          hex: '#0F172A', family: 'neutral' },
  { name: 'White',          hex: '#FFFFFF', family: 'neutral' },
]

export interface ColorPalettePickerProps {
  value?: string | null
  onChange: (hex: string) => void
  label?: string
  description?: string
  /** Show a hex input alongside the swatch grid for custom colors. */
  allowCustom?: boolean
  className?: string
}

function normalize(hex: string | null | undefined): string {
  if (!hex) return ''
  return hex.trim().toUpperCase()
}

function isSameColor(a: string | null | undefined, b: string): boolean {
  return normalize(a) === normalize(b)
}

export function ColorPalettePicker({
  value,
  onChange,
  label = 'Color',
  description,
  allowCustom = true,
  className,
}: ColorPalettePickerProps) {
  const selected = useMemo(() => {
    const v = normalize(value)
    return PALETTE.find((c) => normalize(c.hex) === v) || null
  }, [value])

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <Label>{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {value && (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-6 w-6 rounded-full ring-2 ring-border"
              style={{ backgroundColor: value }}
              aria-hidden
            />
            <span className="text-sm font-medium">
              {selected?.name ?? 'Custom'}{' '}
              <span className="text-muted-foreground">({value})</span>
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {PALETTE.map((c) => {
          const active = isSameColor(value, c.hex)
          return (
            <button
              key={c.hex + c.name}
              type="button"
              onClick={() => onChange(c.hex)}
              title={`${c.name} (${c.hex})`}
              aria-label={`${c.name} (${c.hex})`}
              aria-pressed={active}
              className={cn(
                'group flex h-14 flex-col items-center justify-end overflow-hidden rounded-md border transition-all hover:scale-[1.03]',
                active
                  ? 'border-primary ring-2 ring-primary ring-offset-1'
                  : 'border-border',
              )}
              style={{ backgroundColor: c.hex }}
            >
              <span className="w-full bg-background/80 px-1 py-0.5 text-[9px] font-medium leading-tight text-foreground backdrop-blur-sm">
                {c.name}
              </span>
            </button>
          )
        })}
      </div>

      {allowCustom && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Custom hex</Label>
          <Input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="h-8 w-32 font-mono text-sm"
            maxLength={9}
          />
          <input
            type="color"
            value={normalize(value) || '#000000'}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="h-8 w-10 cursor-pointer rounded border"
            aria-label="Custom color picker"
          />
        </div>
      )}
    </div>
  )
}
