'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { toast } from 'sonner'
import {
  Copy,
  ExternalLink,
  File,
  Folder,
  FolderPlus,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

interface BlobFile {
  pathname: string
  url: string
  downloadUrl: string
  size: number
  uploadedAt: string
}

interface BlobListing {
  prefix: string
  folders: string[]
  files: BlobFile[]
  cursor: string | null
  hasMore: boolean
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function baseName(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? pathname
}

export function BlobFileExplorer() {
  const [prefix, setPrefix] = useState('')
  const [listing, setListing] = useState<BlobListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [pendingDelete, setPendingDelete] = useState<BlobFile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadListing = useCallback(
    async (targetPrefix: string, cursor?: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ prefix: targetPrefix })
        if (cursor) params.set('cursor', cursor)
        const res = await fetch(`/api/developer/admin/blob?${params}`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load blob storage')
        }
        setListing((prev) =>
          cursor && prev && prev.prefix === data.prefix
            ? {
                ...data,
                folders: Array.from(new Set([...prev.folders, ...data.folders])),
                files: [...prev.files, ...data.files],
              }
            : data,
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load blob storage')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadListing(prefix)
  }, [prefix, loadListing])

  const navigateTo = (target: string) => {
    setListing(null)
    setPrefix(target)
  }

  const breadcrumbs = prefix.split('/').filter(Boolean)

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingCount(files.length)

    const items = Array.from(files)
    let failed = 0
    await Promise.all(
      items.map(async (file) => {
        const pathname = `${prefix}${file.name}`
        try {
          await upload(pathname, file, {
            access: 'public',
            handleUploadUrl: '/api/developer/admin/blob/upload',
            multipart: file.size > 10 * 1024 * 1024,
            onUploadProgress: ({ percentage }) => {
              setUploadProgress((prev) => ({ ...prev, [file.name]: percentage }))
            },
          })
        } catch (e) {
          failed += 1
          toast.error(
            `Upload failed for ${file.name}: ${e instanceof Error ? e.message : 'unknown error'}`,
          )
        } finally {
          setUploadingCount((count) => count - 1)
          setUploadProgress((prev) => {
            const next = { ...prev }
            delete next[file.name]
            return next
          })
        }
      }),
    )

    if (failed < items.length) {
      toast.success(`Uploaded ${items.length - failed} file${items.length - failed === 1 ? '' : 's'}`)
    }
    void loadListing(prefix)
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch('/api/developer/admin/blob', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [pendingDelete.url] }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Delete failed')
      }
      toast.success(`Deleted ${baseName(pendingDelete.pathname)}`)
      setPendingDelete(null)
      void loadListing(prefix)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateFolder = () => {
    const name = newFolderName
      .trim()
      .replace(/[\\/]+/g, '-')
      .replace(/^\.+/, '')
    if (!name) return
    setNewFolderOpen(false)
    setNewFolderName('')
    navigateTo(`${prefix}${name}/`)
    toast.info('Folder will be created when you upload the first file into it.')
  }

  const isUploading = uploadingCount > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              josemadridsalsa-blob
            </CardTitle>
            <CardDescription>
              Vercel Blob store connected to this project. Only the Developer account can see
              and manage these files.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadListing(prefix)}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
              <FolderPlus className="mr-1.5 h-4 w-4" />
              New Folder
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleUploadFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-1 pt-2 font-mono text-sm">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => navigateTo('')}
          >
            root
          </button>
          {breadcrumbs.map((segment, index) => {
            const target = breadcrumbs.slice(0, index + 1).join('/') + '/'
            return (
              <span key={target} className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => navigateTo(target)}
                >
                  {segment}
                </button>
              </span>
            )
          })}
        </div>

        {Object.keys(uploadProgress).length > 0 && (
          <div className="space-y-1 pt-2 text-sm text-muted-foreground">
            {Object.entries(uploadProgress).map(([name, pct]) => (
              <div key={name} className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="truncate">{name}</span>
                <span className="ml-auto tabular-nums">{Math.round(pct)}%</span>
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : loading && !listing ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Size</TableHead>
                <TableHead className="w-44">Uploaded</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listing?.folders.map((folder) => (
                <TableRow
                  key={folder}
                  className="cursor-pointer"
                  onClick={() => navigateTo(folder)}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-amber-500" />
                      {baseName(folder)}/
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {listing?.files.map((file) => (
                <TableRow key={file.pathname}>
                  <TableCell className="max-w-[28rem] truncate font-medium">
                    <span className="flex items-center gap-2">
                      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{baseName(file.pathname)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(file.uploadedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Copy URL"
                        onClick={() => {
                          void navigator.clipboard.writeText(file.url)
                          toast.success('URL copied to clipboard')
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Open" asChild>
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setPendingDelete(file)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {listing && listing.folders.length === 0 && listing.files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    This folder is empty. Upload a file to create it.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {listing?.hasMore && listing.cursor && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => loadListing(prefix, listing.cursor ?? undefined)}
            >
              Load more
            </Button>
          </div>
        )}
      </CardContent>

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.pathname}"` : 'This file'} will be permanently
              removed from the josemadridsalsa-blob store. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New folder */}
      <AlertDialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New folder</AlertDialogTitle>
            <AlertDialogDescription>
              Blob storage folders are prefixes — the folder appears once the first file is
              uploaded into it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            placeholder="folder-name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!newFolderName.trim()}
              onClick={(e) => {
                e.preventDefault()
                handleCreateFolder()
              }}
            >
              Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
