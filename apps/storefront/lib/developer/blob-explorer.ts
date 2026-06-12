import { del, list } from '@vercel/blob'
import { BlobUploadError } from '@/lib/blob-storage'

export interface BlobExplorerFile {
  pathname: string
  url: string
  downloadUrl: string
  size: number
  uploadedAt: string
}

export interface BlobExplorerListing {
  prefix: string
  folders: string[]
  files: BlobExplorerFile[]
  cursor: string | null
  hasMore: boolean
}

function assertBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token || token.startsWith('store_')) {
    throw new BlobUploadError(
      'Blob explorer disabled: BLOB_READ_WRITE_TOKEN for josemadridsalsa-blob is not configured',
      503,
    )
  }
  return token
}

/**
 * Normalize a user-supplied prefix into a safe blob directory prefix
 * ("" for the root, otherwise "dir/sub/").
 */
export function normalizeBlobPrefix(prefix: string): string {
  const cleaned = prefix
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/')

  return cleaned ? `${cleaned}/` : ''
}

/**
 * List one directory level of the josemadridsalsa-blob store.
 */
export async function listBlobDirectory(options: {
  prefix: string
  cursor?: string
  limit?: number
}): Promise<BlobExplorerListing> {
  const token = assertBlobToken()
  const prefix = normalizeBlobPrefix(options.prefix)

  const result = await list({
    token,
    prefix,
    mode: 'folded',
    cursor: options.cursor,
    limit: options.limit ?? 200,
  })

  return {
    prefix,
    folders: result.folders ?? [],
    files: result.blobs.map((blob) => ({
      pathname: blob.pathname,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      size: blob.size,
      uploadedAt: blob.uploadedAt.toISOString(),
    })),
    cursor: result.cursor ?? null,
    hasMore: result.hasMore,
  }
}

/**
 * Delete blobs by URL (or pathname) from the josemadridsalsa-blob store.
 */
export async function deleteBlobFiles(urls: string[]): Promise<void> {
  const token = assertBlobToken()
  await del(urls, { token })
}
