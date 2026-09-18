'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  defaultValues,
  findForm,
  formFields,
  requiredOptionSources,
  slugify,
  type FieldValue,
  type FormField,
  type FormId,
  type FormOption,
  type FormSection,
  type FormSpec,
  type FormValues,
  type LineValue,
  type OptionSource,
} from '@/lib/admin-desktop/forms'
import { Icon } from './icons'

/**
 * The one form the desktop shell draws.
 *
 * Every create and every edit in the window comes through here, described by an
 * entry in the form registry rather than written as a screen of its own. That is
 * the whole reason the shell can do the work in place instead of handing off to
 * `/admin`: adding a way to create something is adding a description and a
 * handler, not a page.
 *
 * Values are held as the strings the inputs actually produce and coerced on the
 * server, so nothing here has an opinion about what a number or a date means —
 * except `datetime`, which has to cross the wall between the operator's clock
 * and an instant, and does it once, here.
 */

export interface SheetRequest {
  form: FormId
  recordId?: string
  values?: FormValues
  title?: string
}

interface SubmitResult {
  ok: boolean
  message?: string
  error?: string
  field?: string | null
  recordId?: string | null
}

const OPTION_CACHE_MS = 30_000

/** `2026-09-07T14:30:00.000Z` → `2026-09-07T10:30`, in the operator's own clock. */
function isoToLocalInput(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const offset = parsed.getTimezoneOffset() * 60_000
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16)
}

/** `2026-09-07T10:30` in the operator's clock → an instant the server can store. */
function localInputToIso(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

function asText(value: FieldValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function asLines(value: FieldValue | undefined): LineValue[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is LineValue => typeof entry === 'object' && entry !== null)
}

/** A gallery's URLs, tolerant of the single string a hand-built value may carry. */
function asImages(value: FieldValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean)
  if (typeof value === 'string' && value) return [value]
  return []
}

function asList(value: FieldValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry))
  if (typeof value === 'string' && value) return value.split(',').map((entry) => entry.trim()).filter(Boolean)
  return []
}

/** Whether a field renders a single input the sheet can open focused on. */
function takesFocus(field: FormField): boolean {
  return !['checkbox', 'tags', 'lines', 'images', 'hidden'].includes(field.type)
}

/** A blank row for a `lines` repeater, honouring each column's default. */
function blankLine(field: FormField): LineValue {
  const line: LineValue = {}
  for (const item of field.itemFields ?? []) line[item.name] = asText(item.defaultValue)
  return line
}

export function RecordSheet({
  request,
  onClose,
  onSaved,
}: {
  request: SheetRequest
  onClose: () => void
  /** Called with the toast line once the write lands, so the shell can reload. */
  onSaved: (message: string, recordId: string | null) => void
}) {
  const spec = findForm(request.form)
  const [values, setValues] = useState<FormValues>(() => seed(spec, request.values))
  const [options, setOptions] = useState<Partial<Record<OptionSource, FormOption[]>>>({})
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  /** Fields the operator has typed into, so a derived slug stops following. */
  const touched = useRef(new Set<string>())
  const firstInput = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  const sources = useMemo(() => (spec ? requiredOptionSources(spec) : []), [spec])

  useEffect(() => {
    if (sources.length === 0) return
    let live = true
    setLoadingOptions(true)

    void Promise.all(
      sources.map(async (source) => {
        const cached = readCache(source)
        if (cached) return [source, cached] as const
        try {
          const response = await fetch(`/api/admin/desktop/options/${source}`, { credentials: 'same-origin' })
          if (!response.ok) return [source, [] as FormOption[]] as const
          const body = (await response.json()) as { options?: FormOption[] }
          const list = body.options ?? []
          writeCache(source, list)
          return [source, list] as const
        } catch {
          // A picker with no choices is still a usable sheet for every other field.
          return [source, [] as FormOption[]] as const
        }
      }),
    ).then((entries) => {
      if (!live) return
      setOptions(Object.fromEntries(entries) as Partial<Record<OptionSource, FormOption[]>>)
      setLoadingOptions(false)
    })

    return () => {
      live = false
    }
  }, [sources])

  useEffect(() => {
    firstInput.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const set = useCallback((name: string, value: FieldValue) => {
    setValues((previous) => ({ ...previous, [name]: value }))
  }, [])

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!spec || saving) return

      setSaving(true)
      setError(null)
      setFieldError(null)

      try {
        const response = await fetch('/api/admin/desktop/write', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: request.form,
            recordId: request.recordId,
            values: wireValues(spec, values),
          }),
        })

        const body = (await response.json()) as SubmitResult

        if (!response.ok || !body.ok) {
          setError(body.error ?? 'That did not go through.')
          setFieldError(body.field ?? null)
          return
        }

        onSaved(body.message ?? 'Saved', body.recordId ?? null)
      } catch {
        setError('Could not reach the server. Check the connection and try again.')
      } finally {
        setSaving(false)
      }
    },
    [spec, saving, request.form, request.recordId, values, onSaved],
  )

  if (!spec) return null

  // Sections that claim a side sit in the band across the top; the rest keep
  // their own order underneath. A form with a band needs the extra width for
  // two columns of real content, so it asks for it here rather than in a size.
  const band = spec.sections
    .filter((section) => section.column)
    .sort((a, b) => (a.column === b.column ? 0 : a.column === 'left' ? -1 : 1))
  const stack = spec.sections.filter((section) => !section.column)
  // Where the cursor lands. Not simply the first field: a product sheet leads
  // with its gallery and the URL box beside it, and a window driven from the
  // keyboard should open on the thing that has to be filled in rather than on
  // nothing, or on an optional box somebody then has to tab out of.
  const typeable = formFields(spec).filter(takesFocus)
  const firstFieldName = (typeable.find((field) => field.required) ?? typeable[0])?.name

  const renderSection = (section: FormSection, key: string) => (
    <section key={key} className="jmsd-sheet-section">
      {section.label ? <div className="jmsd-sheet-section-label">{section.label}</div> : null}
      <div className="jmsd-sheet-grid">
        {section.fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            value={values[field.name]}
            options={field.optionsFrom ? options[field.optionsFrom] : field.options}
            optionsLoading={Boolean(field.optionsFrom) && loadingOptions}
            invalid={fieldError === field.name}
            inputRef={field.name === firstFieldName ? firstInput : undefined}
            lineOptions={options}
            onChange={(next) => {
              touched.current.add(field.name)
              set(field.name, next)

              // A slug follows its source until somebody edits it by hand.
              for (const other of formFields(spec)) {
                if (other.slugFrom === field.name && !touched.current.has(other.name)) {
                  set(other.name, slugify(String(next)))
                }
              }
            }}
          />
        ))}
      </div>
    </section>
  )

  return (
    <div className="jmsd-scrim" role="presentation" onMouseDown={onClose}>
      <form
        className={`jmsd-sheet jmsd-sheet--${spec.size ?? 'regular'} ${band.length > 0 ? 'jmsd-sheet--band' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={request.title ?? spec.title}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <header className="jmsd-sheet-head">
          <div className="jmsd-sheet-heading">
            <div className="jmsd-sheet-title">{request.title ?? spec.title}</div>
            {spec.subtitle ? <div className="jmsd-sheet-subtitle">{spec.subtitle}</div> : null}
          </div>
          <button type="button" className="jmsd-icon-button" onClick={onClose} aria-label="Close">
            <Icon name="i-close" size={14} />
          </button>
        </header>

        <div className="jmsd-sheet-body">
          {band.length > 0 ? (
            <div className="jmsd-sheet-band">
              {band.map((section, index) => renderSection(section, `band-${section.label ?? index}`))}
            </div>
          ) : null}
          {stack.map((section, index) => renderSection(section, `stack-${section.label ?? index}`))}
        </div>

        <footer className="jmsd-sheet-foot">
          {error ? <div className="jmsd-sheet-error">{error}</div> : <span />}
          <div className="jmsd-sheet-buttons">
            <button type="button" className="jmsd-action" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={`jmsd-action jmsd-action--primary ${spec.danger ? 'jmsd-action--danger' : ''}`}
              disabled={saving}
            >
              {saving ? 'Saving…' : spec.submitLabel}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------- one field

function Field({
  field,
  value,
  options,
  optionsLoading,
  invalid,
  inputRef,
  lineOptions,
  onChange,
}: {
  field: FormField
  value: FieldValue | undefined
  options?: FormOption[]
  optionsLoading: boolean
  invalid: boolean
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  lineOptions: Partial<Record<OptionSource, FormOption[]>>
  onChange: (value: FieldValue) => void
}) {
  const id = `jmsd-field-${field.name}`
  const span = field.span ?? 1
  const className = `jmsd-field-block ${span === 2 ? 'jmsd-field-block--wide' : ''} ${invalid ? 'jmsd-field-block--bad' : ''}`

  if (field.type === 'checkbox') {
    return (
      <div className={className}>
        <label className="jmsd-check">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
        {field.help ? <div className="jmsd-field-help">{field.help}</div> : null}
      </div>
    )
  }

  // A value the sheet carries but nobody edits — round-tripped so the handler
  // can compare what was submitted against what the sheet opened on.
  if (field.type === 'hidden') return null

  if (field.type === 'images') {
    return <Gallery className={className} field={field} urls={asImages(value)} onChange={onChange} />
  }

  if (field.type === 'lines') {
    return (
      <LineRepeater
        className={className}
        field={field}
        rows={asLines(value)}
        options={lineOptions}
        onChange={onChange}
      />
    )
  }

  if (field.type === 'tags') {
    const selected = new Set(asList(value))
    return (
      <div className={className}>
        <label className="jmsd-field-label" htmlFor={id}>
          {field.label}
          {field.required ? <span className="jmsd-tone-bad"> *</span> : null}
        </label>
        <div className="jmsd-tagpicker" id={id}>
          {(options ?? []).map((option) => (
            <button
              key={option.value}
              type="button"
              className="jmsd-chip"
              aria-pressed={selected.has(option.value)}
              onClick={() => {
                const next = new Set(selected)
                if (next.has(option.value)) next.delete(option.value)
                else next.add(option.value)
                onChange([...next])
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {field.help ? <div className="jmsd-field-help">{field.help}</div> : null}
      </div>
    )
  }

  return (
    <div className={className}>
      <label className="jmsd-field-label" htmlFor={id}>
        {field.label}
        {field.required ? <span className="jmsd-tone-bad"> *</span> : null}
      </label>

      {field.type === 'select' ? (
        <select
          id={id}
          ref={inputRef as React.Ref<HTMLSelectElement>}
          className="jmsd-input"
          value={asText(value)}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{optionsLoading ? 'Loading…' : field.required ? 'Choose one…' : '—'}</option>
          {(options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.hint ? `${option.label} — ${option.hint}` : option.label}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          id={id}
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          className="jmsd-input jmsd-input--area"
          rows={field.rows ?? 3}
          value={asText(value)}
          required={field.required}
          maxLength={field.max}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          ref={inputRef as React.Ref<HTMLInputElement>}
          className="jmsd-input"
          type={inputType(field.type)}
          inputMode={field.type === 'money' || field.type === 'percent' ? 'decimal' : undefined}
          step={field.step ?? stepFor(field.type)}
          min={field.min}
          max={field.type === 'text' || field.type === 'slug' ? undefined : field.max}
          maxLength={field.type === 'text' || field.type === 'slug' ? field.max : undefined}
          value={field.type === 'datetime' ? isoToLocalInput(asText(value)) : asText(value)}
          required={field.required}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.help ? <div className="jmsd-field-help">{field.help}</div> : null}
    </div>
  )
}

function inputType(type: FormField['type']): string {
  switch (type) {
    case 'email':
      return 'email'
    case 'tel':
      return 'tel'
    case 'url':
      return 'url'
    case 'password':
      return 'password'
    case 'number':
    case 'integer':
    case 'money':
    case 'percent':
      return 'number'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime-local'
    default:
      return 'text'
  }
}

function stepFor(type: FormField['type']): string | undefined {
  if (type === 'integer') return '1'
  if (type === 'money' || type === 'percent' || type === 'number') return '0.01'
  return undefined
}

// ------------------------------------------------------------------ gallery

/**
 * The image list for a product.
 *
 * A URL and a button, then the pictures themselves — the shell has no uploader
 * of its own, and the images it is given already live in blob storage, so what
 * this edits is the order and the membership of a list of URLs. The first entry
 * is the one the storefront leads with, which is why it is labelled rather than
 * left for somebody to remember — and a featured URL, when one is typed, is
 * hoisted to that spot on save.
 *
 * There is deliberately no alt-text box: `Product.images` is a list of strings
 * with nowhere to put one, so a field here would take the words and drop them.
 */
function Gallery({
  className,
  field,
  urls,
  onChange,
}: {
  className: string
  field: FormField
  urls: string[]
  onChange: (value: FieldValue) => void
}) {
  const [draft, setDraft] = useState('')
  const max = field.maxItems
  const full = max !== undefined && urls.length >= max

  const add = () => {
    const url = draft.trim()
    if (!url || full || urls.includes(url)) return
    onChange([...urls, url])
    setDraft('')
  }

  return (
    <div className={className}>
      <div className="jmsd-field-label">
        {field.label}
        {max ? <span className="jmsd-tone-muted"> ({urls.length}/{max})</span> : null}
      </div>

      <div className="jmsd-gallery-add">
        <input
          className="jmsd-input"
          type="url"
          aria-label={`Add an image to ${field.label}`}
          placeholder="https://…"
          value={draft}
          disabled={full}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter belongs to the gallery here, not to the sheet's submit.
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }}
        />
        <button type="button" className="jmsd-action" onClick={add} disabled={full || !draft.trim()}>
          <Icon name="i-plus" size={12} />
          <span>Add</span>
        </button>
      </div>

      {urls.length === 0 ? (
        <div className="jmsd-empty jmsd-gallery-empty">No images yet.</div>
      ) : (
        <ul className="jmsd-gallery">
          {urls.map((url, index) => (
            // Keyed by position: `images` is a plain string list, so the same
            // URL can legitimately appear twice and a URL key would collide.
            <li key={`${index}-${url}`} className="jmsd-gallery-item">
              {/* eslint-disable-next-line @next/next/no-img-element -- an operator-supplied URL on any host, inside a staff window */}
              <img className="jmsd-gallery-thumb" src={url} alt="" loading="lazy" />
              <div className="jmsd-gallery-meta">
                <span className="jmsd-gallery-url jmsd-mono" title={url}>
                  {url}
                </span>
                {index === 0 ? <span className="jmsd-gallery-lead">Lead image</span> : null}
              </div>
              <div className="jmsd-gallery-buttons">
                <button
                  type="button"
                  className="jmsd-icon-button"
                  aria-label={`Move image ${index + 1} first`}
                  disabled={index === 0}
                  onClick={() => onChange([url, ...urls.filter((_, at) => at !== index)])}
                >
                  <Icon name="i-up" size={12} />
                </button>
                <button
                  type="button"
                  className="jmsd-icon-button"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() => onChange(urls.filter((_, at) => at !== index))}
                >
                  <Icon name="i-close" size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {field.help ? <div className="jmsd-field-help">{field.help}</div> : null}
    </div>
  )
}

// ------------------------------------------------------------ line repeater

function LineRepeater({
  className,
  field,
  rows,
  options,
  onChange,
}: {
  className: string
  field: FormField
  rows: LineValue[]
  options: Partial<Record<OptionSource, FormOption[]>>
  onChange: (value: FieldValue) => void
}) {
  const columns = field.itemFields ?? []
  // The only value a stylesheet cannot know: how many columns this repeater has.
  // The grid rule that consumes it lives in desktop.css with the rest.
  const columnTemplate = {
    '--jmsd-line-columns': columns.map((_, index) => (index === 0 ? 'minmax(0,1fr)' : '90px')).join(' '),
  } as CSSProperties

  const update = (index: number, name: string, next: string) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [name]: next } : row)))
  }

  return (
    <div className={className}>
      <div className="jmsd-field-label">
        {field.label}
        {field.required ? <span className="jmsd-tone-bad"> *</span> : null}
      </div>

      <div className="jmsd-lines">
        <div className="jmsd-lines-head" style={columnTemplate}>
          {columns.map((column) => (
            <span key={column.name}>{column.label}</span>
          ))}
          <span />
        </div>

        {rows.length === 0 ? (
          <div className="jmsd-empty jmsd-lines-empty">
            No lines yet.
          </div>
        ) : (
          rows.map((row, index) => (
            <div key={index} className="jmsd-lines-row" style={columnTemplate}>
              {columns.map((column) =>
                column.type === 'select' ? (
                  <select
                    key={column.name}
                    className="jmsd-input"
                    aria-label={`${column.label}, line ${index + 1}`}
                    value={row[column.name] ?? ''}
                    onChange={(event) => {
                      const next = event.target.value
                      update(index, column.name, next)

                      // Picking a product fills its price, so the common case is
                      // one click; typing over it afterwards still wins.
                      const price = options[column.optionsFrom ?? 'products']?.find(
                        (option) => option.value === next,
                      )?.hint
                      const match = price?.match(/\$([\d.]+)/)
                      if (match && !row.unitPrice) {
                        onChange(
                          rows.map((candidate, rowIndex) =>
                            rowIndex === index
                              ? { ...candidate, [column.name]: next, unitPrice: match[1] }
                              : candidate,
                          ),
                        )
                      }
                    }}
                  >
                    <option value="">Choose…</option>
                    {(options[column.optionsFrom ?? 'products'] ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    key={column.name}
                    className="jmsd-input"
                    aria-label={`${column.label}, line ${index + 1}`}
                    type={inputType(column.type)}
                    step={stepFor(column.type)}
                    min={column.min}
                    value={row[column.name] ?? ''}
                    placeholder={column.placeholder}
                    onChange={(event) => update(index, column.name, event.target.value)}
                  />
                ),
              )}
              <button
                type="button"
                className="jmsd-icon-button"
                aria-label={`Remove line ${index + 1}`}
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                <Icon name="i-close" size={12} />
              </button>
            </div>
          ))
        )}

        <button
          type="button"
          className="jmsd-action jmsd-lines-add"
          onClick={() => onChange([...rows, blankLine(field)])}
        >
          <Icon name="i-plus" size={12} />
          <span>{field.addLabel ?? 'Add a line'}</span>
        </button>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------- values

/** The record the sheet opens with: the spec's blanks, then what the loader read. */
function seed(spec: FormSpec | undefined, supplied: FormValues | undefined): FormValues {
  if (!spec) return {}
  const base = defaultValues(spec)
  if (!supplied) return base

  for (const [name, value] of Object.entries(supplied)) {
    if (value !== undefined) base[name] = value
  }
  return base
}

/** What goes on the wire — the only place a wall-clock time becomes an instant. */
function wireValues(spec: FormSpec, values: FormValues): FormValues {
  const out: FormValues = { ...values }
  for (const field of formFields(spec)) {
    if (field.type !== 'datetime') continue
    const raw = asText(out[field.name])
    out[field.name] = raw ? localInputToIso(raw) : ''
  }
  return out
}

// -------------------------------------------------------------- option cache

/**
 * A short-lived cache for picker choices.
 *
 * Opening three sheets in a row should not fetch the product list three times,
 * and half a minute is short enough that a product added in another tab shows up
 * about as fast as anyone would look for it.
 */
const cache = new Map<OptionSource, { at: number; options: FormOption[] }>()

function readCache(source: OptionSource): FormOption[] | undefined {
  const entry = cache.get(source)
  if (!entry || Date.now() - entry.at > OPTION_CACHE_MS) return undefined
  return entry.options
}

function writeCache(source: OptionSource, options: FormOption[]) {
  cache.set(source, { at: Date.now(), options })
}
