import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * The heat scale the storefront actually sells against — the same four rungs as
 * `HeatLevel` in schema.prisma, in the order a customer reads them on a label.
 * The 404 sits one notch past the end of it, which is the whole joke.
 */
const HEAT_SCALE = [
  { label: 'Mild', bar: 'bg-chile-200' },
  { label: 'Medium', bar: 'bg-chile-400' },
  { label: 'Hot', bar: 'bg-salsa-500' },
  { label: 'Extra hot', bar: 'bg-salsa-700' },
] as const

/**
 * Shared body of the 404 page. Rendered by `app/(public)/not-found.tsx` inside
 * the storefront chrome, and by `app/not-found.tsx` on its own for paths that
 * match no route at all.
 */
export function NotFoundContent() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-salsa-600">
        Heat level 404
      </p>

      <h1 className="mt-5 font-serif text-5xl leading-[1.05] text-foreground sm:text-7xl">
        Off the scale.
      </h1>

      <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
        We rate every salsa we make from mild to extra hot. This page isn&rsquo;t on the
        chart &mdash; the link is broken, or the page moved.
      </p>

      {/* The scale, running one notch past where it ends. */}
      <div className="mt-12" aria-hidden="true">
        <div className="flex items-end gap-1.5">
          {HEAT_SCALE.map((level) => (
            <div key={level.label} className={`h-3 flex-1 rounded-sm ${level.bar}`} />
          ))}
          <div className="h-8 flex-1 rounded-sm border-2 border-dashed border-salsa-600 bg-salsa-950/90" />
        </div>
        <div className="mt-3 flex gap-1.5">
          {HEAT_SCALE.map((level) => (
            <p
              key={level.label}
              className="flex-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs"
            >
              {level.label}
            </p>
          ))}
          <p className="flex-1 font-mono text-[10px] font-bold uppercase tracking-widest text-salsa-600 sm:text-xs">
            404
          </p>
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild className="bg-salsa-500 hover:bg-salsa-600">
          <Link href="/salsas">Shop salsas</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/recipes">Browse recipes</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/find-us">Find us locally</Link>
        </Button>
      </div>
    </main>
  )
}
