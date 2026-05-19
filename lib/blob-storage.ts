import { put } from '@vercel/blob'

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
} as const

const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
} as const

export const BLOB_UPLOAD_TYPES = {
  ...IMAGE_TYPES,
  ...VIDEO_TYPES,
} as const

export const VERCEL_SERVER_UPLOAD_MAX_BYTES = 4.5 * 1024 * 1024

export type BlobUploadMimeType = keyof typeof BLOB_UPLOAD_TYPES

export interface BlobUploadResult {
  url: string
  pathname: string
  filename: string
  mimeType: BlobUploadMimeType
  fileSize: number
  isVideo: boolean
}

export function blobUploadsConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export function slugifyBlobName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function assertBlobUploadFile(
  file: File,
  options: { maxBytes: number; imagesOnly?: boolean },
): asserts file is File & { type: BlobUploadMimeType } {
  const mime = file.type as BlobUploadMimeType
  const ext = BLOB_UPLOAD_TYPES[mime]

  if (!ext || (options.imagesOnly && !(mime in IMAGE_TYPES))) {
    throw new BlobUploadError(`Unsupported file type: ${file.type}`, 415)
  }

  if (file.size > options.maxBytes) {
    throw new BlobUploadError(
      `File exceeds ${(options.maxBytes / 1024 / 1024).toFixed(1)} MB limit`,
      413,
    )
  }
}

export async function uploadToVercelBlob(
  file: File,
  options: { directory: string; maxBytes: number; imagesOnly?: boolean },
): Promise<BlobUploadResult> {
  if (!blobUploadsConfigured()) {
    throw new BlobUploadError(
      'Uploads disabled: BLOB_READ_WRITE_TOKEN is not configured on the server',
      503,
    )
  }

  assertBlobUploadFile(file, options)

  const ext = BLOB_UPLOAD_TYPES[file.type]
  const base = slugifyBlobName(file.name) || 'upload'
  const pathname = `${options.directory}/${Date.now()}-${base}.${ext}`
  const blob = await put(pathname, file, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: false,
  })

  return {
    url: blob.url,
    pathname: blob.pathname,
    filename: file.name,
    mimeType: file.type,
    fileSize: file.size,
    isVideo: file.type.startsWith('video/'),
  }
}

export class BlobUploadError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'BlobUploadError'
    this.status = status
  }
}
