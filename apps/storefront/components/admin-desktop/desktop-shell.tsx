'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DESKTOP_SECTION_GROUPS,
  findPage,
  pagesFor,
  type DesktopSection,
  type DesktopSectionId,
} from '@/lib/admin-desktop/sections'
import type {
  DesktopBadges,
  DesktopCommand,
  Inspector as InspectorData,
  Row,
  SectionPayload,
} from '@/lib/admin-desktop/types'
import { matchesShortcut } from '@/lib/admin-desktop/shortcuts'
import {
  hasCustomWidths,
  readColumnWidths,
  withColumnWidth,
  withoutColumnWidth,
  withoutSectionWidths,
  writeColumnWidths,
  type ColumnWidths,
} from '@/lib/admin-desktop/columns'
import { findForm } from '@/lib/admin-desktop/forms'
import { Icon, IconSprite } from './icons'
import { RecordSheet, type SheetRequest } from './record-sheet'
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

/** Thrown for a 403 so the shell can say why rather than blaming the network. */
class SectionDeniedError extends Error {}

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

/** A `write` command waiting on the operator to say yes. */
interface PendingConfirm {
  message: string
  command: Extract<DesktopCommand, { kind: 'write' }>
}

export function DesktopShell({
  initialSection,
  badges,
  operator,
  visibleSections,
}: {
  initialSection: SectionPayload
  badges: DesktopBadges
  operator: { name: string; email: string }
  /**
   * The sections this account may load, resolved on the server from the same
   * permissions the web panel checks. Anything absent is left out of the
   * sidebar and the palette rather than offered and then refused.
   */
  visibleSections?: DesktopSectionId[]
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
  const [sheet, setSheet] = useState<SheetRequest | null>(null)
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null)
  const [working, setWorking] = useState(false)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({})

  const filterInputRef = useRef<HTMLInputElement>(null)
  const quickFindTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The request that owns the current render, so a slow section cannot land after a fast one. */
  const requestId = useRef(0)
  /** The row id to re-select once a reload lands, so a save does not lose your place. */
  const restoreRow = useRef<string | null>(null)

  // Undefined means "no list was supplied" — every section shows, which is what
  // an older server render or a test fixture expects. An empty array is a real
  // answer and hides everything.
  const permitted = useMemo(
    () => (visibleSections ? new Set<DesktopSectionId>(visibleSections) : null),
    [visibleSections],
  )

  const groups = useMemo(
    () =>
      DESKTOP_SECTION_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !permitted || permitted.has(item.id)),
      })).filter((group) => group.items.length > 0),
    [permitted],
  )

  const sections = useMemo(() => groups.flatMap((group) => group.items), [groups])
  const allSections = useMemo(() => DESKTOP_SECTION_GROUPS.flatMap((group) => group.items), [])
  const currentSection = useMemo(
    () => allSections.find((item) => item.id === section.id) ?? allSections[0],
    [allSections, section.id],
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

  // Column widths are read after mount rather than during render, because the
  // server has no idea what this window's operator dragged.
  useEffect(() => {
    setColumnWidths(readColumnWidths())
  }, [])

  const flash = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])

  // ------------------------------------------------------------ loading

  /**
   * Load one page.
   *
   * `id` is a section id for a section's own list, or a page id inside one —
   * the route resolves both, so the shell never has to know which sub-page a
   * command meant, only its name.
   */
  const fetchSection = useCallback(async (id: string, keepPlace: boolean) => {
    const entry = findPage(id)
    const sectionId = entry?.section.id ?? (id as DesktopSectionId)
    const ticket = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const query = entry && entry.page.id !== sectionId ? `?page=${encodeURIComponent(entry.page.id)}` : ''
      const response = await fetch(`/api/admin/desktop/${sectionId}${query}`, { credentials: 'same-origin' })
      if (response.status === 403) throw new SectionDeniedError()
      if (!response.ok) throw new Error(`Request failed with ${response.status}`)
      const payload = (await response.json()) as SectionPayload
      if (ticket !== requestId.current) return

      setSection(payload)
      if (!keepPlace) {
        setSelected(0)
        setQuery('')
        setFilter(0)
      }
    } catch (failure) {
      if (ticket !== requestId.current) return
      setError(
        failure instanceof SectionDeniedError
          ? 'Your account does not have permission to open that page.'
          : 'Could not load that page. Check the connection and try again.',
      )
    } finally {
      if (ticket === requestId.current) setLoading(false)
    }
  }, [])

  /**
   * Move the window to one page.
   *
   * Everything that navigates goes through here — the sidebar, the page strip,
   * the palette and a `section`/`page` command — so the URL, the menu bars and
   * what is on screen can never disagree about where the window is.
   */
  const goToPage = useCallback(
    async (id: string) => {
      setPaletteOpen(false)
      if (id === section.page) return

      await fetchSection(id, false)

      // Keep `?section=`/`?page=` in step so a reload, and the macOS and Windows
      // menu bars, all agree on where the window is. Replace rather than push:
      // switching pages is not something the back button should walk through.
      try {
        const entry = findPage(id)
        const url = new URL(window.location.href)
        url.searchParams.set('section', entry?.section.id ?? id)
        if (entry && entry.page.id !== entry.section.id) url.searchParams.set('page', entry.page.id)
        else url.searchParams.delete('page')
        window.history.replaceState(null, '', url)
      } catch {
        // A window that will not let us rewrite its URL still navigated fine.
      }
    },
    [section.page, fetchSection],
  )

  const goToSection = useCallback((id: DesktopSectionId) => goToPage(id), [goToPage])

  /** Reload what is on screen, keeping the filter and the selected row. */
  const reload = useCallback(() => fetchSection(section.page, true), [fetchSection, section.page])

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

  // ------------------------------------------------------------ columns

  const sectionWidths = columnWidths[section.id]

  const resizeColumn = useCallback(
    (key: string, width: number) => {
      setColumnWidths((previous) => {
        const next = withColumnWidth(previous, section.id, key, width)
        writeColumnWidths(next)
        return next
      })
    },
    [section.id],
  )

  const resetColumn = useCallback(
    (key: string) => {
      setColumnWidths((previous) => {
        const next = withoutColumnWidth(previous, section.id, key)
        writeColumnWidths(next)
        return next
      })
      flash(`${key} back to its default width`)
    },
    [section.id, flash],
  )

  const resetAllColumns = useCallback(() => {
    setColumnWidths((previous) => {
      const next = withoutSectionWidths(previous, section.id)
      writeColumnWidths(next)
      return next
    })
    flash('Column widths reset')
  }, [section.id, flash])

  // ------------------------------------------------------------- writes

  /** Send one no-form mutation, then reload so the table shows what happened. */
  const runWrite = useCallback(
    async (command: Extract<DesktopCommand, { kind: 'write' }>) => {
      if (working) return
      setWorking(true)
      setConfirming(null)

      try {
        const response = await fetch('/api/admin/desktop/write', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: command.op, recordId: command.recordId, values: command.values ?? {} }),
        })

        const body = (await response.json()) as { ok?: boolean; message?: string; error?: string }

        if (!response.ok || !body.ok) {
          flash(body.error ?? 'That did not go through.')
          return
        }

        restoreRow.current = command.recordId ?? null
        flash(command.success ?? body.message ?? 'Done')
        await reload()
      } catch {
        flash('Could not reach the server. Check the connection and try again.')
      } finally {
        setWorking(false)
      }
    },
    [working, flash, reload],
  )

  /**
   * The one place a button turns into something happening.
   *
   * Everything the window can do arrives here as a command, which is what lets
   * the shell act in place: a create opens a sheet, a status change asks and
   * then writes, and only the handful of pages the shell does not draw itself
   * are still a navigation.
   */
  const runCommand = useCallback(
    (command: DesktopCommand) => {
      setPaletteOpen(false)

      switch (command.kind) {
        case 'form':
          if (!findForm(command.form)) {
            flash('That form is not available in this window yet.')
            return
          }
          setSheet({
            form: command.form,
            recordId: command.recordId,
            values: command.values,
            title: command.title,
          })
          return

        case 'write':
          if (command.confirm) {
            setConfirming({ message: command.confirm, command })
            return
          }
          void runWrite(command)
          return

        case 'section':
          void goToSection(command.section)
          return

        case 'page':
          void goToPage(command.page)
          return

        case 'open':
          openPath(command.href)
          return
      }
    },
    [flash, runWrite, goToSection, goToPage, openPath],
  )

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

  // A reload after a write puts the cursor back on the row that was acted on,
  // rather than snapping to the top of a list somebody was working down.
  useEffect(() => {
    const wanted = restoreRow.current
    if (!wanted) return
    restoreRow.current = null
    const index = rows.findIndex((row) => row.id === wanted)
    if (index >= 0) setSelected(index)
  }, [rows])

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

    // The current section's own header buttons, so "New fundraiser" is reachable
    // by typing it rather than only by finding the button.
    for (const action of section.actions) {
      items.push({
        key: `action:${section.id}:${action.label}`,
        label: action.label,
        hint: currentSection.label,
        icon: action.icon,
        run: () => runCommand(action.command),
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

    // Every page of every visible section, so a page two clicks in — the
    // suppression list, the show archive — is still one ⌘K away.
    for (const item of sections) {
      for (const entry of pagesFor(item)) {
        if (entry.id === item.id) continue
        items.push({
          key: `page:${entry.id}`,
          label: `${item.label} · ${entry.label}`,
          hint: entry.path,
          icon: item.icon,
          run: () => void goToPage(entry.id),
        })
      }
    }

    items.push({
      key: 'command:refresh',
      label: 'Refresh this section',
      hint: 'Read the data again',
      icon: 'i-rotate',
      shortcut: 'F5',
      run: () => {
        setPaletteOpen(false)
        void reload()
      },
    })
    items.push({
      key: 'command:columns',
      label: 'Reset column widths',
      hint: hasCustomWidths(columnWidths, section.id)
        ? `${currentSection.label} has hand-set widths`
        : `${currentSection.label} is on its default widths`,
      icon: 'i-columns',
      run: () => {
        setPaletteOpen(false)
        resetAllColumns()
      },
    })
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
      // Filtering happens first, so anything is reachable by typing; the cap
      // only bounds how long the unfiltered browse list gets.
      .slice(0, 80)
  }, [
    sections,
    section.actions,
    section.id,
    allRows,
    rows,
    currentSection,
    paletteQuery,
    columnWidths,
    goToSection,
    goToPage,
    runCommand,
    cycleAppearance,
    resetAllColumns,
    reload,
    openPath,
    flash,
  ])

  // ------------------------------------------------------------ keyboard

  const openRow = useCallback(
    (row: Row | null) => {
      if (row?.open) runCommand(row.open)
      else flash('There is nothing to open on this row')
    },
    [runCommand, flash],
  )

  /** True while a sheet or a confirmation owns the keyboard. */
  const modalOpen = sheet !== null || confirming !== null

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A sheet and a confirmation handle their own keys; the table's j/k and
      // type-ahead must not fire underneath one.
      if (modalOpen) return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase() ?? ''
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable === true
      const accel = event.metaKey || event.ctrlKey

      if (event.key === 'F5') {
        event.preventDefault()
        void reload()
        return
      }

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

      // The inspector's own buttons, on the keys their labels advertise. These
      // are checked before the plain-key handlers below because they carry a
      // modifier, which the table's type-ahead deliberately ignores.
      if (!typing && inspectorOpen && inspectorData?.actions?.length) {
        const hit = inspectorData.actions.find(
          (action) => action.shortcut && matchesShortcut(action.shortcut, event),
        )
        if (hit) {
          event.preventDefault()
          runCommand(hit.command)
          return
        }
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
  }, [
    modalOpen,
    paletteOpen,
    paletteItems,
    paletteIndex,
    rows,
    activeRow,
    sections,
    section.filters.length,
    quickFind,
    goToSection,
    openRow,
    inspectorOpen,
    inspectorData,
    runCommand,
    reload,
  ])

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
          {loading || working ? (
            <span className="jmsd-mono" style={{ color: 'var(--goldt)', fontSize: 10.5 }}>
              {working ? 'saving…' : 'loading…'}
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
          <button
            type="button"
            className="jmsd-icon-button"
            title="Refresh this section"
            onClick={() => void reload()}
          >
            <Icon name="i-rotate" size={14} />
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
            {groups.map((group) => (
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
                  className={[
                    'jmsd-action',
                    action.primary ? 'jmsd-action--primary' : '',
                    action.danger ? 'jmsd-action--danger' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => runCommand(action.command)}
                >
                  <Icon name={action.icon} size={13} />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Absent on an older server render; one page needs no strip. */}
          {(section.pages?.length ?? 0) > 1 ? (
            <div className="jmsd-pagestrip" role="tablist" aria-label={`${currentSection.label} pages`}>
              {section.pages.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  className="jmsd-pagetab"
                  aria-selected={entry.id === section.page}
                  onClick={() => void goToPage(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          ) : null}

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
            {isRowView && hasCustomWidths(columnWidths, section.id) ? (
              <button type="button" className="jmsd-chip" onClick={resetAllColumns} title="Back to the default widths">
                <Icon name="i-columns" size={11} />
                <span style={{ marginLeft: 5 }}>Reset columns</span>
              </button>
            ) : null}
            <span className="jmsd-rowsummary">{rowSummary}</span>
          </div>

          <div className="jmsd-pane">
            {error ? (
              <div className="jmsd-empty">{error}</div>
            ) : body.view === 'dashboard' ? (
              <DashboardView payload={body} onRun={runCommand} />
            ) : body.view === 'analytics' ? (
              <AnalyticsView payload={body} />
            ) : body.view === 'settings' ? (
              <SettingsView payload={body} onRun={runCommand} />
            ) : body.view === 'link' ? (
              <LinkView heading={section.heading} payload={body} onOpen={openPath} />
            ) : body.view === 'events' ? (
              <EventsView
                payload={{ ...body, rows }}
                selected={selected}
                onSelect={setSelected}
                onOpen={openRow}
                widths={sectionWidths}
                onResize={resizeColumn}
                onResetColumn={resetColumn}
              />
            ) : (
              <TableView
                columns={body.columns}
                rows={rows}
                totals={body.totals}
                selected={selected}
                onSelect={setSelected}
                onOpen={openRow}
                widths={sectionWidths}
                onResize={resizeColumn}
                onResetColumn={resetColumn}
                emptyLabel={
                  allRows.length === 0
                    ? 'Nothing in this table yet.'
                    : 'No rows match the current filter.'
                }
              />
            )}
          </div>
        </main>

        {inspectorOpen ? <Inspector data={inspectorData} onRun={runCommand} /> : null}
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

      {sheet ? (
        <RecordSheet
          request={sheet}
          onClose={() => setSheet(null)}
          onSaved={(message, recordId) => {
            setSheet(null)
            restoreRow.current = recordId
            flash(message)
            void reload()
          }}
        />
      ) : null}

      {confirming ? (
        <div className="jmsd-scrim" role="presentation" onClick={() => setConfirming(null)}>
          <div
            className="jmsd-confirm"
            role="alertdialog"
            aria-label="Confirm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="jmsd-confirm-text">{confirming.message}</div>
            <div className="jmsd-sheet-buttons">
              <button type="button" className="jmsd-action" onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                className={`jmsd-action jmsd-action--primary ${confirming.command.danger ? 'jmsd-action--danger' : ''}`}
                onClick={() => void runWrite(confirming.command)}
                disabled={working}
              >
                {working ? 'Working…' : 'Yes, do it'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className={`jmsd-toast ${toneClass('accent')}`}>{toast}</div> : null}
    </div>
  )
}
