import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { getDocRegistry } from '@/lib/docs/service'
import { DocControls } from './_components/doc-controls'
import { syncDocsAction } from './actions'

export default async function AdminDocsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const [canManage, docs] = await Promise.all([
    hasPermission(user, 'content:publish'),
    getDocRegistry(),
  ])

  const publishedCount = docs.filter((doc) => doc.isPublished).length
  const developerCount = docs.filter((doc) => doc.visibility === 'developer').length

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documentation</h1>
          <p className="text-muted-foreground">
            Manage public knowledge base pages that are rendered through Fumadocs on josemadridsalsa.com/docs.
          </p>
        </div>
        <form action={syncDocsAction}>
          <Button type="submit" disabled={!canManage}>
            Sync from docs folder
          </Button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{docs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Published</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{publishedCount}</p>
            <p className="text-sm text-muted-foreground">
              {docs.length > 0 ? Math.round((publishedCount / docs.length) * 100) : 0}% of docs are live
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Developer only</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{developerCount}</p>
            <p className="text-sm text-muted-foreground">Hidden unless an admin/staff member is signed in</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {docs.map((doc) => (
          <Card key={doc.slug} className="flex flex-col">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">{doc.title}</CardTitle>
                <Badge variant={doc.isPublished ? 'default' : 'destructive'}>
                  {doc.isPublished ? 'Published' : 'Hidden'}
                </Badge>
                {doc.visibility === 'developer' && <Badge variant="secondary">Developer</Badge>}
                {doc.category && <Badge variant="secondary">{doc.category}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{doc.description ?? 'No description provided.'}</p>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col gap-4 pt-6">
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {doc.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Source file: {doc.filePath}</p>
              <DocControls
                slug={doc.slug}
                isPublished={doc.isPublished}
                visibility={doc.visibility}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
