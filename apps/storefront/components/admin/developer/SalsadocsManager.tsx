'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  ExternalLink,
  FileDown,
  FileText,
  Folder,
  FolderPlus,
  Loader2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SalsadocsDoc {
  name: string
  path: string
}

interface SalsadocsSection {
  slug: string
  docs: SalsadocsDoc[]
  hasMeta: boolean
}

interface SalsadocsTree {
  repo: string
  branch: string
  contentDir: string
  rootDocs: SalsadocsDoc[]
  sections: SalsadocsSection[]
}

interface RepoMarkdownFile {
  path: string
  name: string
  size: number
  modifiedAt: string
  title: string | null
}

const ROOT_SECTION = '__root__'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.mdx?$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

export function SalsadocsManager() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [tree, setTree] = useState<SalsadocsTree | null>(null)
  const [loadingTree, setLoadingTree] = useState(true)
  const [repoFiles, setRepoFiles] = useState<RepoMarkdownFile[]>([])
  const [loadingRepoFiles, setLoadingRepoFiles] = useState(true)
  const [repoFilter, setRepoFilter] = useState('')
  const [convertingPath, setConvertingPath] = useState<string | null>(null)
  const [loadingDocPath, setLoadingDocPath] = useState<string | null>(null)

  // Editor state
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [section, setSection] = useState<string>(ROOT_SECTION)
  const [slug, setSlug] = useState('')
  const [mdx, setMdx] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [publishing, setPublishing] = useState(false)

  // New section dialog
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionSlug, setNewSectionSlug] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)

  const loadTree = useCallback(async () => {
    setLoadingTree(true)
    try {
      const res = await fetch('/api/developer/admin/salsadocs/tree')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load salsadocs tree')
      }
      setConfigured(data.configured)
      setTree(data.tree)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load salsadocs tree')
    } finally {
      setLoadingTree(false)
    }
  }, [])

  const loadRepoFiles = useCallback(async () => {
    setLoadingRepoFiles(true)
    try {
      const res = await fetch('/api/developer/admin/salsadocs/repo-files')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to list repository files')
      }
      setRepoFiles(data.files)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to list repository files')
    } finally {
      setLoadingRepoFiles(false)
    }
  }, [])

  useEffect(() => {
    void loadTree()
    void loadRepoFiles()
  }, [loadTree, loadRepoFiles])

  const filteredRepoFiles = useMemo(() => {
    const query = repoFilter.trim().toLowerCase()
    if (!query) return repoFiles
    return repoFiles.filter(
      (file) =>
        file.path.toLowerCase().includes(query) ||
        (file.title ?? '').toLowerCase().includes(query),
    )
  }, [repoFiles, repoFilter])

  const handleImport = async (file: RepoMarkdownFile) => {
    setConvertingPath(file.path)
    try {
      const res = await fetch('/api/developer/admin/salsadocs/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to convert file')
      }
      setEditingPath(null)
      setSlug(data.suggestedSlug)
      setMdx(data.mdx)
      setCommitMessage(`Docs: import ${file.path} from josemadridsalsa`)
      toast.success(`Converted ${file.name} to Fumadocs MDX — review and publish.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to convert file')
    } finally {
      setConvertingPath(null)
    }
  }

  const handleEditDoc = async (doc: SalsadocsDoc, docSection: string | null) => {
    setLoadingDocPath(doc.path)
    try {
      const res = await fetch(
        `/api/developer/admin/salsadocs/doc?path=${encodeURIComponent(doc.path)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load document')
      }
      setEditingPath(doc.path)
      setSection(docSection ?? ROOT_SECTION)
      setSlug(slugify(doc.name))
      setMdx(data.content)
      setCommitMessage('')
      toast.success(`Loaded ${doc.path}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load document')
    } finally {
      setLoadingDocPath(null)
    }
  }

  const handlePublish = async () => {
    if (!slug.trim() || !mdx.trim()) {
      toast.error('A slug and document content are required')
      return
    }
    setPublishing(true)
    try {
      const res = await fetch('/api/developer/admin/salsadocs/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: section === ROOT_SECTION ? null : section,
          slug: slug.trim(),
          mdx,
          message: commitMessage.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish document')
      }
      toast.success(
        `${data.created ? 'Created' : 'Updated'} ${data.path} — Vercel will redeploy salsadocs shortly.`,
      )
      setEditingPath(data.path)
      void loadTree()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish document')
    } finally {
      setPublishing(false)
    }
  }

  const handleCreateSection = async () => {
    if (!newSectionSlug.trim() || !newSectionTitle.trim()) return
    setCreatingSection(true)
    try {
      const res = await fetch('/api/developer/admin/salsadocs/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: newSectionSlug.trim(), title: newSectionTitle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create section')
      }
      toast.success(`Created section "${newSectionTitle.trim()}"`)
      setSectionDialogOpen(false)
      setSection(newSectionSlug.trim())
      setNewSectionTitle('')
      setNewSectionSlug('')
      void loadTree()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create section')
    } finally {
      setCreatingSection(false)
    }
  }

  if (configured === false) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-6 text-sm">
        <p className="font-medium">Salsadocs publishing is not configured.</p>
        <p className="mt-1 text-muted-foreground">
          Set <code className="font-mono">SALSADOCS_GITHUB_TOKEN</code> to a GitHub token with
          write access to the salsadocs repository. Optional overrides:{' '}
          <code className="font-mono">SALSADOCS_GITHUB_REPO</code> (default
          jordolang/salsadocs), <code className="font-mono">SALSADOCS_GITHUB_BRANCH</code>{' '}
          (default main), and <code className="font-mono">SALSADOCS_CONTENT_DIR</code> (default
          content/docs).
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-6">
        {/* Salsadocs tree */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Salsadocs
                </CardTitle>
                <CardDescription>
                  {tree ? `${tree.repo} @ ${tree.branch}` : 'Documentation repository'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="https://salsadocs.vercel.app" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    View Site
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadTree()} disabled={loadingTree}>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setSectionDialogOpen(true)}>
                  <FolderPlus className="mr-1.5 h-4 w-4" />
                  New Section
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTree ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading documentation tree…
              </div>
            ) : tree ? (
              <div className="space-y-4 text-sm">
                {tree.rootDocs.length > 0 && (
                  <ul className="space-y-1">
                    {tree.rootDocs.map((doc) => (
                      <li key={doc.path}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted"
                          onClick={() => void handleEditDoc(doc, null)}
                        >
                          {loadingDocPath === doc.path ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          {doc.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {tree.sections.map((docsSection) => (
                  <div key={docsSection.slug}>
                    <div className="flex items-center gap-2 px-2 py-1 font-medium">
                      <Folder className="h-4 w-4 text-amber-500" />
                      {docsSection.slug}/
                    </div>
                    <ul className="ml-5 space-y-1 border-l pl-3">
                      {docsSection.docs.map((doc) => (
                        <li key={doc.path}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted"
                            onClick={() => void handleEditDoc(doc, docsSection.slug)}
                          >
                            {loadingDocPath === doc.path ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                            {doc.name}
                          </button>
                        </li>
                      ))}
                      {docsSection.docs.length === 0 && (
                        <li className="px-2 py-1 text-muted-foreground">No pages yet</li>
                      )}
                    </ul>
                  </div>
                ))}
                {tree.rootDocs.length === 0 && tree.sections.length === 0 && (
                  <p className="py-4 text-center text-muted-foreground">
                    No documentation found under {tree.contentDir}/.
                  </p>
                )}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Could not load the documentation tree.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Repository markdown import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5" />
              Import from this repository
            </CardTitle>
            <CardDescription>
              Markdown files in josemadridsalsa — converted to Fumadocs MDX on import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Filter files…"
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
            />
            {loadingRepoFiles ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Scanning repository…
              </div>
            ) : (
              <ul className="max-h-96 space-y-1 overflow-y-auto text-sm">
                {filteredRepoFiles.map((file) => (
                  <li
                    key={file.path}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">{file.path}</div>
                      {file.title && (
                        <div className="truncate text-muted-foreground">{file.title}</div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={convertingPath !== null}
                      onClick={() => void handleImport(file)}
                    >
                      {convertingPath === file.path ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Import'
                      )}
                    </Button>
                  </li>
                ))}
                {filteredRepoFiles.length === 0 && (
                  <li className="py-4 text-center text-muted-foreground">
                    No markdown files matched.
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Editor */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" />
            {editingPath ? 'Edit Document' : 'New Document'}
          </CardTitle>
          <CardDescription>
            {editingPath
              ? `Editing ${editingPath}`
              : 'Publishes directly to the salsadocs repository — no GitHub or Vercel needed.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_SECTION}>(root)</SelectItem>
                  {tree?.sections.map((docsSection) => (
                    <SelectItem key={docsSection.slug} value={docsSection.slug}>
                      {docsSection.slug}/
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-slug">Slug</Label>
              <Input
                id="doc-slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value) || e.target.value.toLowerCase())}
                placeholder="getting-started"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-mdx">Document (Fumadocs MDX)</Label>
            <Textarea
              id="doc-mdx"
              value={mdx}
              onChange={(e) => setMdx(e.target.value)}
              rows={22}
              className="font-mono text-sm"
              placeholder={'---\ntitle: "Page Title"\ndescription: "Short description"\n---\n\nContent…'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-message">Commit message (optional)</Label>
            <Input
              id="doc-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Docs: update getting started guide"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setEditingPath(null)
                setSlug('')
                setMdx('')
                setCommitMessage('')
              }}
              disabled={publishing}
            >
              Clear
            </Button>
            <Button onClick={() => void handlePublish()} disabled={publishing || !slug || !mdx}>
              {publishing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-1.5 h-4 w-4" />
              )}
              Publish to Salsadocs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New section dialog */}
      <AlertDialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New documentation section</AlertDialogTitle>
            <AlertDialogDescription>
              Creates a folder with a Fumadocs meta.json in the salsadocs repository.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="section-title">Title</Label>
              <Input
                id="section-title"
                value={newSectionTitle}
                onChange={(e) => {
                  setNewSectionTitle(e.target.value)
                  setNewSectionSlug(slugify(e.target.value))
                }}
                placeholder="Architecture Guides"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="section-slug">Slug</Label>
              <Input
                id="section-slug"
                value={newSectionSlug}
                onChange={(e) => setNewSectionSlug(slugify(e.target.value))}
                placeholder="architecture-guides"
                className="font-mono"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingSection}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={creatingSection || !newSectionSlug || !newSectionTitle}
              onClick={(e) => {
                e.preventDefault()
                void handleCreateSection()
              }}
            >
              {creatingSection ? 'Creating…' : 'Create Section'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
