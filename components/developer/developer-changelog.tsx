'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Plus,
  RefreshCw,
  Bug,
  Shield,
  Tag,
  Sparkles,
} from 'lucide-react'
import { DeveloperScrollSection } from './developer-scroll-section'
import type {
  ChangelogVersion,
  ChangelogSection,
} from '@/lib/developer/parse-changelog'

interface DeveloperChangelogProps {
  versions: readonly ChangelogVersion[]
}

const sectionConfig: Record<
  ChangelogSection['type'],
  { icon: typeof Plus; label: string; color: string; badgeColor: string }
> = {
  Added: {
    icon: Plus,
    label: 'Added',
    color: 'text-verde-600 dark:text-verde-400',
    badgeColor:
      'bg-verde-100 text-verde-700 dark:bg-verde-950/50 dark:text-verde-300',
  },
  Changed: {
    icon: RefreshCw,
    label: 'Changed',
    color: 'text-chile-600 dark:text-chile-400',
    badgeColor:
      'bg-chile-100 text-chile-700 dark:bg-chile-950/50 dark:text-chile-300',
  },
  Fixed: {
    icon: Bug,
    label: 'Fixed',
    color: 'text-salsa-600 dark:text-salsa-400',
    badgeColor:
      'bg-salsa-100 text-salsa-700 dark:bg-salsa-950/50 dark:text-salsa-300',
  },
  Security: {
    icon: Shield,
    label: 'Security',
    color: 'text-amber-600 dark:text-amber-400',
    badgeColor:
      'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  },
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
  // First 3 versions expanded by default
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    () => new Set(versions.slice(0, 3).map((v) => v.version))
  )

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

  return (
    <div className="space-y-4">
      {versions.map((version, index) => {
        const isExpanded = expandedVersions.has(version.version)
        const isUnreleased = version.version === 'Unreleased'
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
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
                      {version.sections.map((section) => {
                        const config = sectionConfig[section.type]
                        const SectionIcon = config.icon

                        return (
                          <div key={section.type}>
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${config.badgeColor}`}
                              >
                                <SectionIcon className="w-3 h-3" />
                                {config.label}
                              </span>
                              <span className="text-xs text-muted-foreground/50">
                                ({section.items.length})
                              </span>
                            </div>
                            <ul className="space-y-1.5 ml-1">
                              {section.items.map((item, itemIndex) => (
                                <li
                                  key={itemIndex}
                                  className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed"
                                >
                                  <span
                                    className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                                      section.type === 'Added'
                                        ? 'bg-verde-500'
                                        : section.type === 'Changed'
                                          ? 'bg-chile-500'
                                          : section.type === 'Security'
                                            ? 'bg-amber-500'
                                            : 'bg-salsa-500'
                                    }`}
                                  />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </DeveloperScrollSection>
        )
      })}
    </div>
  )
}
