'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DESKTOP_SECTION_GROUPS,
  findPage,
  pageKind,
  pagesFor,
  type DesktopPage,
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
import { filterRows, listSearch, MAX_LIST_LIMIT, ROW_LIMIT, searchQuery, type ListQuery } from '@/lib/admin-desktop/list'
import { bulkActions, type BulkAction } from '@/lib/admin-desktop/bulk'
import { attentionCount, badgeAlerts, type DesktopAlert } from '@/lib/admin-desktop/alerts'
import { Icon, IconSprite } from './icons'
import { RecordSheet, type SheetRequest } from './record-sheet'
import { ScanSheet } from './scan-sheet'
import { MailView } from './mail-view'
import {
  AnalyticsView,
  DashboardView,
  EventsView,
  Inspector,
  LinkView,
  SettingsView,
  TableView,
  toneClass,
  type RowClick,
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
    /**
     * Injected by the macOS and Windows apps. `notify` and `setBadge` reach the
     * native notification centre and the dock or taskbar; a browser tab has
     * neither, and the shell carries on without them.
     */
    jmsDesktop?: {
      platform?: string
      chrome?: FrameChrome
      notify?: (alert: DesktopAlert) => void
      setBadge?: (count: number) => void
      /** Print a 4×6 label image on the label printer set in the app's settings. */
      printLabel?: (url: string) => void
    }
  }
}

/** Thrown for a 403 so the shell can say why rather than blaming the network. */
class SectionDeniedError extends Error {}

/**
 * How often an open window reads its page again on its own. A window left open
 * all day should show the order that came in at lunch without anyone pressing
 * F5. Paused while the window is hidden or something modal is open.
 */
const AUTO_REFRESH_MS = 60_000

/** Coming back to a window whose data is older than this reloads it at once. */
const STALE_AFTER_MS = 30_000

/**
 * How often the badge counts are read on their own. Unlike the page refresh this
 * keeps going while the window is hidden — a hidden window is exactly when a
 * new-order notification is worth having. The apps keep the page's timers
 * running in the background for it.
 */
const BADGE_POLL_MS = 60_000

/** How long the filter box waits for typing to stop before searching the server. */
const SEARCH_DEBOUNCE_MS = 350

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

type WriteCommand = Extract<DesktopCommand, { kind: 'write' }>

/** A write — one, or one per marked row — waiting on the operator to say yes. */
interface PendingConfirm {
  message: string
  danger?: boolean
  run: () => void
}

interface FetchOptions {
  /** Keep the filter, the chip and the cursor's row rather than starting fresh. */
  keepPlace?: boolean
  list?: Partial<ListQuery>
  /** A background refresh: no spinner, and a failure leaves the screen as it was. */
  silent?: boolean
}

/**
 * The Mail page's payload, built here rather than fetched: MailView reads the
 * mailbox API itself, so the section route has nothing to add. The empty link
 * body keeps every table-only control — filter box, bulk bar, row counts,
 * inspector — switched off.
 */
function mailPayload(entry: { section: DesktopSection; page: DesktopPage }, visiblePages?: string[]): SectionPayload {
  return {
    id: entry.section.id,
    page: entry.page.id,
    pages: pagesFor(entry.section)
      .filter((page) => !visiblePages || visiblePages.includes(page.id))
      .map(({ id, label }) => ({ id, label })),
    kind: 'mail',
    eyebrow: entry.section.label.toUpperCase(),
    heading: entry.page.label,
    path: entry.page.path,
    filters: [],
    actions: [],
    body: { view: 'link', note: '', views: [] },
    loadedAt: new Date().toISOString(),
  }
}

function mailEntry(id: string) {
  const entry = findPage(id)
  return entry && pageKind(entry.section, entry.page) === 'mail' ? entry : undefined
}

/** POST one write and read back the route's fixed answer shape. */
async function postWrite(command: WriteCommand): Promise<{ message: string } | { error: string }> {
  try {
    const response = await fetch('/api/admin/desktop/write', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: command.op, recordId: command.recordId, values: command.values ?? {} }),
    })
    const body = (await response.json()) as { ok?: boolean; message?: string; error?: string }
    if (!response.ok || !body.ok) return { error: body.error ?? 'That did not go through.' }
    return { message: body.message ?? 'Done' }
  } catch {
    return { error: 'Could not reach the server. Check the connection and try again.' }
  }
}

export function DesktopShell({
  initialSection,
  badges,
  operator,
  visibleSections,
  visiblePages,
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
  /**
   * The page ids this account may load, resolved beside `visibleSections`. A
   * page needing a permission its section does not — the credential vault, the
   * integrations sheet — is absent, so ⌘K never offers a command that answers
   * 403. Undefined means the caller did not filter, and every page is offered.
   */
  visiblePages?: string[]
}) {
  const [section, setSection] = useState<SectionPayload>(() => {
    // A cold load at ?page=messages.mail arrives with the section's table body.
    const mail = mailEntry(initialSection.page)
    return mail ? mailPayload(mail, visiblePages) : initialSection
  })
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
  const [scanning, setScanning] = useState(false)
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null)
  const [working, setWorking] = useState(false)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({})
  const [badgeCounts, setBadgeCounts] = useState<DesktopBadges>(badges)
  /** Row ids marked for a bulk action. */
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set())

  const filterInputRef = useRef<HTMLInputElement>(null)
  const quickFindTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The request that owns the current render, so a slow section cannot land after a fast one. */
  const requestId = useRef(0)
  /** The row id to re-select once a reload lands, so a save does not lose your place. */
  const restoreRow = useRef<string | null>(null)
  /** The row under the cursor, read by reloads that should keep it there. */
  const activeRowId = useRef<string | null>(null)

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
  /** Undefined when the caller did not filter — then every page is offered. */
  const allowedPageIds = useMemo(
    () => (visiblePages ? new Set(visiblePages) : undefined),
    [visiblePages],
  )
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
  const fetchSection = useCallback(async (id: string, { keepPlace = false, list = {}, silent = false }: FetchOptions = {}) => {
    const entry = findPage(id)
    const sectionId = entry?.section.id ?? (id as DesktopSectionId)
    const ticket = ++requestId.current
    const mail = mailEntry(id)
    if (mail) {
      // Mail loads itself; a reload or auto-refresh here has nothing to do.
      if (keepPlace || silent) return
      setSection(mailPayload(mail, visiblePages))
      setError(null)
      setLoading(false)
      setSelected(0)
      setQuery('')
      setFilter(0)
      setMarked(new Set())
      return
    }
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    try {
      const params = new URLSearchParams(listSearch(list))
      if (entry && entry.page.id !== sectionId) params.set('page', entry.page.id)
      const query = params.toString() ? `?${params}` : ''
      const response = await fetch(`/api/admin/desktop/${sectionId}${query}`, { credentials: 'same-origin' })
      if (response.status === 403) throw new SectionDeniedError()
      if (!response.ok) throw new Error(`Request failed with ${response.status}`)
      const payload = (await response.json()) as SectionPayload
      if (ticket !== requestId.current) return

      // Rows arrive newest first, so a new order pushes everything down one.
      // Follow the row rather than the index, or the cursor lands on a neighbour.
      if (keepPlace && restoreRow.current === null) restoreRow.current = activeRowId.current
      setSection(payload)
      if (payload.badges) setBadgeCounts(payload.badges)
      if (!keepPlace) {
        setSelected(0)
        setQuery('')
        setFilter(0)
        setMarked(new Set())
      }
    } catch (failure) {
      if (ticket !== requestId.current) return
      // A background refresh that fails leaves the screen as it was; the next
      // one, or F5, will try again.
      if (silent) return
      setError(
        failure instanceof SectionDeniedError
          ? 'Your account does not have permission to open that page.'
          : 'Could not load that page. Check the connection and try again.',
      )
    } finally {
      if (ticket === requestId.current) setLoading(false)
    }
  }, [visiblePages])

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

      await fetchSection(id)

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

  /** Reload what is on screen, keeping the filter, the search window and the selected row. */
  const reload = useCallback(
    (silent = false) =>
      fetchSection(section.page, {
        keepPlace: true,
        list: { q: section.list?.q, limit: section.list?.limit },
        silent,
      }),
    [fetchSection, section.page, section.list?.q, section.list?.limit],
  )

  /** Widen the window by another page of rows. */
  const loadMore = useCallback(() => {
    const list = section.list
    if (!list) return
    void fetchSection(section.page, {
      keepPlace: true,
      list: { q: list.q, limit: Math.min(list.limit + ROW_LIMIT, MAX_LIST_LIMIT) },
    })
  }, [fetchSection, section.page, section.list])

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

  // ------------------------------------------------------------- badges

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch('/api/admin/desktop/badges', { credentials: 'same-origin' })
        if (response.ok) setBadgeCounts((await response.json()) as DesktopBadges)
      } catch {
        // The next poll, or the next page load, will bring them.
      }
    }, BADGE_POLL_MS)
    return () => clearInterval(timer)
  }, [])

  // Tell the native app when work arrives, and keep its dock or taskbar badge
  // at what is still waiting. The counts the window opened with are the
  // baseline: opening the app is not news.
  const lastBadges = useRef(badges)
  useEffect(() => {
    const bridge = window.jmsDesktop
    const canSee = (id: DesktopSectionId) => !permitted || permitted.has(id)
    for (const alert of badgeAlerts(lastBadges.current, badgeCounts, canSee)) bridge?.notify?.(alert)
    lastBadges.current = badgeCounts
    bridge?.setBadge?.(attentionCount(badgeCounts, canSee))
  }, [badgeCounts, permitted])

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
    async (command: WriteCommand) => {
      if (working) return
      setWorking(true)
      setConfirming(null)

      try {
        const result = await postWrite(command)
        if ('error' in result) {
          flash(result.error)
          return
        }

        restoreRow.current = command.recordId ?? null
        flash(command.success ?? result.message)
        await reload()
      } finally {
        setWorking(false)
      }
    },
    [working, flash, reload],
  )

  /**
   * Run one bulk action: each marked row's own command, one after another.
   *
   * In sequence rather than all at once, so thirty orders do not land on the
   * database as thirty simultaneous transactions, and a failure part way is
   * reported by count rather than lost in a race.
   */
  const runBulk = useCallback(
    async (action: BulkAction) => {
      if (working) return
      setWorking(true)
      setConfirming(null)

      let done = 0
      let firstError: string | null = null
      try {
        for (const command of action.commands) {
          const result = await postWrite(command)
          if ('error' in result) firstError ??= result.error
          else done += 1
        }
      } finally {
        const failed = action.commands.length - done
        flash(
          failed === 0
            ? `${action.label}: ${done} done`
            : `${action.label}: ${done} done, ${failed} failed — ${firstError}`,
        )
        setMarked(new Set())
        setWorking(false)
        await reload()
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
            setConfirming({ message: command.confirm, danger: command.danger, run: () => void runWrite(command) })
            return
          }
          void runWrite(command)
          return

        case 'scan':
          setScanning(true)
          return

        case 'label': {
          const print = window.jmsDesktop?.printLabel
          if (print) {
            print(command.href)
            flash('Sent to the label printer')
          } else {
            // A browser tab: the label is an image on the carrier's host, so
            // open it beside the shell rather than navigating away from it.
            window.open(command.href, '_blank', 'noopener')
          }
          return
        }

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
  const isMail = section.kind === 'mail'
  const isRowView = body.view === 'table' || body.view === 'events'
  const allRows: Row[] = useMemo(
    () => (body.view === 'table' || body.view === 'events' ? body.rows : []),
    [body],
  )

  const rows = useMemo(
    () => filterRows(allRows, { query, filter, serverQuery: section.list?.q }),
    [allRows, query, filter, section.list?.q],
  )

  // The filter box searches the database on lists that outgrow their window,
  // once typing stops. Only when the window could be hiding matches (or to undo
  // a server search) — a list that fits is already filtered on the spot.
  const list = section.list
  useEffect(() => {
    if (!list?.searchable) return
    const wanted = searchQuery(query)
    if (wanted === list.q || (!list.more && !list.q)) return
    const timer = setTimeout(() => {
      setSelected(0)
      void fetchSection(section.page, { keepPlace: true, list: { q: wanted } })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, list, section.page, fetchSection])

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
  useEffect(() => {
    activeRowId.current = activeRow?.id ?? null
  }, [activeRow])

  // Marks follow the rows: one that a reload or a search removed is dropped
  // rather than acted on unseen.
  const markedRows = useMemo(() => allRows.filter((row) => marked.has(row.id)), [allRows, marked])
  const bulk = useMemo(() => bulkActions(markedRows), [markedRows])

  /** A click on a row: plain moves the cursor, ⌘/Ctrl toggles a mark, Shift marks a run. */
  const clickRow = useCallback(
    (index: number, click?: RowClick) => {
      const row = rows[index]
      if (row && (click?.metaKey || click?.ctrlKey)) {
        setMarked((previous) => {
          const next = new Set(previous)
          if (next.has(row.id)) next.delete(row.id)
          else next.add(row.id)
          return next
        })
      } else if (row && click?.shiftKey) {
        const [from, to] = index < selected ? [index, selected] : [selected, index]
        setMarked((previous) => new Set([...previous, ...rows.slice(from, to + 1).map((entry) => entry.id)]))
      }
      setSelected(index)
    },
    [rows, selected],
  )

  const askBulk = useCallback(
    (action: BulkAction) => {
      const count = action.commands.length
      setConfirming({
        message: `${action.label} — ${count} ${count === 1 ? 'row' : 'rows'}? Each is done and logged exactly as if you pressed it on that record.`,
        danger: action.danger,
        run: () => void runBulk(action),
      })
    },
    [runBulk],
  )

  /** Download the rows on screen — chip, filter box and all — without the window's row cap. */
  const exportCsv = useCallback(() => {
    const params = new URLSearchParams({ format: 'csv' })
    if (section.page !== section.id) params.set('page', section.page)
    if (query.trim()) params.set('q', query.trim())
    if (filter) params.set('filter', String(filter))
    // A link with `download` rather than a navigation, so the desktop windows
    // save the file instead of showing it in place of the shell.
    const link = document.createElement('a')
    link.href = `/api/admin/desktop/${section.id}?${params}`
    link.download = ''
    document.body.append(link)
    link.click()
    link.remove()
    flash('Preparing the CSV…')
  }, [section.id, section.page, query, filter, flash])

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
    // suppression list, the show archive — is still one ⌘K away. Filtered to
    // what this account may actually load: the sidebar was already permission
    // filtered, but a section can hold a page that needs more than it does.
    for (const item of sections) {
      for (const entry of pagesFor(item)) {
        if (entry.id === item.id) continue
        if (allowedPageIds && !allowedPageIds.has(entry.id)) continue
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
    if (isRowView) {
      items.push({
        key: 'command:export',
        label: 'Export to CSV',
        hint: `${currentSection.label} · the rows the filter shows, without the row cap`,
        icon: 'i-file',
        run: () => {
          setPaletteOpen(false)
          exportCsv()
        },
      })
      items.push({
        key: 'command:mark-all',
        label: 'Mark every row shown',
        hint: `${rows.length} rows · for a bulk action`,
        icon: 'i-columns',
        run: () => {
          setPaletteOpen(false)
          setMarked(new Set(rows.map((row) => row.id)))
        },
      })
    }
    if (section.list?.more && section.list.limit < MAX_LIST_LIMIT) {
      items.push({
        key: 'command:more',
        label: 'Load more rows',
        hint: `Showing the newest ${section.list.limit}`,
        icon: 'i-rotate',
        run: () => {
          setPaletteOpen(false)
          loadMore()
        },
      })
    }
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
    allowedPageIds,
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
    isRowView,
    exportCsv,
    loadMore,
    section.list,
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
  const modalOpen = sheet !== null || confirming !== null || scanning

  // Keep what is on screen current without anyone pressing F5: on a timer while
  // the window is visible, and at once when it comes back after a while away.
  // Never under a sheet, a confirmation or the palette, and never while a load
  // or a write is already in flight — the refresh is silent, so it must not
  // race something the operator is waiting on.
  const autoRefresh = useRef({ blocked: false, loadedAt: 0, reload })
  useEffect(() => {
    autoRefresh.current = {
      blocked: modalOpen || paletteOpen || loading || working,
      loadedAt: Date.parse(section.loadedAt),
      reload,
    }
  })
  useEffect(() => {
    const refresh = () => {
      const state = autoRefresh.current
      if (document.visibilityState !== 'visible' || state.blocked) return
      void state.reload(true)
    }
    const onReturn = () => {
      if (Date.now() - autoRefresh.current.loadedAt > STALE_AFTER_MS) refresh()
    }
    const timer = setInterval(refresh, AUTO_REFRESH_MS)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [])

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
        else if (marked.size > 0) setMarked(new Set())
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

      // MailView owns the plain keys on its page (e, #, r, f, …).
      if (isMail) return

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
      // Space on a focused button presses it; only a row (or nothing) marks.
      const onControl =
        target instanceof Element && Boolean(target.closest('button, a, select')) && !target.closest('.jmsd-row')
      if (event.key === ' ' && activeRow && !onControl) {
        event.preventDefault()
        const id = activeRow.id
        setMarked((previous) => {
          const next = new Set(previous)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
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
    marked.size,
    isMail,
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

  const badgeFor = (item: DesktopSection) => badgeCounts[item.id as keyof DesktopBadges]
  const initials = operator.name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const rowSummary = !isRowView
    ? section.path
    : list?.q && list.q === query.trim()
      ? `${rows.length}${list.more ? '+' : ''} ${rows.length === 1 && !list.more ? 'match' : 'matches'} in the database`
      : `${rows.length} of ${allRows.length}${list?.more ? '+' : ''} rows`

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

          {isMail ? null : (
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
              {isRowView && list?.more && list.limit < MAX_LIST_LIMIT ? (
                <button type="button" className="jmsd-chip" onClick={loadMore} title="Read the next rows">
                  Load more
                </button>
              ) : null}
              {isRowView ? (
                <button
                  type="button"
                  className="jmsd-chip"
                  onClick={exportCsv}
                  aria-label="Export CSV"
                  title="Export these rows as CSV"
                >
                  <Icon name="i-file" size={11} />
                </button>
              ) : null}
            </div>
          )}

          {isRowView && marked.size > 0 ? (
            <div className="jmsd-bulkbar" role="toolbar" aria-label="Bulk actions">
              <span className="jmsd-bulkbar-count">{markedRows.length} marked</span>
              {bulk.length === 0 ? (
                <span className="jmsd-bulkbar-note">No action is shared by every marked row.</span>
              ) : (
                bulk.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={`jmsd-action ${action.danger ? 'jmsd-action--danger' : ''}`}
                    disabled={working}
                    onClick={() => askBulk(action)}
                  >
                    {action.label}
                  </button>
                ))
              )}
              <button type="button" className="jmsd-chip jmsd-bulkbar-clear" onClick={() => setMarked(new Set())}>
                Clear · Esc
              </button>
            </div>
          ) : null}

          <div className="jmsd-pane">
            {isMail ? (
              <MailView onOpenPath={openPath} />
            ) : error ? (
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
                marked={marked}
                onSelect={clickRow}
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
                marked={marked}
                onSelect={clickRow}
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

        {inspectorOpen && !isMail ? <Inspector data={inspectorData} onRun={runCommand} /> : null}
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
        {isMail ? (
          <span className="jmsd-statusbar-keys">
            <span>J/K move</span>
            <span>↵ open</span>
            <span>U back</span>
            <span>E archive</span>
            <span># trash</span>
            <span>S star</span>
            <span>R/A/F reply · all · fwd</span>
            <span>C compose</span>
            <span>/ search</span>
          </span>
        ) : (
          <span className="jmsd-statusbar-keys">
            <span>J/K move</span>
            <span>↵ open</span>
            <span>/ filter</span>
            <span>F cycle</span>
            <span>Space mark</span>
            <span>I inspector</span>
            <span>⌘K search</span>
          </span>
        )}
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

      {scanning ? (
        <ScanSheet
          postWrite={postWrite}
          onClose={() => setScanning(false)}
          onApplied={(message) => {
            setScanning(false)
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
                className={`jmsd-action jmsd-action--primary ${confirming.danger ? 'jmsd-action--danger' : ''}`}
                onClick={confirming.run}
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
