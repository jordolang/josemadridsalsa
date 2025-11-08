++ app/recipes/layout.tsx
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Recipes - Jose Madrid Salsa',
  description:
    'Cook with Jose Madrid Salsa. Explore recipes that showcase our authentic flavors in appetizers, entrees, and more.',
  pathname: '/recipes',
})

export default function RecipesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

