import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { FooterEditor } from '@/components/admin/cms/footer-editor'
import { MenuEditor } from '@/components/admin/cms/menu-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = createMetadata({
  title: 'Footer - Jose Madrid Salsa Admin',
  description: 'Footer content and link columns.',
  pathname: '/admin/content/footer',
})

export default function FooterPage() {
  return (
    <Tabs defaultValue="content">
      <TabsList>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="columns">Link columns</TabsTrigger>
      </TabsList>
      <TabsContent value="content" className="mt-6">
        <FooterEditor />
      </TabsContent>
      <TabsContent value="columns" className="mt-6">
        <MenuEditor
          location="FOOTER"
          title="Footer links"
          description="The link columns at the foot of every page."
          structureHint="Each group becomes a column heading, and the links inside it become that column's entries."
        />
      </TabsContent>
    </Tabs>
  )
}
