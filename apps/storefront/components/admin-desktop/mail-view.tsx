'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Icon } from './icons'

/**
 * The Mail page: the connected Gmail mailbox as a three-pane client — folders,
 * conversations, reader — talking to `/api/admin/mailbox` directly. The shell
 * draws nothing else on this page (no filter bar, no inspector), so every key
 * below belongs to the mail client while it is on screen.
 */

interface MailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  unread: number
  total: number
  color: string | null
}

interface ThreadSummary {
  id: string
  subject: string
  from: string
  snippet: string
  date: string
  unread: boolean
  starred: boolean
  labelIds: string[]
  messageCount: number
}

interface MailAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

interface MailMessage {
  id: string
  from: string
  to: string
  cc: string
  date: string
  subject: string
  labelIds: string[]
  html: string | null
  text: string
  attachments: MailAttachment[]
  rfcMessageId: string | null
  references: string | null
}

interface ThreadDetail {
  id: string
  subject: string
  labelIds: string[]
  messages: MailMessage[]
}

interface OrganizeResult {
  scanned: number
  filed: Record<string, number>
  keptInInbox: number
  leftForTriage: number
  unmatched: number
  errors: string[]
}

type ThreadAction =
  | 'archive'
  | 'inbox'
  | 'read'
  | 'unread'
  | 'star'
  | 'unstar'
  | 'important'
  | 'unimportant'
  | 'spam'
  | 'notspam'
  | 'trash'
  | 'untrash'

interface OutgoingAttachment {
  filename: string
  mimeType: string
  /** Base64 without the `data:` prefix. */
  data: string
}

export interface ComposeDraft {
  title: string
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
  references?: string
  note?: string
}

const SYSTEM_LABELS: Record<string, string> = {
  INBOX: 'Inbox',
  STARRED: 'Starred',
  IMPORTANT: 'Important',
  SENT: 'Sent',
  DRAFT: 'Drafts',
  SPAM: 'Spam',
  TRASH: 'Trash',
}

/** The folders the organizer files into, in the order the sidebar shows them. */
const ORGANIZER_FOLDERS = [
  'Orders',
  'Contact',
  'Fundraisers',
  'Wholesale',
  'Shipping',
  'Finance',
  'Website',
  'Events & Shows',
  'Marketing & Social',
  'Newsletters',
]

/** Matches the send route's cap on base64 attachment data (about 3 MB of files). */
const MAX_ATTACHMENT_BASE64 = 4_000_000

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/

class MailError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function api<T>(url: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(
      url,
      body === undefined
        ? { credentials: 'same-origin' }
        : {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
    )
  } catch {
    throw new MailError(0, 'Could not reach the server. Check the connection and try again.')
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new MailError(response.status, data.error ?? `Request failed with ${response.status}`)
  return data
}

function message(failure: unknown): string {
  if (failure instanceof MailError && (failure.status === 401 || failure.status === 403)) {
    return "You don't have access to the mailbox."
  }
  return failure instanceof Error ? failure.message : 'Something went wrong.'
}

/** Every address in a header like `"Lang, Jordan" <j@x.com>, b@y.com`, lower-cased. */
export function addressesIn(header: string): string[] {
  return (header.match(/[^\s<>,;"]+@[^\s<>,;"]+/g) ?? []).map((address) => address.toLowerCase())
}

function unique(list: string[], exclude: string): string[] {
  const out: string[] = []
  for (const address of list) if (address !== exclude && !out.includes(address)) out.push(address)
  return out
}

function prefixed(subject: string, prefix: 'Re' | 'Fwd'): string {
  const pattern = prefix === 'Re' ? /^re:/i : /^(fwd?|fw):/i
  return pattern.test(subject.trim()) ? subject : `${prefix}: ${subject}`
}

/** A reply, reply-all or forward of `original`, from the mailbox `me`. */
export function draftFrom(original: MailMessage, mode: 'reply' | 'replyAll' | 'forward', me: string): ComposeDraft {
  const mine = me.toLowerCase()
  if (mode === 'forward') {
    const header = [
      '---------- Forwarded message ---------',
      `From: ${original.from}`,
      `Date: ${original.date}`,
      `Subject: ${original.subject}`,
      `To: ${original.to}`,
      ...(original.cc ? [`Cc: ${original.cc}`] : []),
    ].join('\n')
    return {
      title: 'Forward',
      to: '',
      cc: '',
      bcc: '',
      subject: prefixed(original.subject, 'Fwd'),
      body: `\n\n${header}\n\n${original.text}`,
      note: original.attachments.length ? 'The original attachments are not forwarded.' : undefined,
    }
  }

  const sender = addressesIn(original.from)[0] ?? ''
  // Replying to something this mailbox sent goes back to its recipients.
  const to = sender === mine ? addressesIn(original.to) : [sender]
  const cc = mode === 'replyAll' ? unique([...addressesIn(original.to), ...addressesIn(original.cc)], mine) : []
  const quoted = original.text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  return {
    title: mode === 'reply' ? 'Reply' : 'Reply all',
    to: unique(to, mine).join(', '),
    cc: cc.filter((address) => !to.includes(address)).join(', '),
    bcc: '',
    subject: prefixed(original.subject, 'Re'),
    body: `\n\nOn ${original.date}, ${original.from} wrote:\n${quoted}`,
    inReplyTo: original.rfcMessageId ?? undefined,
    references: original.rfcMessageId
      ? `${original.references ? `${original.references} ` : ''}${original.rfcMessageId}`
      : (original.references ?? undefined),
  }
}

/** Time today, a short date this year, the year otherwise. */
function when(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

/** The display name from `Name <email>`, or the address. */
function senderName(from: string): string {
  const name = from.replace(/<[^>]*>/, '').replace(/"/g, '').trim()
  return name || from
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * The HTML body as an isolated document. The iframe that shows it is sandboxed
 * without scripts or same-origin, so a mail cannot run code or read the admin's
 * session; `<base target>` sends every link to a new window.
 */
function mailDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:12px;font:13px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;color:#1d1512;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`
}

function organizeSummary(result: OrganizeResult): string {
  const filed = Object.entries(result.filed).filter(([, count]) => count > 0)
  const total = filed.reduce((sum, [, count]) => sum + count, 0)
  const parts = [
    `Scanned ${result.scanned}`,
    `filed ${total}${filed.length ? ` (${filed.map(([name, count]) => `${name} ${count}`).join(', ')})` : ''}`,
    `${result.keptInInbox} kept in Inbox`,
    `${result.leftForTriage} left for triage`,
    `${result.unmatched} unmatched`,
  ]
  const errors = result.errors.length ? ` · ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}` : ''
  return `${parts.join(' · ')}${errors}`
}

export function MailView({ onOpenPath }: { onOpenPath: (path: string) => void }) {
  const [mailbox, setMailbox] = useState('')
  const [labels, setLabels] = useState<MailLabel[]>([])
  const [setup, setSetup] = useState<'loading' | 'ready' | 'disconnected' | 'error'>('loading')
  const [setupError, setSetupError] = useState('')
  const [label, setLabel] = useState('INBOX')
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [cursor, setCursor] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState('')
  const [banner, setBanner] = useState<{ text: string; bad?: boolean } | null>(null)
  // Inline, not window.prompt: the macOS window draws no JavaScript dialogs.
  const [folderName, setFolderName] = useState<string | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [compose, setCompose] = useState<ComposeDraft | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const listTicket = useRef(0)
  const threadTicket = useRef(0)

  const loadLabels = useCallback(async () => {
    try {
      const data = await api<{ mailbox: string; labels: MailLabel[] }>('/api/admin/mailbox')
      setMailbox(data.mailbox)
      setLabels(data.labels)
      setSetup('ready')
    } catch (failure) {
      if (failure instanceof MailError && failure.status === 404 && /no gmail mailbox/i.test(failure.message)) {
        setSetup('disconnected')
      } else {
        setSetup('error')
        setSetupError(message(failure))
      }
    }
  }, [])

  const loadThreads = useCallback(
    async (pageToken?: string) => {
      const ticket = ++listTicket.current
      setListLoading(true)
      setListError('')
      const params = new URLSearchParams()
      // A search looks through all mail, the way Gmail's search box does.
      if (activeSearch) params.set('q', activeSearch)
      else params.set('label', label)
      if (pageToken) params.set('pageToken', pageToken)
      try {
        const data = await api<{ threads: ThreadSummary[]; nextPageToken: string | null }>(
          `/api/admin/mailbox/threads?${params}`,
        )
        if (ticket !== listTicket.current) return
        setThreads((previous) => (pageToken ? [...previous, ...data.threads] : data.threads))
        setNextPageToken(data.nextPageToken)
        if (!pageToken) setCursor(0)
      } catch (failure) {
        if (ticket === listTicket.current) setListError(message(failure))
      } finally {
        if (ticket === listTicket.current) setListLoading(false)
      }
    },
    [label, activeSearch],
  )

  useEffect(() => {
    void loadLabels()
  }, [loadLabels])

  useEffect(() => {
    if (setup === 'ready') void loadThreads()
  }, [setup, loadThreads])

  const refresh = useCallback(() => {
    void loadLabels()
    void loadThreads()
  }, [loadLabels, loadThreads])

  const patchThread = useCallback((id: string, patch: Partial<ThreadSummary>) => {
    setThreads((previous) => previous.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }, [])

  const openThread = useCallback(
    async (summary: ThreadSummary) => {
      const ticket = ++threadTicket.current
      setOpenId(summary.id)
      setThread(null)
      setThreadError('')
      setThreadLoading(true)
      try {
        const data = await api<ThreadDetail>(`/api/admin/mailbox/threads/${encodeURIComponent(summary.id)}`)
        if (ticket !== threadTicket.current) return
        setThread(data)
        if (summary.unread) {
          patchThread(summary.id, { unread: false })
          void api(`/api/admin/mailbox/threads/${encodeURIComponent(summary.id)}`, { action: 'read' })
            .then(() => loadLabels())
            .catch(() => patchThread(summary.id, { unread: true }))
        }
      } catch (failure) {
        if (ticket === threadTicket.current) setThreadError(message(failure))
      } finally {
        if (ticket === threadTicket.current) setThreadLoading(false)
      }
    },
    [patchThread, loadLabels],
  )

  const closeThread = useCallback(() => {
    threadTicket.current++
    setOpenId(null)
    setThread(null)
    setThreadError('')
  }, [])

  /** The conversation an action applies to: the one open, else the one under the cursor. */
  const target = useMemo(
    () => threads.find((entry) => entry.id === openId) ?? threads[cursor] ?? null,
    [threads, openId, cursor],
  )

  /** Drop a conversation from the list after it left this folder, and move on to the next. */
  const removeFromList = useCallback(
    (id: string) => {
      setThreads((previous) => previous.filter((entry) => entry.id !== id))
      setCursor((index) => Math.max(0, Math.min(index, threads.length - 2)))
      if (openId === id) closeThread()
    },
    [threads.length, openId, closeThread],
  )

  const act = useCallback(
    async (action: ThreadAction, summary: ThreadSummary | null = target) => {
      if (!summary) return
      try {
        await api(`/api/admin/mailbox/threads/${encodeURIComponent(summary.id)}`, { action })
        if (action === 'read' || action === 'unread') patchThread(summary.id, { unread: action === 'unread' })
        else if (action === 'star' || action === 'unstar') patchThread(summary.id, { starred: action === 'star' })
        const leaves =
          action === 'trash' ||
          action === 'spam' ||
          (action === 'archive' && label === 'INBOX' && !activeSearch) ||
          (action === 'untrash' && label === 'TRASH') ||
          (action === 'notspam' && label === 'SPAM') ||
          (action === 'unstar' && label === 'STARRED' && !activeSearch)
        if (leaves) removeFromList(summary.id)
        if (action === 'unread' && openId === summary.id) closeThread()
        void loadLabels()
      } catch (failure) {
        setBanner({ text: message(failure), bad: true })
      }
    },
    [target, patchThread, label, activeSearch, removeFromList, openId, closeThread, loadLabels],
  )

  const relabel = useCallback(
    async (add: string[], remove: string[], leaves: boolean) => {
      const summary = target
      if (!summary) return
      try {
        await api(`/api/admin/mailbox/threads/${encodeURIComponent(summary.id)}`, { action: 'label', add, remove })
        if (leaves) removeFromList(summary.id)
        else patchThread(summary.id, { labelIds: [...summary.labelIds.filter((id) => !remove.includes(id)), ...add] })
        void loadLabels()
      } catch (failure) {
        setBanner({ text: message(failure), bad: true })
      }
    },
    [target, removeFromList, patchThread, loadLabels],
  )

  const moveTo = useCallback(
    (folder: string) => {
      const current = labels.find((entry) => entry.id === label)
      const remove = activeSearch ? [] : label === 'INBOX' ? ['INBOX'] : current?.type === 'user' ? [label] : []
      void relabel([folder], remove, remove.length > 0)
    },
    [labels, label, activeSearch, relabel],
  )

  const organize = useCallback(async () => {
    setOrganizing(true)
    setBanner(null)
    try {
      const result = await api<OrganizeResult>('/api/admin/mailbox/organize', {})
      setBanner({ text: organizeSummary(result), bad: result.errors.length > 0 })
      refresh()
    } catch (failure) {
      setBanner({ text: message(failure), bad: true })
    } finally {
      setOrganizing(false)
    }
  }, [refresh])

  const newFolder = useCallback(async (raw: string) => {
    const name = raw.trim()
    setFolderName(null)
    if (!name) return
    try {
      await api<MailLabel>('/api/admin/mailbox', { name })
      setBanner({ text: `Created “${name}”` })
      void loadLabels()
    } catch (failure) {
      setBanner({ text: message(failure), bad: true })
    }
  }, [loadLabels])

  const lastMessage = thread?.messages[thread.messages.length - 1] ?? null
  const respond = useCallback(
    (mode: 'reply' | 'replyAll' | 'forward', original: MailMessage | null = lastMessage) => {
      if (!original || !thread) return
      const draft = draftFrom(original, mode, mailbox)
      setCompose(mode === 'forward' ? draft : { ...draft, threadId: thread.id })
    },
    [lastMessage, thread, mailbox],
  )

  const blank = useCallback(
    () => setCompose({ title: 'New message', to: '', cc: '', bcc: '', subject: '', body: '' }),
    [],
  )

  // ------------------------------------------------------------ keyboard

  const onKey = useRef<(event: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    onKey.current = (event) => {
      if (compose || event.metaKey || event.ctrlKey || event.altKey) return
      const element = event.target as HTMLElement | null
      const tag = element?.tagName?.toLowerCase() ?? ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || element?.isContentEditable) return
      // ⏎ on a focused button presses it rather than opening a conversation.
      if (event.key === 'Enter' && element?.closest('button, a')) return

      const step = (delta: number) => {
        const next = Math.max(0, Math.min(cursor + delta, threads.length - 1))
        setCursor(next)
        if (openId && threads[next]) void openThread(threads[next])
      }
      const bindings: Record<string, () => void> = {
        j: () => step(1),
        ArrowDown: () => step(1),
        k: () => step(-1),
        ArrowUp: () => step(-1),
        Enter: () => threads[cursor] && void openThread(threads[cursor]),
        o: () => threads[cursor] && void openThread(threads[cursor]),
        u: closeThread,
        Escape: closeThread,
        e: () => void act('archive'),
        '#': () => void act('trash'),
        '!': () => void act('spam'),
        s: () => target && void act(target.starred ? 'unstar' : 'star'),
        I: () => void act('read'),
        U: () => void act('unread'),
        r: () => respond('reply'),
        a: () => respond('replyAll'),
        f: () => respond('forward'),
        c: blank,
        '/': () => searchRef.current?.focus(),
      }
      const run = bindings[event.key]
      if (!run) return
      event.preventDefault()
      run()
    }
  })
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey.current(event)
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [])

  useEffect(() => {
    document.querySelector('.jmsd-mail-row[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  // -------------------------------------------------------------- render

  if (setup === 'loading') return <div className="jmsd-empty">Opening the mailbox…</div>
  if (setup === 'disconnected') {
    return (
      <div className="jmsd-empty">
        <div style={{ marginBottom: 12 }}>No Gmail mailbox is connected yet.</div>
        <button type="button" className="jmsd-action jmsd-action--primary" style={{ margin: '0 auto' }} onClick={() => onOpenPath('/admin/inbox/settings')}>
          Connect a mailbox
        </button>
      </div>
    )
  }
  if (setup === 'error') return <div className="jmsd-empty jmsd-tone-bad">{setupError}</div>

  const system = Object.keys(SYSTEM_LABELS)
    .map((id) => labels.find((entry) => entry.id === id))
    .filter((entry): entry is MailLabel => Boolean(entry))
  const user = labels.filter((entry) => entry.type === 'user')
  const folders = ORGANIZER_FOLDERS.map((name) => user.find((entry) => entry.name === name)).filter(
    (entry): entry is MailLabel => Boolean(entry),
  )
  const others = user.filter((entry) => !ORGANIZER_FOLDERS.includes(entry.name))
  const nameOf = (entry: MailLabel) => SYSTEM_LABELS[entry.id] ?? entry.name
  const currentName = activeSearch
    ? `Search: ${activeSearch}`
    : nameOf(labels.find((entry) => entry.id === label) ?? { id: label, name: label, type: 'system', unread: 0, total: 0, color: null })

  const folderButton = (entry: MailLabel) => (
    <button
      key={entry.id}
      type="button"
      className="jmsd-mail-folder"
      aria-current={!activeSearch && entry.id === label}
      onClick={() => {
        setLabel(entry.id)
        setActiveSearch('')
        setSearch('')
        closeThread()
      }}
    >
      {entry.type === 'user' ? (
        <span className="jmsd-mail-swatch" style={{ background: entry.color ?? 'var(--faint)' }} />
      ) : null}
      <span className="jmsd-mail-folder-name">{nameOf(entry)}</span>
      {entry.unread > 0 ? <span className="jmsd-mail-count">{entry.unread}</span> : null}
    </button>
  )

  return (
    <div className="jmsd-mail">
      <aside className="jmsd-mail-folders" aria-label="Folders">
        <button type="button" className="jmsd-action jmsd-action--primary jmsd-mail-compose" onClick={blank}>
          <Icon name="i-pencil" size={13} />
          <span>Compose</span>
          <span className="jmsd-key">C</span>
        </button>
        <div className="jmsd-mail-address jmsd-mono" title={mailbox}>
          {mailbox}
        </div>
        {system.map(folderButton)}
        <div className="jmsd-nav-group-label jmsd-mail-group">FOLDERS</div>
        {folders.map(folderButton)}
        {others.length ? <div className="jmsd-nav-group-label jmsd-mail-group">LABELS</div> : null}
        {others.map(folderButton)}
        <div className="jmsd-mail-folder-tools">
          {folderName === null ? (
            <button type="button" className="jmsd-chip" onClick={() => setFolderName('')}>
              <Icon name="i-plus" size={11} />
              <span style={{ marginLeft: 5 }}>New folder</span>
            </button>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void newFolder(folderName)
              }}
            >
              <input
                autoFocus
                className="jmsd-input"
                aria-label="New folder name"
                placeholder="Folder name, Enter to create"
                value={folderName}
                maxLength={225}
                onChange={(event) => setFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setFolderName(null)
                }}
              />
            </form>
          )}
          <button type="button" className="jmsd-chip" onClick={() => void organize()} disabled={organizing}>
            <Icon name="i-rotate" size={11} />
            <span style={{ marginLeft: 5 }}>{organizing ? 'Organizing…' : 'Organize now'}</span>
          </button>
        </div>
      </aside>

      <section className="jmsd-mail-list" aria-label="Conversations">
        <form
          className="jmsd-filter-input jmsd-mail-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            closeThread()
            setActiveSearch(search.trim())
          }}
        >
          <Icon name="i-search" size={12} className="jmsd-tone-muted" />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search all mail  /"
            aria-label="Search mail"
          />
        </form>
        <div className="jmsd-mail-listhead">
          <span>{currentName}</span>
          <button type="button" className="jmsd-icon-button" title="Refresh" onClick={refresh}>
            <Icon name="i-rotate" size={12} />
          </button>
        </div>
        {banner ? (
          <div className={`jmsd-mail-banner ${banner.bad ? 'jmsd-tone-bad' : ''}`} role="status">
            <span>{banner.text}</span>
            <button type="button" className="jmsd-icon-button" aria-label="Dismiss" onClick={() => setBanner(null)}>
              <Icon name="i-close" size={11} />
            </button>
          </div>
        ) : null}
        <div className="jmsd-mail-rows" role="listbox" aria-label="Conversation list">
          {listError ? <div className="jmsd-empty jmsd-tone-bad">{listError}</div> : null}
          {!listError && !listLoading && threads.length === 0 ? (
            <div className="jmsd-empty">{activeSearch ? 'No mail matches that search.' : 'Nothing in this folder.'}</div>
          ) : null}
          {threads.map((entry, index) => (
            <div
              key={entry.id}
              role="option"
              tabIndex={-1}
              className={`jmsd-mail-row ${entry.unread ? 'jmsd-mail-row--unread' : ''}`}
              aria-selected={index === cursor}
              data-open={entry.id === openId || undefined}
              onClick={() => {
                setCursor(index)
                void openThread(entry)
              }}
            >
              <div className="jmsd-mail-row-top">
                <button
                  type="button"
                  className={`jmsd-mail-star ${entry.starred ? 'jmsd-tone-warn' : 'jmsd-tone-muted'}`}
                  aria-label={entry.starred ? 'Unstar' : 'Star'}
                  aria-pressed={entry.starred}
                  onClick={(event) => {
                    event.stopPropagation()
                    void act(entry.starred ? 'unstar' : 'star', entry)
                  }}
                >
                  <Icon name="i-star" size={12} />
                </button>
                <span className="jmsd-mail-from">{senderName(entry.from)}</span>
                {entry.messageCount > 1 ? <span className="jmsd-mail-n">{entry.messageCount}</span> : null}
                <span className="jmsd-mail-date jmsd-mono">{when(entry.date)}</span>
              </div>
              <div className="jmsd-mail-subject">{entry.subject || '(no subject)'}</div>
              <div className="jmsd-mail-snippet">{entry.snippet}</div>
            </div>
          ))}
          {listLoading ? <div className="jmsd-empty">Loading…</div> : null}
          {nextPageToken && !listLoading ? (
            <button type="button" className="jmsd-chip jmsd-mail-more" onClick={() => void loadThreads(nextPageToken)}>
              Load more
            </button>
          ) : null}
        </div>
      </section>

      <section className="jmsd-mail-reader" aria-label="Reader">
        {target ? (
          <div className="jmsd-mail-toolbar" role="toolbar" aria-label="Conversation actions">
            {openId ? (
              <button type="button" className="jmsd-icon-button" title="Back to list (U)" onClick={closeThread}>
                <Icon name="i-close" size={13} />
              </button>
            ) : null}
            <button type="button" className="jmsd-action" onClick={() => void act('archive')} title="E">
              Archive
            </button>
            <button type="button" className="jmsd-action jmsd-action--danger" onClick={() => void act('trash')} title="#">
              Trash
            </button>
            <button type="button" className="jmsd-action" onClick={() => void act('spam')} title="!">
              Spam
            </button>
            <button
              type="button"
              className="jmsd-action"
              onClick={() => void act(target.unread ? 'read' : 'unread')}
              title="Shift+I / Shift+U"
            >
              {target.unread ? 'Mark read' : 'Mark unread'}
            </button>
            {label === 'TRASH' ? (
              <button type="button" className="jmsd-action" onClick={() => void act('untrash')}>
                Restore
              </button>
            ) : null}
            {label === 'SPAM' ? (
              <button type="button" className="jmsd-action" onClick={() => void act('notspam')}>
                Not spam
              </button>
            ) : null}
            <select
              className="jmsd-input jmsd-mail-select"
              aria-label="Move to folder"
              value=""
              onChange={(event) => event.target.value && moveTo(event.target.value)}
            >
              <option value="">Move to…</option>
              {user
                .filter((entry) => entry.id !== label)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
            <select
              className="jmsd-input jmsd-mail-select"
              aria-label="Label"
              value=""
              onChange={(event) => event.target.value && void relabel([event.target.value], [], false)}
            >
              <option value="">Label…</option>
              {user
                .filter((entry) => !target.labelIds.includes(entry.id))
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        {!openId ? (
          <div className="jmsd-empty">Select a conversation · J/K to move, ↵ to open</div>
        ) : threadLoading ? (
          <div className="jmsd-empty">Loading conversation…</div>
        ) : threadError ? (
          <div className="jmsd-empty jmsd-tone-bad">{threadError}</div>
        ) : thread ? (
          <div className="jmsd-mail-thread">
            <h2 className="jmsd-mail-thread-subject">{thread.subject || '(no subject)'}</h2>
            {thread.messages.map((entry) => (
              <article key={entry.id} className="jmsd-mail-msg">
                <header className="jmsd-mail-msg-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="jmsd-mail-msg-from">{entry.from}</div>
                    <div className="jmsd-mail-msg-meta">
                      to {entry.to}
                      {entry.cc ? ` · cc ${entry.cc}` : ''}
                    </div>
                  </div>
                  <span className="jmsd-mail-date jmsd-mono" title={entry.date}>
                    {when(entry.date) || entry.date}
                  </span>
                </header>
                {entry.html ? (
                  <iframe
                    className="jmsd-mail-frame"
                    title={`Message from ${senderName(entry.from)}`}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={mailDocument(entry.html)}
                  />
                ) : (
                  <div className="jmsd-mail-text">{entry.text}</div>
                )}
                {entry.attachments.length ? (
                  <div className="jmsd-mail-attachments">
                    {entry.attachments.map((file) => (
                      <a
                        key={file.attachmentId}
                        className="jmsd-chip"
                        download={file.filename}
                        href={`/api/admin/mailbox/attachment?${new URLSearchParams({
                          messageId: entry.id,
                          attachmentId: file.attachmentId,
                          filename: file.filename,
                        })}`}
                      >
                        <Icon name="i-file" size={11} />
                        <span style={{ marginLeft: 5 }}>
                          {file.filename} · {size(file.size)}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="jmsd-mail-msg-actions">
                  <button type="button" className="jmsd-chip" onClick={() => respond('reply', entry)}>
                    Reply
                  </button>
                  <button type="button" className="jmsd-chip" onClick={() => respond('replyAll', entry)}>
                    Reply all
                  </button>
                  <button type="button" className="jmsd-chip" onClick={() => respond('forward', entry)}>
                    Forward
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {compose ? (
        <ComposeSheet
          draft={compose}
          onClose={() => setCompose(null)}
          onDone={(text) => {
            setCompose(null)
            setBanner({ text })
            void loadLabels()
          }}
        />
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ compose

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

function parseList(value: string): { list: string[]; bad: string[] } {
  const parts = value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.match(/<([^>]+)>/)?.[1]?.trim() ?? part)
  return { list: parts, bad: parts.filter((part) => !EMAIL.test(part)) }
}

function ComposeSheet({
  draft,
  onClose,
  onDone,
}: {
  draft: ComposeDraft
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [values, setValues] = useState(draft)
  const [files, setFiles] = useState<(OutgoingAttachment & { size: number })[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState<'send' | 'draft' | null>(null)
  const set = (name: 'to' | 'cc' | 'bcc' | 'subject' | 'body') => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setValues((previous) => ({ ...previous, [name]: event.target.value }))

  const addFiles = async (picked: FileList | null) => {
    if (!picked?.length) return
    try {
      const read = await Promise.all(
        [...picked].map(async (file) => ({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: await readBase64(file),
          size: file.size,
        })),
      )
      const next = [...files, ...read]
      if (next.reduce((sum, file) => sum + file.data.length, 0) > MAX_ATTACHMENT_BASE64) {
        setError('Attachments are limited to about 3 MB in total. Remove one or send a link instead.')
        return
      }
      setError('')
      setFiles(next)
    } catch {
      setError('Could not read that file.')
    }
  }

  const submit = async (mode: 'send' | 'draft') => {
    const to = parseList(values.to)
    const cc = parseList(values.cc)
    const bcc = parseList(values.bcc)
    const bad = [...to.bad, ...cc.bad, ...bcc.bad]
    if (bad.length) return setError(`Not an email address: ${bad.join(', ')}`)
    if (mode === 'send' && to.list.length + cc.list.length + bcc.list.length === 0) {
      return setError('Add at least one recipient.')
    }
    setSending(mode)
    setError('')
    try {
      await api('/api/admin/mailbox/send', {
        mode,
        to: to.list,
        cc: cc.list,
        bcc: bcc.list,
        subject: values.subject,
        body: values.body,
        threadId: values.threadId,
        inReplyTo: values.inReplyTo,
        references: values.references,
        attachments: files.map(({ filename, mimeType, data }) => ({ filename, mimeType, data })),
      })
      onDone(mode === 'send' ? 'Message sent' : 'Draft saved')
    } catch (failure) {
      setError(message(failure))
      setSending(null)
    }
  }

  return (
    <div className="jmsd-scrim" role="presentation" onMouseDown={onClose}>
      <form
        className="jmsd-sheet jmsd-sheet--wide"
        role="dialog"
        aria-modal="true"
        aria-label={values.title}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          void submit('send')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            void submit('send')
          }
        }}
      >
        <header className="jmsd-sheet-head">
          <div className="jmsd-sheet-heading">
            <div className="jmsd-sheet-title">{values.title}</div>
            {values.note ? <div className="jmsd-sheet-subtitle">{values.note}</div> : null}
          </div>
          <button type="button" className="jmsd-icon-button" onClick={onClose} aria-label="Close">
            <Icon name="i-close" size={14} />
          </button>
        </header>
        <div className="jmsd-sheet-body jmsd-mail-compose-body">
          {(['to', 'cc', 'bcc', 'subject'] as const).map((name) => (
            <label key={name} className="jmsd-field-block">
              <span className="jmsd-field-label">{name === 'subject' ? 'Subject' : name.charAt(0).toUpperCase() + name.slice(1)}</span>
              <input
                className="jmsd-input"
                value={values[name]}
                onChange={set(name)}
                autoFocus={name === 'to' && !values.to}
                placeholder={name === 'subject' ? '' : 'name@example.com, …'}
              />
            </label>
          ))}
          <label className="jmsd-field-block">
            <span className="jmsd-field-label">Message</span>
            <textarea
              className="jmsd-input jmsd-input--area"
              rows={14}
              value={values.body}
              onChange={set('body')}
              autoFocus={Boolean(values.to)}
            />
          </label>
          <div className="jmsd-mail-attachments">
            {files.map((file, index) => (
              <span key={`${file.filename}-${index}`} className="jmsd-chip">
                {file.filename} · {size(file.size)}
                <button
                  type="button"
                  className="jmsd-mail-unattach"
                  aria-label={`Remove ${file.filename}`}
                  onClick={() => setFiles((previous) => previous.filter((_, at) => at !== index))}
                >
                  <Icon name="i-close" size={10} />
                </button>
              </span>
            ))}
            <label className="jmsd-chip" style={{ cursor: 'pointer' }}>
              <Icon name="i-plus" size={11} />
              <span style={{ marginLeft: 5 }}>Attach files</span>
              <input
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  void addFiles(event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
        <footer className="jmsd-sheet-foot">
          {error ? <div className="jmsd-sheet-error" role="alert">{error}</div> : <span />}
          <div className="jmsd-sheet-buttons">
            <button type="button" className="jmsd-action" onClick={() => void submit('draft')} disabled={sending !== null}>
              {sending === 'draft' ? 'Saving…' : 'Save draft'}
            </button>
            <button type="submit" className="jmsd-action jmsd-action--primary" disabled={sending !== null}>
              {sending === 'send' ? 'Sending…' : 'Send'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
