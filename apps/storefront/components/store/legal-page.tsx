import type { ReactNode } from 'react'

interface LegalPageProps {
  title: string
  /**
   * Admin-authored override text from Store Settings. When present it replaces the
   * static default entirely. Rendered as plain text (whitespace preserved) — never as
   * HTML — so nothing an admin types can inject markup into the public page.
   */
  content?: string | null
  /** The hand-written default shown when no override has been saved. */
  children: ReactNode
}

/**
 * Wraps a legal page (terms, privacy, returns) so the store owner can override the
 * body from the admin Settings screen without a code change. If they haven't, the
 * curated static copy in `children` renders unchanged.
 */
export function LegalPage({ title, content, children }: LegalPageProps) {
  const override = content?.trim()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">
            {title}
          </h1>

          {override ? (
            <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap">
              {override}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}
