import type { getFaqs, getFaqCategories } from '@/lib/cms/queries'
import { sanitizeCmsHtml } from '@/lib/cms/sanitize'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface FaqGroupsProps {
  items: Awaited<ReturnType<typeof getFaqs>>
  categories: Awaited<ReturnType<typeof getFaqCategories>>
}

/** FAQ accordions grouped by the categories set up in the admin. Shared by /faq and /help. */
export function FaqGroups({ items, categories }: FaqGroupsProps) {
  const uncategorised = items.filter((item) => !item.categoryId)
  const groups = [
    ...categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        items: items.filter((item) => item.categoryId === category.id),
      }))
      .filter((group) => group.items.length > 0),
    ...(uncategorised.length > 0
      ? [{ id: 'other', name: 'Other questions', description: null, items: uncategorised }]
      : []),
  ]

  if (groups.length === 0) {
    return (
      <p className="mt-6 text-muted-foreground">
        We haven&rsquo;t published any questions yet. Get in touch and we&rsquo;ll be glad to
        help.
      </p>
    )
  }

  return (
    <div className="mt-10 space-y-10">
      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="mb-2 text-2xl font-semibold">{group.name}</h2>
          {group.description && <p className="mb-4 text-muted-foreground">{group.description}</p>}
          <Accordion type="single" collapsible>
            {group.items.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                <AccordionContent>
                  <div
                    className="prose prose-neutral max-w-none dark:prose-invert"
                    // Sanitised against an allowlist by sanitizeCmsHtml
                    dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(item.answer) }}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  )
}
