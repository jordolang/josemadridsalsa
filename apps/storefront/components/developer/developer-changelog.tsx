'use client'

import { useId, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown, { type Components } from 'react-markdown'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  Bug,
  Minus,
  Shield,
  Tag,
  Sparkles,
} from 'lucide-react'
import { DeveloperScrollSection } from './developer-scroll-section'
import type {
  ChangelogItem,
  ChangelogVersion,
  ChangelogSection,
} from '@/lib/developer/parse-changelog'

interface DeveloperChangelogProps {
  versions: readonly ChangelogVersion[]
}

const sectionConfig: Record<
  ChangelogSection['type'],
  {
    icon: typeof Plus
    label: string
    color: string
    badgeColor: string
    dotColor: string
  }
> = {
  Added: {
    icon: Plus,
    label: 'Added',
    color: 'text-verde-600 dark:text-verde-400',
    badgeColor:
      'bg-verde-100 text-verde-700 dark:bg-verde-950/50 dark:text-verde-300',
    dotColor: 'bg-verde-500',
  },
  Changed: {
    icon: RefreshCw,
    label: 'Changed',
    color: 'text-chile-600 dark:text-chile-400',
    badgeColor:
      'bg-chile-100 text-chile-700 dark:bg-chile-950/50 dark:text-chile-300',
    dotColor: 'bg-chile-500',
  },
  Fixed: {
    icon: Bug,
    label: 'Fixed',
    color: 'text-salsa-600 dark:text-salsa-400',
    badgeColor:
      'bg-salsa-100 text-salsa-700 dark:bg-salsa-950/50 dark:text-salsa-300',
    dotColor: 'bg-salsa-500',
  },
  Security: {
    icon: Shield,
    label: 'Security',
    color: 'text-amber-600 dark:text-amber-400',
    badgeColor:
      'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    dotColor: 'bg-amber-500',
  },
  Removed: {
    icon: Minus,
    label: 'Removed',
    color: 'text-muted-foreground',
    badgeColor: 'bg-muted text-muted-foreground',
    dotColor: 'bg-muted-foreground/60',
  },
}

// Changelog entries are inline markdown (bold, `code`, links). Render them
// without block wrappers so they sit inside list rows and buttons.
const inlineMarkdownComponents: Components = {
  p: ({ children }) => <>{children}</>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground/90 break-words">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-chile-600 underline underline-offset-2 hover:text-chile-700 dark:text-chile-400"
    >
      {children}
    </a>
  ),
}

function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={inlineMarkdownComponents}
      allowedElements={['p', 'strong', 'em', 'code', 'a', 'del']}
      unwrapDisallowed
    >
      {children}
    </ReactMarkdown>
  )
}

/**
 * Split an entry like "**Headline.** Details..." into its bold headline and
 * the rest, so the headline can be shown on its own with the details folded.
 */
function splitHeadline(text: string): { headline: string | null; body: string } {
  const match = text.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/)
  if (!match) return { headline: null, body: text }
  return { headline: match[1].trim(), body: match[2].trim() }
}

function Collapse({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ChangelogItemRow({ item, dotColor }: { item: ChangelogItem; dotColor: string }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const { headline, body } = splitHeadline(item.text)
  const hasDetails = headline !== null && (body !== '' || item.children.length > 0)

  const children = item.children.length > 0 && (
    <ul className="mt-2 space-y-1.5 border-l border-border/60 pl-4">
      {item.children.map((child, childIndex) => (
        <li key={childIndex} className="text-sm leading-relaxed text-muted-foreground">
          <InlineMarkdown>{child}</InlineMarkdown>
        </li>
      ))}
    </ul>
  )

  if (!hasDetails) {
    // No headline to fold under: show the whole entry.
    return (
      <li className="flex items-start gap-3 rounded-lg px-2 py-2">
        <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
          <InlineMarkdown>{headline ? `**${headline}** ${body}` : body}</InlineMarkdown>
          {children}
        </div>
      </li>
    )
  }

  return (
    <li className="rounded-lg transition-colors hover:bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={detailsId}
        className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chile-400"
      >
        <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <span className="min-w-0 flex-1 font-medium text-foreground">
          <InlineMarkdown>{headline}</InlineMarkdown>
        </span>
        <ChevronRight
          className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      <Collapse open={open} id={detailsId}>
        <div className="pb-3 pl-[1.625rem] pr-8 text-sm leading-relaxed text-muted-foreground">
          {body && <InlineMarkdown>{body}</InlineMarkdown>}
          {children}
        </div>
      </Collapse>
    </li>
  )
}

function ChangelogSectionBlock({ section }: { section: ChangelogSection }) {
  const [open, setOpen] = useState(true)
  const listId = useId()
  const config = sectionConfig[section.type]
  const SectionIcon = config.icon

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={listId}
        className="mb-1 flex items-center gap-2 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chile-400"
      >
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${config.badgeColor}`}
        >
          <SectionIcon className="w-3 h-3" />
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground/60">({section.items.length})</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${
            open ? '' : '-rotate-90'
          }`}
        />
      </button>
      <Collapse open={open} id={listId}>
        <ul className="space-y-0.5">
          {section.items.map((item, itemIndex) => (
            <ChangelogItemRow key={itemIndex} item={item} dotColor={config.dotColor} />
          ))}
        </ul>
      </Collapse>
    </div>
  )
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`
}

export function DeveloperChangelog({ versions }: DeveloperChangelogProps) {
  // Only the latest release starts open; Unreleased (often very long) starts
  // folded so the page opens on a short list of version cards.
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(() => {
    const latest = versions.find((v) => v.version !== 'Unreleased')
    return new Set(latest ? [latest.version] : [])
  })
  const allExpanded = versions.length > 0 && expandedVersions.size === versions.length

  function toggleVersion(version: string) {
    setExpandedVersions((prev) => {
      const next = new Set(prev)
      if (next.has(version)) {
        next.delete(version)
      } else {
        next.add(version)
      }
      return next
    })
  }

  function toggleAll() {
    setExpandedVersions(allExpanded ? new Set() : new Set(versions.map((v) => v.version)))
  }

  return (
    <div className="space-y-4">
      {versions.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}
      {versions.map((version, index) => {
        const isExpanded = expandedVersions.has(version.version)
        const isUnreleased = version.version === 'Unreleased'
        const panelId = `changelog-${version.version.replace(/[^a-zA-Z0-9]+/g, '-')}`
        const totalItems = version.sections.reduce(
          (sum, s) => sum + s.items.length,
          0
        )

        return (
          <DeveloperScrollSection key={version.version} delay={index * 0.05}>
            <div
              className={`rounded-xl border overflow-hidden transition-colors ${
                isUnreleased
                  ? 'border-chile-400/40 bg-chile-50/50 dark:bg-chile-950/20'
                  : 'border-border bg-card'
              }`}
            >
              {/* Version header — clickable to toggle */}
              <button
                type="button"
                onClick={() => toggleVersion(version.version)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
              >
                {/* Version badge */}
                <div
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                    isUnreleased
                      ? 'bg-gradient-to-r from-chile-500 to-salsa-500 text-white'
                      : 'bg-foreground/5 text-foreground'
                  }`}
                >
                  {isUnreleased ? (
                    <Sparkles className="w-3.5 h-3.5" />
                  ) : (
                    <Tag className="w-3.5 h-3.5" />
                  )}
                  {isUnreleased ? 'Unreleased' : `v${version.version}`}
                </div>

                {/* Subtitle */}
                {version.subtitle && (
                  <span className="text-sm font-medium text-muted-foreground truncate">
                    {version.subtitle}
                  </span>
                )}

                <div className="flex-1" />

                {/* Date */}
                {version.date && (
                  <span className="text-xs text-muted-foreground/70 hidden sm:block">
                    {formatDate(version.date)}
                  </span>
                )}

                {/* Item count */}
                <span className="text-xs text-muted-foreground/50 tabular-nums">
                  {totalItems} {totalItems === 1 ? 'change' : 'changes'}
                </span>

                {/* Chevron */}
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
                </motion.div>
              </button>

              {/* Expandable content */}
              <Collapse open={isExpanded} id={panelId}>
                <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
                  {version.sections.map((section) => (
                    <ChangelogSectionBlock key={section.type} section={section} />
                  ))}
                </div>
              </Collapse>
            </div>
          </DeveloperScrollSection>
        )
      })}
    </div>
  )
}
