'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DESKTOP_SECTION_GROUPS, type DesktopSection, type DesktopSectionId } from '@/lib/admin-desktop/sections'
import type { DesktopBadges, Inspector as InspectorData, Row, SectionPayload } from '@/lib/admin-desktop/types'
import { Icon, IconSprite } from './icons'
import {
  AnalyticsView,
  DashboardView,
  EventsView,
  Inspector,
  LinkView,
  SettingsView,
  TableView,
  toneClass,
} from './views'

type Appearance = '' | 'light' | 'dark'

/**
 * How the window around this page is framed.
 *
 * Both desktop apps run the shell in a frameless window and inject
 * `window.jmsDesktop` before the page loads: macOS floats its real traffic
 * lights over the top-left, Windows paints its window buttons over the
 * top-right. A plain browser tab has neither and draws the design's own dots.
 */
type FrameChrome = 'browser' | 'traffic-lights' | 'overlay'

declare global {
  interface Window {
    jmsDesktop?: { platform?: string; chrome?: FrameChrome }
  }
}

const APPEARANCE_KEY = 'jms-desktop-appearance'
const APPEARANCE_ORDER: Appearance[] = ['', 'light', 'dark']

interface PaletteItem {
  key: string
  label: string
  hint: string
  icon: string
  shortcut?: string
  run: () => void
}

export function DesktopShell({
  initialSection,
  badges,
  operator,
}: {
  initialSection: SectionPayload
  badges: DesktopBadges
  operator: { name: string; email: string }
}) {
  const [section, setSection] = useState<SectionPayload>(initialSection)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(0)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [appearance, setAppearance] = useState<Appearance>('')
  const [quickFind, setQuickFind] = useState('')
  const [toast, setToast] = useState('')
  const [frame, setFrame] = useState<FrameChrome>('browser')

  const filterInputRef = useRef<HTMLInputElement>(null)
  const quickFindTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The request that owns the current render, so a slow section cannot land after a fast one. */
  const requestId = useRef(0)

  const sections = useMemo(() => DESKTOP_SECTION_GROUPS.flatMap((group) => group.items), [])
  const currentSection = useMemo(
    () => sections.find((item) => item.id === section.id) ?? sections[0],
    [sections, section.id],
  )

  useEffect(() => {
    const chrome = window.jmsDesktop?.chrome
    if (chrome === 'traffic-lights' || chrome === 'overlay') setFrame(chrome)
  }, [])

  // The operator's appearance choice is a window preference, not an account one.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(APPEARANCE_KEY)
      if (stored === 'light' || stored === 'dark') setAppearance(stored)
    } catch {
      // Private windows and locked-down profiles throw on access; the system
      // default is a perfectly good answer.
    }
  }, [])

  const flash = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }, [])

  const goToSection = useCallback(
    async (id: DesktopSectionId) => {
      if (id === section.id) {
        setPaletteOpen(false)
        return
      }

      const ticket = ++requestId.current
      setPaletteOpen(false)
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/admin/desktop/${id}`, { credentials: 'same-origin' })
        if (!response.ok) throw new Error(`Request failed with ${response.status}`)
        const payload = (await response.json()) as SectionPayload
        if (ticket !== requestId.current) return
        setSection(payload)
        setSelected(0)
        setQuery('')
        setFilter(0)
      } catch {
        if (ticket !== requestId.current) return
        setError('Could not load that section. Check the connection and try again.')
      } finally {
        if (ticket === requestId.current) setLoading(false)
      }
    },
    [section.id],
  )

  /** Leave the shell for a page in the web admin, in this same window. */
  const openPath = useCallback((path: string) => {
    window.location.href = path
  }, [])

  const cycleAppearance = useCallback(() => {
    setAppearance((previous) => {
      const next = APPEARANCE_ORDER[(APPEARANCE_ORDER.indexOf(previous) + 1) % APPEARANCE_ORDER.length]
      try {
        if (next) window.localStorage.setItem(APPEARANCE_KEY, next)
        else window.localStorage.removeItem(APPEARANCE_KEY)
      } catch {
        // Not being able to remember the choice is not a reason to refuse it.
      }
      flash(`Appearance: ${next === '' ? 'follow system' : next}`)
      return next
    })
  }, [flash])

  // ---------------------------------------------------------------- rows

  const body = section.body
  const allRows: Row[] = useMemo(
    () => (body.view === 'table' || body.view === 'events' ? body.rows : []),
    [body],
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return allRows.filter(
      (row) => (filter === 0 || row.buckets.includes(filter)) && (!needle || row.search.toLowerCase().includes(needle)),
    )
  }, [allRows, query, filter])

  const activeRow = rows[Math.min(selected, Math.max(rows.length - 1, 0))] ?? null

  const inspectorData: InspectorData | null = useMemo(() => {
    if (body.view === 'table' || body.view === 'events') return activeRow?.inspector ?? null
    if (body.view === 'link') return null
    return body.inspector
  }, [body, activeRow])

  // ------------------------------------------------------------- palette

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = []

    for (const item of sections) {
      items.push({
        key: `section:${item.id}`,
        label: item.label,
        hint: item.path,
        icon: item.icon,
        shortcut: item.digit ? `⌘${item.digit}` : undefined,
        run: () => void goToSection(item.id),
      })
    }

    for (const row of allRows.slice(0, 40)) {
      const [first, second] = row.cells
      items.push({
        key: `row:${row.id}`,
        label: first?.text ?? row.id,
        hint: [currentSection.label, second?.text].filter(Boolean).join(' · '),
        icon: currentSection.icon,
        run: () => {
          setPaletteOpen(false)
          const index = rows.findIndex((candidate) => candidate.id === row.id)
          if (index >= 0) setSelected(index)
          else flash(`${first?.text ?? row.id} is hidden by the current filter`)
        },
      })
    }

    items.push({
      key: 'command:appearance',
      label: 'Toggle appearance',
      hint: 'Light, dark, or follow the system',
      icon: 'i-settings',
      run: () => {
        setPaletteOpen(false)
        cycleAppearance()
      },
    })
    items.push({
      key: 'command:inspector',
      label: 'Toggle inspector',
      hint: 'Show or hide the detail pane',
      icon: 'i-chev',
      shortcut: 'I',
      run: () => {
        setPaletteOpen(false)
        setInspectorOpen((open) => !open)
      },
    })
    items.push({
      key: 'command:web-admin',
      label: 'Open this section in the web admin',
      hint: currentSection.path,
      icon: 'i-chev',
      run: () => openPath(currentSection.path),
    })

    const needle = paletteQuery.trim().toLowerCase()
    return items
      .filter((item) => !needle || `${item.label} ${item.hint}`.toLowerCase().includes(needle))
      .slice(0, 40)
  }, [sections, allRows, rows, currentSection, paletteQuery, goToSection, cycleAppearance, openPath, flash])

  // ------------------------------------------------------------ keyboard

  const openRow = useCallback(
    (row: Row | null) => {
      if (row?.href) openPath(row.href)
      else flash('This row has no page to open')
    },
    [openPath, flash],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase() ?? ''
      const typing = tag === 'input' || tag === 'textarea' || target?.isContentEditable === true
      const accel = event.metaKey || event.ctrlKey

      if (accel && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        setPaletteQuery('')
        setPaletteIndex(0)
        return
      }

      if (accel && /^[1-9]$/.test(event.key)) {
        const match = sections.find((item) => item.digit === event.key)
        if (match) {
          event.preventDefault()
          void goToSection(match.id)
        }
        return
      }

      if (event.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false)
        else if (typing) target?.blur()
        return
      }

      if (paletteOpen) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setPaletteIndex((index) => Math.min(index + 1, paletteItems.length - 1))
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setPaletteIndex((index) => Math.max(index - 1, 0))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          paletteItems[paletteIndex]?.run()
        }
        return
      }

      if (typing || accel || event.altKey) return

      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault()
        setSelected((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)))
        return
      }
      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault()
        setSelected((index) => Math.max(index - 1, 0))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        openRow(activeRow)
        return
      }
      if (event.key === '/') {
        event.preventDefault()
        filterInputRef.current?.focus()
        return
      }
      if (event.key === 'f') {
        event.preventDefault()
        setFilter((index) => (index + 1) % Math.max(section.filters.length, 1))
        setSelected(0)
        return
      }
      if (event.key === 'i') {
        event.preventDefault()
        setInspectorOpen((open) => !open)
        return
      }

      // Type-ahead: letters and digits jump to the first row that starts with
      // what has been typed, the way a file list does.
      if (/^[a-z0-9]$/i.test(event.key)) {
        const next = (quickFind + event.key).slice(0, 24)
        setQuickFind(next)
        if (quickFindTimer.current) clearTimeout(quickFindTimer.current)
        quickFindTimer.current = setTimeout(() => setQuickFind(''), 1300)

        const hit = rows.findIndex((row) =>
          row.cells.slice(0, 2).some((cell) => cell.text.toLowerCase().startsWith(next.toLowerCase())),
        )
        if (hit >= 0) setSelected(hit)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [paletteOpen, paletteItems, paletteIndex, rows, activeRow, sections, section.filters.length, quickFind, goToSection, openRow])

  useEffect(() => {
    return () => {
      if (quickFindTimer.current) clearTimeout(quickFindTimer.current)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  // Keep the selected row in view as j/k walks past the fold.
  useEffect(() => {
    const node = document.querySelector('.jmsd-row[aria-selected="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [selected, section.id])

  // --------------------------------------------------------------- render

  const badgeFor = (item: DesktopSection) => badges[item.id as keyof DesktopBadges]
  const initials = operator.name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const isRowView = body.view === 'table' || body.view === 'events'
  const rowSummary = isRowView ? `${rows.length} of ${allRows.length} rows` : section.path

  return (
    <div className="jmsd-root" data-appearance={appearance || undefined} data-frame={frame}>
      <IconSprite />

      <header className="jmsd-titlebar">
        <div className="jmsd-traffic" aria-hidden="true">
          {/* In a desktop window the OS draws the real controls over this
              strip, so the dots are hidden and only their space is kept. In a
              browser tab they stand in for the missing window chrome. */}
          <span style={{ background: '#ff5f57' }} />
          <span style={{ background: '#febc2e' }} />
          <span style={{ background: '#28c840' }} />
        </div>

        <div className="jmsd-titlebar-title">
          <span>{currentSection.label}</span>
          <span className="jmsd-mono" style={{ color: 'var(--faint)', fontSize: 10.5 }}>
            {section.path}
          </span>
          {loading ? (
            <span className="jmsd-mono" style={{ color: 'var(--goldt)', fontSize: 10.5 }}>
              loading…
            </span>
          ) : null}
        </div>

        <div className="jmsd-titlebar-tools">
          <button
            type="button"
            className="jmsd-search-button"
            onClick={() => {
              setPaletteOpen(true)
              setPaletteQuery('')
              setPaletteIndex(0)
            }}
          >
            <Icon name="i-search" size={13} />
            <span style={{ fontSize: 11.5 }}>Search everything</span>
            <span className="jmsd-key" style={{ marginLeft: 26 }}>
              ⌘K
            </span>
          </button>
          <button type="button" className="jmsd-icon-button" title="Appearance" onClick={cycleAppearance}>
            <Icon name="i-settings" size={14} />
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--line)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="jmsd-avatar">{initials || '—'}</span>
            <span style={{ fontSize: 11.5, color: 'var(--dim)' }} title={operator.email}>
              {operator.name.split(/\s+/)[0]}
            </span>
          </div>
        </div>
      </header>

      <div className="jmsd-body">
        <nav className="jmsd-sidebar">
          <div className="jmsd-brand">
            <div className="jmsd-brand-name">Jose Madrid</div>
            <div className="jmsd-brand-tag">SALSA · EST. 1987</div>
          </div>

          <div className="jmsd-nav">
            {DESKTOP_SECTION_GROUPS.map((group) => (
              <div key={group.label} className="jmsd-nav-group">
                <div className="jmsd-nav-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const badge = badgeFor(item)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="jmsd-nav-item"
                      aria-current={item.id === section.id}
                      onClick={() => void goToSection(item.id)}
                    >
                      <Icon name={item.icon} size={14} />
                      <span className="jmsd-nav-label">{item.label}</span>
                      {item.digit ? <span className="jmsd-nav-key">⌘{item.digit}</span> : null}
                      {badge ? <span className="jmsd-badge">{badge}</span> : null}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="jmsd-sidebar-foot">
            <span className="jmsd-dot jmsd-tone-good" />
            <span>Loaded {new Date(section.loadedAt).toLocaleTimeString('en-US', { timeStyle: 'short' })}</span>
          </div>
        </nav>

        <main className="jmsd-main">
          <div className="jmsd-header">
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div className="jmsd-eyebrow">{section.eyebrow}</div>
              <div className="jmsd-heading">{section.heading}</div>
            </div>
            <div className="jmsd-header-actions">
              {section.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={`jmsd-action ${action.primary ? 'jmsd-action--primary' : ''}`}
                  onClick={() => openPath(action.href)}
                >
                  <Icon name={action.icon} size={13} />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="jmsd-filterbar">
            <div className="jmsd-filter-input">
              <Icon name="i-search" size={12} className="jmsd-tone-muted" />
              <input
                ref={filterInputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelected(0)
                }}
                placeholder="Filter this table  /"
                disabled={!isRowView}
              />
            </div>
            {section.filters.map((label, index) => (
              <button
                key={label}
                type="button"
                className="jmsd-chip"
                aria-pressed={index === filter}
                onClick={() => {
                  setFilter(index)
                  setSelected(0)
                }}
              >
                {label}
              </button>
            ))}
            <span className="jmsd-rowsummary">{rowSummary}</span>
          </div>

          <div className="jmsd-pane">
            {error ? (
              <div className="jmsd-empty">{error}</div>
            ) : body.view === 'dashboard' ? (
              <DashboardView payload={body} onOpen={openPath} />
            ) : body.view === 'analytics' ? (
              <AnalyticsView payload={body} />
            ) : body.view === 'settings' ? (
              <SettingsView payload={body} />
            ) : body.view === 'link' ? (
              <LinkView heading={section.heading} payload={body} onOpen={openPath} />
            ) : body.view === 'events' ? (
              <EventsView
                payload={{ ...body, rows }}
                selected={selected}
                onSelect={setSelected}
                onOpen={openRow}
              />
            ) : (
              <TableView
                columns={body.columns}
                rows={rows}
                totals={body.totals}
                selected={selected}
                onSelect={setSelected}
                onOpen={openRow}
                emptyLabel={
                  allRows.length === 0
                    ? 'Nothing in this table yet.'
                    : 'No rows match the current filter.'
                }
              />
            )}
          </div>
        </main>

        {inspectorOpen ? <Inspector data={inspectorData} /> : null}
      </div>

      <footer className="jmsd-statusbar">
        <span>
          {isRowView && rows.length
            ? `${rows.length} rows · row ${Math.min(selected + 1, rows.length)} selected`
            : 'Jose Madrid Salsa · Zanesville, OH'}
        </span>
        <span className="jmsd-quickfind" style={{ opacity: quickFind ? 1 : 0 }}>
          {quickFind ? `find: ${quickFind}` : ''}
        </span>
        <span className="jmsd-statusbar-keys">
          <span>J/K move</span>
          <span>↵ open</span>
          <span>/ filter</span>
          <span>F cycle</span>
          <span>I inspector</span>
          <span>⌘K search</span>
        </span>
      </footer>

      {paletteOpen ? (
        <div
          className="jmsd-scrim"
          role="presentation"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="jmsd-palette"
            role="dialog"
            aria-label="Command palette"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="jmsd-palette-input">
              <Icon name="i-search" size={15} className="jmsd-tone-accent" />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(event) => {
                  setPaletteQuery(event.target.value)
                  setPaletteIndex(0)
                }}
                placeholder="Jump to a section or a row, or run a command"
              />
              <span className="jmsd-key">ESC</span>
            </div>
            <div className="jmsd-palette-list" role="listbox" aria-label="Results">
              {paletteItems.length === 0 ? (
                <div className="jmsd-empty">Nothing matches.</div>
              ) : (
                paletteItems.map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    role="option"
                    className="jmsd-palette-item"
                    aria-selected={index === paletteIndex}
                    onMouseEnter={() => setPaletteIndex(index)}
                    onClick={item.run}
                  >
                    <Icon name={item.icon} size={14} className="jmsd-tone-muted" />
                    <span>{item.label}</span>
                    <span className="jmsd-palette-hint">{item.hint}</span>
                    {item.shortcut ? <span className="jmsd-key">{item.shortcut}</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className={`jmsd-toast ${toneClass('accent')}`}>{toast}</div> : null}
    </div>
  )
}
