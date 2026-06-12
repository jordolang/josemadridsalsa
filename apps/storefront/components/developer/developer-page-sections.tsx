'use client'

import dynamic from 'next/dynamic'
import { Clock, BookOpen, Wrench, FileText, BarChart3 } from 'lucide-react'
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

const DeveloperBlogPreview = dynamic(
  () => import('./developer-blog-preview').then((mod) => ({ default: mod.DeveloperBlogPreview })),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" /> }
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
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">1,500+ Hours</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Across 200 days and 14 versioned releases — design, development, testing,
                    and deployment of a production e-commerce, fundraising, and mobile platform.
                  </p>
                </div>
              </DeveloperScrollSection>

              <DeveloperScrollSection delay={0.3}>
                <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 bg-gradient-to-br from-verde-500 to-verde-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-verde-500/20">
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">100% Free</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Real fair-market value: $250K–$750K+ if commissioned from a US firm.
                    Delivered at no cost — as originally promised.
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
                  The Real Scope of This Project
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Hard numbers from the codebase — what was built, how long it took, and what
                  it would have cost if commissioned from a professional firm.
                </p>
              </div>
            </DeveloperScrollSection>

            <DeveloperStats />
          </div>
        </div>
      </section>
      )}

      {/* Blog preview section */}
      {content.sections.blog && (
      <section className="py-16 lg:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <DeveloperScrollSection>
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                  Developer Blog
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Behind-the-scenes stories, technical deep-dives, and lessons learned while building this platform.
                </p>
              </div>
            </DeveloperScrollSection>

            <DeveloperScrollSection delay={0.2}>
              <DeveloperBlogPreview />
            </DeveloperScrollSection>
          </div>
        </div>
      </section>
      )}

      {/* Feature Timeline placeholder section — populated by separate task */}
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

      {/* Contact form placeholder section — populated by separate task */}
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

      {/* Closing faith statement */}
      {content.sections.closing && (
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <DeveloperScrollSection>
            <div className="max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-chile-400 to-salsa-500 rounded-full mb-6 shadow-lg shadow-salsa-500/20">
                <span className="text-white text-2xl font-serif font-bold">+</span>
              </div>
              <blockquote className="text-xl lg:text-2xl font-serif text-foreground leading-relaxed mb-4">
                &ldquo;{content.closing.quote}&rdquo;
              </blockquote>
              <cite className="text-muted-foreground text-sm">
                {content.closing.cite}
              </cite>
            </div>
          </DeveloperScrollSection>
        </div>
      </section>
      )}
    </>
  )
}
