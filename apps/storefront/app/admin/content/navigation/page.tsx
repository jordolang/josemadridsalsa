import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { MenuEditor } from '@/components/admin/cms/menu-editor'

export const metadata: Metadata = createMetadata({
  title: 'Navigation - Jose Madrid Salsa Admin',
  description: 'Site navigation menu.',
  pathname: '/admin/content/navigation',
})

export default function NavigationPage() {
  return (
    <MenuEditor
      location="HEADER"
      title="Navigation"
      description="The menu across the top of the site."
      structureHint="Each group becomes a dropdown in the header, and the links inside it become that dropdown's entries."
    />
  )
}
