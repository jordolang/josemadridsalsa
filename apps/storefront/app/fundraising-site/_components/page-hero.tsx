import type { ReactNode } from 'react'

/** Gradient page banner shared by the fundraising site's content pages. */
export function PageHero({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
      <div className="absolute inset-0 bg-black/20" aria-hidden />
      <div className="container relative mx-auto px-4 py-14 text-center lg:py-20">
        {eyebrow ? (
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-200">{eyebrow}</p>
        ) : null}
        <h1 className="mx-auto max-w-4xl font-serif text-4xl font-bold lg:text-5xl">{title}</h1>
        {children ? <div className="mx-auto mt-5 max-w-3xl text-lg text-white/90 lg:text-xl">{children}</div> : null}
      </div>
    </section>
  )
}
