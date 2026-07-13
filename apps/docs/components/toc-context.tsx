'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { TOCItemType } from 'fumadocs-core/toc';

const TocContext = createContext<TOCItemType[] | null>(null);

export function TocProvider({
  items,
  children,
}: {
  items: TOCItemType[];
  children: ReactNode;
}) {
  return <TocContext.Provider value={items}>{children}</TocContext.Provider>;
}

export function useTocItems(): TOCItemType[] {
  const items = useContext(TocContext);
  return items ?? [];
}
