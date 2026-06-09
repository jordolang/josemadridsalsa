'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  type FundraiserPageConfig,
  type PageBlock,
  type BlockType,
  defaultPageConfig,
  blockTypeLabels,
  blockTypeDescriptions,
} from '@/lib/fundraiser-page-config'
import { Button } from '@/components/ui/button'

type BlockState = PageBlock & { _id: string }

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function addIds(blocks: PageBlock[]): BlockState[] {
  return blocks.map((b) => ({ ...b, _id: generateId() }))
}

function stripIds(blocks: BlockState[]): PageBlock[] {
  return blocks.map(({ _id, ...rest }) => rest as PageBlock)
}

const allBlockTypes: BlockType[] = [
  'hero',
  'logo_banner',
  'mission_statement',
  'progress_bar',
  'product_showcase',
  'participant_leaderboard',
  'gallery',
  'custom_text',
  'contact_info',
  'how_it_works',
  'stat_cards',
  'info_card',
  'cta_button',
  'video_embed',
  'testimonial',
  'contact_form',
  'divider',
  'image_text',
  'countdown',
  'announcement_banner',
]

function createDefaultBlock(type: BlockType): PageBlock {
  switch (type) {
    case 'hero':
      return { type: 'hero', ctaLabel: 'Shop & Support' }
    case 'logo_banner':
      return { type: 'logo_banner' }
    case 'mission_statement':
      return { type: 'mission_statement', showGoalProgress: true }
    case 'progress_bar':
      return { type: 'progress_bar', showAmount: true, showPercentage: true }
    case 'product_showcase':
      return { type: 'product_showcase', pricePoints: [25, 50], columns: 3 }
    case 'participant_leaderboard':
      return { type: 'participant_leaderboard', topN: 5 }
    case 'gallery':
      return { type: 'gallery', imageUrls: [], columns: 3 }
    case 'custom_text':
      return { type: 'custom_text', content: '', alignment: 'center' }
    case 'contact_info':
      return { type: 'contact_info', showEmail: true, showPhone: true }
    case 'how_it_works':
      return { type: 'how_it_works' }
    case 'stat_cards':
      return {
        type: 'stat_cards',
        cards: [
          { label: 'Goal', value: '$0' },
          { label: 'Sold', value: '0' },
          { label: 'Supporters', value: '0' },
        ],
        columns: 3,
      }
    case 'info_card':
      return { type: 'info_card', content: 'Add your info here.', style: 'default' }
    case 'cta_button':
      return { type: 'cta_button', label: 'Order Now', url: '#products', style: 'primary', size: 'lg', alignment: 'center' }
    case 'video_embed':
      return { type: 'video_embed', aspectRatio: '16:9' }
    case 'testimonial':
      return { type: 'testimonial', quote: '' }
    case 'contact_form':
      return { type: 'contact_form', fields: ['name', 'email', 'message'] }
    case 'divider':
      return { type: 'divider', style: 'line', spacing: 'md' }
    case 'image_text':
      return { type: 'image_text', content: '', imagePosition: 'left' }
    case 'countdown':
      return {
        type: 'countdown',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      }
    case 'announcement_banner':
      return { type: 'announcement_banner', message: '', style: 'info', dismissible: true }
  }
}

// ── Block editor panels ──

type EditorPanelProps = {
  block: BlockState
  onChange: (updates: Partial<PageBlock>) => void
}

function LabelInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-salsa-400 focus:outline-none"
      />
    </div>
  )
}

function LabelTextarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-salsa-400 focus:outline-none"
      />
    </div>
  )
}

function LabelCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300"
      />
      {label}
    </label>
  )
}

function LabelSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-salsa-400 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function BlockEditorPanel({ block, onChange }: EditorPanelProps) {
  const b = block as any

  if (block.type === 'hero') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Headline" value={b.headline ?? ''} onChange={(v) => onChange({ headline: v })} placeholder="Your headline" />
        <LabelInput label="Subheadline" value={b.subheadline ?? ''} onChange={(v) => onChange({ subheadline: v })} placeholder="Supporting text" />
        <LabelInput label="CTA Label" value={b.ctaLabel ?? ''} onChange={(v) => onChange({ ctaLabel: v })} placeholder="Shop & Support" />
        <LabelInput label="Cover Photo URL" value={b.coverPhotoUrl ?? ''} onChange={(v) => onChange({ coverPhotoUrl: v })} placeholder="https://..." />
      </div>
    )
  }

  if (block.type === 'logo_banner') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Tagline" value={b.tagline ?? ''} onChange={(v) => onChange({ tagline: v })} />
        <LabelInput label="Logo URL" value={b.logoUrl ?? ''} onChange={(v) => onChange({ logoUrl: v })} placeholder="https://..." />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Background Color</label>
          <input type="color" value={b.backgroundColor ?? '#ffffff'} onChange={(e) => onChange({ backgroundColor: e.target.value })} className="h-8 w-16 cursor-pointer rounded border border-gray-300" />
        </div>
      </div>
    )
  }

  if (block.type === 'mission_statement') {
    return (
      <div className="grid gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Mission Text ({(b.text ?? '').length}/2000)</label>
          <textarea
            value={b.text ?? ''}
            rows={4}
            maxLength={2000}
            onChange={(e) => onChange({ text: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-salsa-400 focus:outline-none"
          />
        </div>
        <LabelCheckbox label="Show goal progress" checked={b.showGoalProgress} onChange={(v) => onChange({ showGoalProgress: v })} />
      </div>
    )
  }

  if (block.type === 'progress_bar') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Label" value={b.label ?? ''} onChange={(v) => onChange({ label: v })} placeholder="Fundraising Progress" />
        <div className="flex flex-col gap-2">
          <LabelCheckbox label="Show amount raised" checked={b.showAmount} onChange={(v) => onChange({ showAmount: v })} />
          <LabelCheckbox label="Show percentage" checked={b.showPercentage} onChange={(v) => onChange({ showPercentage: v })} />
        </div>
      </div>
    )
  }

  if (block.type === 'product_showcase') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Title" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} placeholder="Support Our Cause" />
        <LabelSelect
          label="Columns"
          value={String(b.columns)}
          options={[{ value: '2', label: '2 columns' }, { value: '3', label: '3 columns' }, { value: '4', label: '4 columns' }]}
          onChange={(v) => onChange({ columns: Number(v) as 2 | 3 | 4 })}
        />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">Price Points (comma-separated)</label>
          <input
            type="text"
            value={(b.pricePoints ?? []).join(', ')}
            onChange={(e) => {
              const nums = e.target.value.split(',').map((s: string) => Number(s.trim())).filter((n: number) => n > 0)
              onChange({ pricePoints: nums })
            }}
            placeholder="25, 50, 75"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-salsa-400 focus:outline-none"
          />
        </div>
      </div>
    )
  }

  if (block.type === 'participant_leaderboard') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Title" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} placeholder="Top Supporters" />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Show top N participants</label>
          <input
            type="number"
            min={1}
            max={50}
            value={b.topN ?? 5}
            onChange={(e) => onChange({ topN: Math.min(50, Math.max(1, Number(e.target.value))) })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-salsa-400 focus:outline-none"
          />
        </div>
      </div>
    )
  }

  if (block.type === 'gallery') {
    return (
      <div className="grid gap-3">
        <LabelInput label="Title" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} />
        <LabelSelect
          label="Columns"
          value={String(b.columns)}
          options={[{ value: '2', label: '2 columns' }, { value: '3', label: '3 columns' }]}
          onChange={(v) => onChange({ columns: Number(v) as 2 | 3 })}
        />
        <LabelTextarea
          label="Image URLs (one per line)"
          value={(b.imageUrls ?? []).join('\n')}
          onChange={(v) => onChange({ imageUrls: v.split('\n').map((s: string) => s.trim()).filter(Boolean) })}
          rows={4}
        />
      </div>
    )
  }

  if (block.type === 'custom_text') {
    return (
      <div className="grid gap-3">
        <LabelTextarea label="Content" value={b.content ?? ''} onChange={(v) => onChange({ content: v })} rows={4} />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Alignment</label>
          <div className="flex gap-2">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                onClick={() => onChange({ alignment: a })}
                className={`rounded border px-3 py-1 text-sm font-medium transition ${b.alignment === a ? 'border-salsa-500 bg-salsa-50 text-salsa-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
              >
                {a === 'left' ? 'L' : a === 'center' ? 'C' : 'R'}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (block.type === 'contact_info') {
    return (
      <div className="grid gap-3">
        <LabelTextarea label="Custom Message" value={b.customMessage ?? ''} onChange={(v) => onChange({ customMessage: v })} rows={2} />
        <div className="flex gap-4">
          <LabelCheckbox label="Show email" checked={b.showEmail} onChange={(v) => onChange({ showEmail: v })} />
          <LabelCheckbox label="Show phone" checked={b.showPhone} onChange={(v) => onChange({ showPhone: v })} />
        </div>
      </div>
    )
  }

  if (block.type === 'how_it_works') {
    const steps: Array<{ title: string; description: string }> = b.steps ?? []
    return (
      <div className="grid gap-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Step {i + 1}</span>
              <button
                onClick={() => {
                  const next = steps.filter((_, j) => j !== i)
                  onChange({ steps: next })
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <div className="grid gap-2">
              <LabelInput label="Title" value={step.title} onChange={(v) => {
                const next = steps.map((s, j) => j === i ? { ...s, title: v } : s)
                onChange({ steps: next })
              }} />
              <LabelTextarea label="Description" value={step.description} onChange={(v) => {
                const next = steps.map((s, j) => j === i ? { ...s, description: v } : s)
                onChange({ steps: next })
              }} rows={2} />
            </div>
          </div>
        ))}
        <button
          onClick={() => onChange({ steps: [...steps, { title: '', description: '' }] })}
          className="rounded border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-salsa-300 hover:text-salsa-600"
        >
          + Add Step
        </button>
      </div>
    )
  }

  if (block.type === 'stat_cards') {
    type StatIcon = 'heart' | 'star' | 'fire' | 'trophy' | 'dollar' | 'people'
    const cards: Array<{ label: string; value: string; icon?: StatIcon }> = b.cards ?? []
    return (
      <div className="grid gap-3">
        <LabelInput label="Section Title" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} />
        <LabelSelect
          label="Columns"
          value={String(b.columns)}
          options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]}
          onChange={(v) => onChange({ columns: Number(v) as 2 | 3 | 4 })}
        />
        {cards.map((card, i) => (
          <div key={i} className="rounded border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Card {i + 1}</span>
              <button onClick={() => onChange({ cards: cards.filter((_, j) => j !== i) })} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <LabelInput label="Label" value={card.label} onChange={(v) => {
                onChange({ cards: cards.map((c, j) => j === i ? { ...c, label: v } : c) })
              }} />
              <LabelInput label="Value" value={card.value} onChange={(v) => {
                onChange({ cards: cards.map((c, j) => j === i ? { ...c, value: v } : c) })
              }} />
              <LabelSelect
                label="Icon"
                value={card.icon ?? ''}
                options={[
                  { value: '', label: 'None' },
                  { value: 'heart', label: '❤️ Heart' },
                  { value: 'star', label: '⭐ Star' },
                  { value: 'fire', label: '🔥 Fire' },
                  { value: 'trophy', label: '🏆 Trophy' },
                  { value: 'dollar', label: '💵 Dollar' },
                  { value: 'people', label: '👥 People' },
                ]}
                onChange={(v) => {
                  onChange({ cards: cards.map((c, j) => j === i ? { ...c, icon: (v || undefined) as StatIcon | undefined } : c) })
                }}
              />
            </div>
          </div>
        ))}
        <button
          onClick={() => onChange({ cards: [...cards, { label: 'Label', value: '0' }] })}
          className="rounded border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-salsa-300 hover:text-salsa-600"
        >
          + Add Card
        </button>
      </div>
    )
  }

  if (block.type === 'info_card') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Title" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} />
        <LabelInput label="Icon (emoji)" value={b.icon ?? ''} onChange={(v) => onChange({ icon: v })} placeholder="💡" />
        <div className="sm:col-span-2">
          <LabelTextarea label="Content" value={b.content ?? ''} onChange={(v) => onChange({ content: v })} rows={3} />
        </div>
        <LabelSelect
          label="Style"
          value={b.style ?? 'default'}
          options={[
            { value: 'default', label: 'Default (Gray)' },
            { value: 'highlight', label: 'Highlight (Salsa)' },
            { value: 'warning', label: 'Warning (Amber)' },
            { value: 'success', label: 'Success (Green)' },
          ]}
          onChange={(v) => onChange({ style: v as any })}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Background Color</label>
          <input type="color" value={b.backgroundColor ?? '#f9fafb'} onChange={(e) => onChange({ backgroundColor: e.target.value })} className="h-8 w-16 cursor-pointer rounded border border-gray-300" />
        </div>
      </div>
    )
  }

  if (block.type === 'cta_button') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Button Label" value={b.label ?? ''} onChange={(v) => onChange({ label: v })} placeholder="Order Now" />
        <LabelInput label="URL" value={b.url ?? ''} onChange={(v) => onChange({ url: v })} placeholder="#products" />
        <LabelSelect
          label="Style"
          value={b.style ?? 'primary'}
          options={[
            { value: 'primary', label: 'Primary (Red)' },
            { value: 'secondary', label: 'Secondary (Dark)' },
            { value: 'outline', label: 'Outline' },
          ]}
          onChange={(v) => onChange({ style: v as any })}
        />
        <LabelSelect
          label="Size"
          value={b.size ?? 'md'}
          options={[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ]}
          onChange={(v) => onChange({ size: v as any })}
        />
        <LabelSelect
          label="Alignment"
          value={b.alignment ?? 'center'}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(v) => onChange({ alignment: v as any })}
        />
      </div>
    )
  }

  if (block.type === 'video_embed') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <LabelInput label="YouTube URL" value={b.youtubeUrl ?? ''} onChange={(v) => onChange({ youtubeUrl: v })} placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <LabelInput label="Title (optional)" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} />
        <LabelSelect
          label="Aspect Ratio"
          value={b.aspectRatio ?? '16:9'}
          options={[
            { value: '16:9', label: '16:9 (Widescreen)' },
            { value: '4:3', label: '4:3 (Standard)' },
          ]}
          onChange={(v) => onChange({ aspectRatio: v as any })}
        />
      </div>
    )
  }

  if (block.type === 'testimonial') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <LabelTextarea label="Quote" value={b.quote ?? ''} onChange={(v) => onChange({ quote: v })} rows={3} />
        </div>
        <LabelInput label="Author Name" value={b.author ?? ''} onChange={(v) => onChange({ author: v })} placeholder="Jane Smith" />
        <LabelInput label="Role / Title" value={b.role ?? ''} onChange={(v) => onChange({ role: v })} placeholder="Parent & Supporter" />
        <div className="sm:col-span-2">
          <LabelInput label="Avatar URL (optional)" value={b.avatarUrl ?? ''} onChange={(v) => onChange({ avatarUrl: v })} placeholder="https://..." />
        </div>
      </div>
    )
  }

  if (block.type === 'contact_form') {
    const allFields = ['name', 'email', 'phone', 'organization', 'message'] as const
    const activeFields: string[] = b.fields ?? []
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Form Title" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} />
        <LabelInput label="Recipient Email" value={b.recipientEmail ?? ''} onChange={(v) => onChange({ recipientEmail: v })} placeholder="organizer@example.com" />
        <LabelInput label="Submit Button Label" value={b.submitLabel ?? ''} onChange={(v) => onChange({ submitLabel: v })} placeholder="Send Message" />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Fields to show</label>
          <div className="flex flex-col gap-1">
            {allFields.map((f) => (
              <LabelCheckbox
                key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                checked={activeFields.includes(f)}
                onChange={(checked) => {
                  const next = checked
                    ? [...activeFields, f]
                    : activeFields.filter((x) => x !== f)
                  onChange({ fields: next as any })
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (block.type === 'divider') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <LabelSelect
          label="Style"
          value={b.style ?? 'line'}
          options={[
            { value: 'line', label: 'Line' },
            { value: 'dots', label: 'Dots' },
            { value: 'wave', label: 'Wave' },
            { value: 'salsa', label: '🌶️ Salsa' },
          ]}
          onChange={(v) => onChange({ style: v as any })}
        />
        <LabelSelect
          label="Spacing"
          value={b.spacing ?? 'md'}
          options={[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ]}
          onChange={(v) => onChange({ spacing: v as any })}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Color</label>
          <input type="color" value={b.color ?? '#e5e7eb'} onChange={(e) => onChange({ color: e.target.value })} className="h-8 w-16 cursor-pointer rounded border border-gray-300" />
        </div>
      </div>
    )
  }

  if (block.type === 'image_text') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabelInput label="Image URL" value={b.imageUrl ?? ''} onChange={(v) => onChange({ imageUrl: v })} placeholder="https://..." />
        <LabelInput label="Image Alt Text" value={b.imageAlt ?? ''} onChange={(v) => onChange({ imageAlt: v })} />
        <LabelSelect
          label="Image Position"
          value={b.imagePosition ?? 'left'}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(v) => onChange({ imagePosition: v as any })}
        />
        <LabelInput label="Title" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} />
        <div className="sm:col-span-2">
          <LabelTextarea label="Content" value={b.content ?? ''} onChange={(v) => onChange({ content: v })} rows={3} />
        </div>
      </div>
    )
  }

  if (block.type === 'countdown') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Target Date & Time</label>
          <input
            type="datetime-local"
            value={b.targetDate ?? ''}
            onChange={(e) => onChange({ targetDate: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-salsa-400 focus:outline-none"
          />
        </div>
        <LabelInput label="Title" value={b.title ?? ''} onChange={(v) => onChange({ title: v })} placeholder="Event Countdown" />
        <div className="sm:col-span-2">
          <LabelInput label="Expired Message" value={b.expiredMessage ?? ''} onChange={(v) => onChange({ expiredMessage: v })} placeholder="This event has ended." />
        </div>
      </div>
    )
  }

  if (block.type === 'announcement_banner') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <LabelTextarea label="Message" value={b.message ?? ''} onChange={(v) => onChange({ message: v })} rows={2} />
        </div>
        <LabelSelect
          label="Style"
          value={b.style ?? 'info'}
          options={[
            { value: 'info', label: 'Info (Blue)' },
            { value: 'success', label: 'Success (Green)' },
            { value: 'warning', label: 'Warning (Amber)' },
            { value: 'urgent', label: 'Urgent (Red)' },
          ]}
          onChange={(v) => onChange({ style: v as any })}
        />
        <div className="flex items-end pb-1">
          <LabelCheckbox label="Dismissible by visitor" checked={b.dismissible ?? true} onChange={(v) => onChange({ dismissible: v })} />
        </div>
      </div>
    )
  }

  return (
    <p className="text-xs text-gray-400 italic">No editor available for this block type.</p>
  )
}

// ── Main component ──

export default function PageEditorPage() {
  const [blocks, setBlocks] = useState<BlockState[]>([])
  const [theme, setTheme] = useState<FundraiserPageConfig['theme']>('default')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const draggedIndexRef = useRef<number | null>(null)

  // Load current config
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/fundraiser-portal/page-config')
        if (res.ok) {
          const data = await res.json()
          const config = data.pageConfig as FundraiserPageConfig | null
          if (config) {
            setBlocks(addIds(config.blocks))
            setTheme(config.theme)
          } else {
            setBlocks(addIds(defaultPageConfig.blocks))
            setTheme(defaultPageConfig.theme)
          }
        }
      } catch {
        setBlocks(addIds(defaultPageConfig.blocks))
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const config: FundraiserPageConfig = {
        version: 1,
        theme,
        blocks: stripIds(blocks),
      }
      const res = await fetch('/api/fundraiser-portal/page-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageConfig: config }),
      })
      if (res.ok) {
        setSaveMessage('Saved successfully!')
      } else {
        const err = await res.json()
        setSaveMessage(`Error: ${err.error || 'Failed to save'}`)
      }
    } catch {
      setSaveMessage('Error saving. Please try again.')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [blocks, theme])

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= blocks.length) return
    setBlocks((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  const addBlock = (type: BlockType) => {
    const newBlock = createDefaultBlock(type)
    const withId = { ...newBlock, _id: generateId() }
    setBlocks((prev) => [...prev, withId])
    setShowAddBlock(false)
    setExpandedBlockId(withId._id)
  }

  const updateBlock = (index: number, updates: Partial<PageBlock>) => {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? ({ ...b, ...updates } as BlockState) : b))
    )
  }

  // Drag-and-drop handlers
  const handleDragStart = (index: number) => {
    draggedIndexRef.current = index
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetIndex: number) => {
    const from = draggedIndexRef.current
    if (from === null || from === targetIndex) return
    setBlocks((prev) => {
      const next = [...prev]
      const [removed] = next.splice(from, 1)
      next.splice(targetIndex, 0, removed)
      return next
    })
    draggedIndexRef.current = null
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Loading page editor...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-gray-900">Page Editor</h1>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.startsWith('Error') ? 'text-red-600' : 'text-verde-600'}`}>
              {saveMessage}
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="bg-salsa-500 hover:bg-salsa-600">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Theme selector */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">Page Theme</label>
        <div className="flex gap-3">
          {(['default', 'minimal', 'bold'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-md border px-4 py-2 text-sm font-medium capitalize transition ${
                theme === t
                  ? 'border-salsa-500 bg-salsa-50 text-salsa-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Block list */}
      <div className="space-y-2">
        {blocks.map((block, index) => {
          const isExpanded = expandedBlockId === block._id
          return (
            <div
              key={block._id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              className={`flex flex-col rounded-lg border bg-white transition ${isExpanded ? 'border-salsa-200 shadow-sm' : 'border-gray-200'}`}
            >
              {/* Block row */}
              <div className="flex items-center gap-2 p-3">
                {/* Drag handle */}
                <span className="cursor-grab select-none text-gray-300 hover:text-gray-500 text-lg leading-none" title="Drag to reorder">
                  ⠿
                </span>

                {/* Move buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveBlock(index, 'up')}
                    disabled={index === 0}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveBlock(index, 'down')}
                    disabled={index === blocks.length - 1}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                    title="Move down"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Block info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{blockTypeLabels[block.type]}</p>
                  <p className="text-xs text-gray-400 truncate">{blockTypeDescriptions[block.type]}</p>
                </div>

                {/* Edit toggle */}
                <button
                  onClick={() => setExpandedBlockId(isExpanded ? null : block._id)}
                  className={`rounded p-1.5 text-sm transition ${isExpanded ? 'bg-salsa-50 text-salsa-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
                  title={isExpanded ? 'Close editor' : 'Edit block'}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Remove */}
                <button
                  onClick={() => removeBlock(index)}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Remove block"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Inline editor panel */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <BlockEditorPanel
                    block={block}
                    onChange={(updates) => updateBlock(index, updates)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add block */}
      <div className="mt-4">
        {showAddBlock ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <p className="mb-3 text-sm font-semibold text-gray-700">Choose a block to add:</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {allBlockTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-salsa-300 hover:bg-salsa-50"
                >
                  <p className="text-sm font-semibold text-gray-800">{blockTypeLabels[type]}</p>
                  <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{blockTypeDescriptions[type]}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddBlock(false)}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddBlock(true)}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-500 transition hover:border-salsa-300 hover:text-salsa-600"
          >
            + Add Block
          </button>
        )}
      </div>

      {/* Reset to default */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <button
          onClick={() => {
            setBlocks(addIds(defaultPageConfig.blocks))
            setTheme(defaultPageConfig.theme)
          }}
          className="text-sm text-gray-500 hover:text-red-600"
        >
          Reset to default layout
        </button>
      </div>
    </div>
  )
}
