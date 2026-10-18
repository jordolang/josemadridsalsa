'use client'

import dynamic from 'next/dynamic'
import { Layers, Store, Wrench, FileText, BarChart3 } from 'lucide-react'
import { DeveloperScrollSection } from './developer-scroll-section'
import type { ChangelogVersion } from '@/lib/developer/parse-changelog'
import type { DeveloperPageContentData } from '@/lib/developer/page-content'

// Code-split heavy below-the-fold components to reduce initial bundle size.
// Framer Motion (~30-40 KB gzipped) is only loaded when these sections scroll into view.
const DeveloperTimeline = dynamic(
  () => import('./developer-timeline').then((mod) => ({ default: mod.DeveloperTimeline })),
  { ssr: false, loading: () => <div className="h-[600px] animate-pulse rounded-lg bg-muted" /> }
)

const DeveloperStats = dynamic(
  () => import('./developer-stats').then((mod) => ({ default: mod.DeveloperStats })),
  { ssr: false, loading: () => <div className="h-[600px] animate-pulse rounded-lg bg-muted" /> }
)

const DeveloperSkills = dynamic(
  () => import('./developer-skills').then((mod) => ({ default: mod.DeveloperSkills })),
  { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-lg bg-muted" /> }
)

const DeveloperContactForm = dynamic(
  () => import('./developer-contact-form').then((mod) => ({ default: mod.DeveloperContactForm })),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" /> }
)

const DeveloperChangelog = dynamic(
  () => import('./developer-changelog').then((mod) => ({ default: mod.DeveloperChangelog })),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" /> }
)

interface DeveloperPageSectionsProps {
  readonly changelogVersions: readonly ChangelogVersion[]
  readonly content: DeveloperPageContentData
}

export function DeveloperPageSections({ changelogVersions, content }: DeveloperPageSectionsProps) {
  return (
    <>
      {/* About / Mission section */}
      {content.sections.about && (
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <DeveloperScrollSection>
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                  {content.about.heading}
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  {content.about.body}
                </p>
              </div>
            </DeveloperScrollSection>

            <div className="grid md:grid-cols-3 gap-8">
              <DeveloperScrollSection delay={0}>
                <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 bg-gradient-to-br from-salsa-500 to-salsa-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-salsa-500/20">
                    <Wrench className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Full-Stack</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Next.js, React, TypeScript, Prisma, Tailwind CSS, and more — the entire stack
                    designed and implemented by one developer.
                  </p>
                </div>
              </DeveloperScrollSection>

              <DeveloperScrollSection delay={0.15}>
                <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 bg-gradient-to-br from-chile-500 to-chile-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-chile-500/20">
                    <Layers className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">One Codebase</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    The storefront, fundraising site, admin console and companion apps share one
                    monorepo, one database and one release process, so a change ships everywhere
                    at once.
                  </p>
                </div>
              </DeveloperScrollSection>

              <DeveloperScrollSection delay={0.3}>
                <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 bg-gradient-to-br from-verde-500 to-verde-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-verde-500/20">
                    <Store className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Built for the Business</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Orders, fundraisers, wholesale, events, inventory and bookkeeping are handled
                    in tools designed around how Jose Madrid Salsa actually works.
                  </p>
                </div>
              </DeveloperScrollSection>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Real-numbers stats section */}
      {content.sections.stats && (
      <section id="stats" className="py-16 lg:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <DeveloperScrollSection>
              <div className="text-center mb-12">
                <div className="w-14 h-14 bg-gradient-to-br from-salsa-500 to-chile-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-salsa-500/20">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                  Project Scope
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Measured from the codebase and its release history.
                </p>
              </div>
            </DeveloperScrollSection>

            <DeveloperStats />
          </div>
        </div>
      </section>
      )}

      {/* Feature timeline */}
      {content.sections.timeline && (
      <section id="timeline" className="py-16 lg:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <DeveloperScrollSection>
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                  Project Timeline
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Every feature, every milestone — the complete story of how this platform came to life.
                </p>
              </div>
            </DeveloperScrollSection>

            <DeveloperTimeline />
          </div>
        </div>
      </section>
      )}

      {/* Tech Stack / Skills section */}
      {content.sections.skills && (
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <DeveloperScrollSection>
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                  Tech Stack
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  The technologies and tools powering every part of this platform.
                </p>
              </div>
            </DeveloperScrollSection>

            <DeveloperSkills />
          </div>
        </div>
      </section>
      )}

      {/* Changelog section */}
      {content.sections.changelog && (
      <section id="changelog" className="py-16 lg:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <DeveloperScrollSection>
              <div className="text-center mb-12">
                <div className="w-14 h-14 bg-gradient-to-br from-verde-500 to-verde-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-verde-500/20">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                  Changelog
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  A complete record of every feature, fix, and improvement shipped to this platform.
                </p>
              </div>
            </DeveloperScrollSection>

            <DeveloperScrollSection delay={0.2}>
              <DeveloperChangelog versions={changelogVersions} />
            </DeveloperScrollSection>
          </div>
        </div>
      </section>
      )}

      {/* Contact form */}
      {content.sections.contact && (
      <section className="py-16 lg:py-24 bg-gradient-to-br from-salsa-600 via-salsa-700 to-chile-700 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <DeveloperScrollSection>
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-4">
                  {content.contact.heading}
                </h2>
                <p className="text-lg text-salsa-100 max-w-xl mx-auto">
                  {content.contact.description}
                </p>
              </div>
            </DeveloperScrollSection>

            <DeveloperScrollSection delay={0.2}>
              <DeveloperContactForm />
            </DeveloperScrollSection>
          </div>
        </div>
      </section>
      )}

    </>
  )
}
