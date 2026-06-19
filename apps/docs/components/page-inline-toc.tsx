'use client';

import type { ComponentProps } from 'react';
import { InlineTOC } from './inline-toc';
import { useTocItems } from './toc-context';

type PageInlineTOCProps = Omit<ComponentProps<typeof InlineTOC>, 'items'>;

export function PageInlineTOC(props: PageInlineTOCProps) {
  const items = useTocItems();
  if (items.length === 0) return null;
  return <InlineTOC items={items} {...props} />;
}
