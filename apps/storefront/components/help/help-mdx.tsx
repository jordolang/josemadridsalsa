import { isValidElement, type ComponentProps, type ReactNode } from 'react'
import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { slugify } from '@/lib/help/slugify'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { HelpTab, HelpTabs } from '@/components/help/help-tabs'

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

function Callout({ title, type, children }: { title?: string; type?: string; children: ReactNode }) {
  return (
    <aside
      role="note"
      className={cn(
        'my-6 rounded-lg border-l-4 px-5 py-4 [&>*:last-child]:mb-0 [&>p:first-of-type]:mt-0',
        type === 'warn'
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
          : 'border-primary bg-muted/60',
      )}
    >
      {title && <p className="!mb-1 !mt-0 font-semibold">{title}</p>}
      {children}
    </aside>
  )
}

function Cards({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 grid gap-4 sm:grid-cols-2">{children}</div>
}

function Card({ title, href, description }: { title: string; href: string; description?: string }) {
  return (
    <Link href={href} className="block rounded-lg border p-4 transition-colors hover:bg-muted">
      <span className="font-medium">{title}</span>
      {description && <span className="mt-1 block text-sm text-muted-foreground">{description}</span>}
    </Link>
  )
}

function Steps({ children }: { children: ReactNode }) {
  return <div className="my-6 ml-3.5 border-l pl-8 [counter-reset:step]">{children}</div>
}

function Step({ children }: { children: ReactNode }) {
  return (
    <div className="relative pb-4 [counter-increment:step] before:absolute before:-left-[2.85rem] before:top-0.5 before:flex before:size-7 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-sm before:font-semibold before:text-primary-foreground before:content-[counter(step)] [&>h3]:mt-0">
      {children}
    </div>
  )
}

function Accordions({ children }: { children: ReactNode }) {
  return (
    <Accordion type="multiple" className="not-prose my-6">
      {children}
    </Accordion>
  )
}

function AccordionEntry({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AccordionItem value={title}>
      <AccordionTrigger className="text-left">{title}</AccordionTrigger>
      <AccordionContent className="prose prose-slate max-w-none dark:prose-invert [&>*:first-child]:mt-0">
        {children}
      </AccordionContent>
    </AccordionItem>
  )
}

function heading(Tag: 'h2' | 'h3') {
  return function Heading({ children, ...props }: ComponentProps<'h2'>) {
    return (
      <Tag id={slugify(textOf(children))} className="scroll-mt-24" {...props}>
        {children}
      </Tag>
    )
  }
}

function Anchor({ href = '', ...props }: ComponentProps<'a'>) {
  return href.startsWith('/') || href.startsWith('#') ? (
    <Link href={href} {...props} />
  ) : (
    <a href={href} {...props} />
  )
}

function Table(props: ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  )
}

const components = {
  Callout,
  Cards,
  Card,
  Steps,
  Step,
  Tabs: HelpTabs,
  Tab: HelpTab,
  Accordions,
  Accordion: AccordionEntry,
  h2: heading('h2'),
  h3: heading('h3'),
  a: Anchor,
  table: Table,
}

/** Renders a help article body (MDX written for Fumadocs in salsadocs). */
export function HelpMdx({ source }: { source: string }) {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert">
      <MDXRemote
        source={source}
        components={components}
        // Repo-authored content; `blockJS` would strip props like `items={[...]}` on <Tabs>.
        options={{ blockJS: false, mdxOptions: { remarkPlugins: [remarkGfm] } }}
      />
    </div>
  )
}
