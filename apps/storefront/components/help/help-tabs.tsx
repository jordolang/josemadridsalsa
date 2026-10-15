'use client'

import type { ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

/** Fumadocs-compatible `<Tabs items>` / `<Tab value>` for help articles. */
export function HelpTabs({ items, children }: { items: string[]; children: ReactNode }) {
  return (
    <TabsPrimitive.Root defaultValue={items[0]} className="my-6">
      <TabsPrimitive.List className="not-prose flex gap-1 border-b" aria-label="Options">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item}
            value={item}
            className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
          >
            {item}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

export function HelpTab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Content value={value} className="pt-2">
      {children}
    </TabsPrimitive.Content>
  )
}
