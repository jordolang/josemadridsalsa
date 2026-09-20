/**
 * Preparing a browser-picked file for the admin upload routes, and reading what comes back.
 *
 * Vercel caps a serverless request body at 4.5 MB and rejects anything over it at the edge — the
 * route never runs, and the answer is the platform's own HTML error page rather than the JSON the
 * route would have returned. A phone photo clears that cap routinely, so two things have to happen
 * in the browser: the file has to be brought under the cap before it is sent, and a failed response
 * has to be read without assuming it parses as JSON. Calling `res.json()` on that HTML page throws
 * "The string did not match the expected pattern." in Safari, which is the message an author saw
 * instead of their picture.
 *
 * Everything here but `recompressImage` is pure, so the decisions can be tested without a canvas.
 */

import { z } from 'zod'

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

/**
 * The types the Blob upload routes accept. Kept here rather than in `lib/blob-storage.ts` so the
 * browser can check a pick against the same list without pulling `@vercel/blob` into the bundle;
 * `lib/blob-storage.ts` imports it back.
 */
export const BLOB_UPLOAD_TYPES = {
  ...IMAGE_TYPES,
  ...VIDEO_TYPES,
} as const

export type BlobUploadMimeType = keyof typeof BLOB_UPLOAD_TYPES

export { IMAGE_TYPES as BLOB_IMAGE_TYPES, VIDEO_TYPES as BLOB_VIDEO_TYPES }

/** Vercel's hard cap on a serverless request body. Nothing larger reaches a route handler. */
export const SERVERLESS_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024

/**
 * What the browser aims for. Under the cap, with room for the multipart framing the body carries
 * on top of the file itself — a file of exactly the cap is a request just over it.
 */
export const UPLOAD_BUDGET_BYTES = 4 * 1024 * 1024

/**
 * Types a canvas can redraw into something smaller. GIF would lose its animation and SVG has no
 * pixels to resample, so both are sent as picked or refused on size.
 */
const RECOMPRESSABLE: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

/** What Apple's cameras produce under "High Efficiency", which no browser canvas outside Safari reads. */
const APPLE_PHOTO_TYPES: readonly string[] = ['image/heic', 'image/heif']

export type UploadPlan =
  /** Small enough and a supported type — send it as picked. */
  | { action: 'send' }
  /** A supported raster image over budget — redraw it smaller first. */
  | { action: 'recompress' }
  /** Nothing the browser can do with it; `reason` is written for the author. */
  | { action: 'reject'; reason: string }

export function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Decide what to do with a picked file before any of it goes over the wire.
 *
 * The size check is the point: the route's own limit is a backstop that the platform never lets it
 * apply, because an oversized request is refused before the function starts.
 */
export function planUpload(
  file: { type: string; size: number },
  budgetBytes: number = UPLOAD_BUDGET_BYTES
): UploadPlan {
  if (APPLE_PHOTO_TYPES.includes(file.type)) {
    return {
      action: 'reject',
      reason:
        'HEIC photos cannot be uploaded. On iPhone, Settings › Camera › Formats › Most Compatible ' +
        'saves as JPEG, or export the photo as JPEG first.',
    }
  }

  if (!(file.type in BLOB_UPLOAD_TYPES)) {
    const described = file.type ? `"${file.type}" files` : 'That file type'
    return {
      action: 'reject',
      reason: `${described} cannot be uploaded. Use JPEG, PNG, WebP, GIF, SVG, MP4, WebM, or MOV.`,
    }
  }

  if (file.size <= budgetBytes) return { action: 'send' }

  if (RECOMPRESSABLE.includes(file.type)) return { action: 'recompress' }

  return {
    action: 'reject',
    reason: `That file is ${formatMb(file.size)} and the limit is ${formatMb(budgetBytes)}. Compress it and try again.`,
  }
}

/** Longest edge and JPEG quality to try, in order. The first result under budget wins. */
const RECOMPRESS_ATTEMPTS: readonly { maxEdge: number; quality: number }[] = [
  { maxEdge: 2400, quality: 0.82 },
  { maxEdge: 2000, quality: 0.72 },
  { maxEdge: 1600, quality: 0.64 },
  { maxEdge: 1280, quality: 0.58 },
]

/** Fit `width` x `height` inside `maxEdge` without distorting it. Never upscales. */
export function scaledDimensions(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** `Sunset On The Muskingum.PNG` → `Sunset On The Muskingum.jpg`, because the redraw is a JPEG. */
export function jpegFileName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '')
  return `${stem || 'upload'}.jpg`
}

function drawToJpeg(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not resize the image.')

  // A PNG or WebP with transparency turns black on a JPEG without this.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('This browser could not resize the image.'))),
      'image/jpeg',
      quality
    )
  })
}

/**
 * Redraw an over-budget image small enough to send, as a JPEG.
 *
 * Tries progressively smaller and softer until one lands under the budget. Throws with something an
 * author can act on if the browser cannot decode the file or nothing gets small enough.
 */
export async function recompressImage(
  file: File,
  budgetBytes: number = UPLOAD_BUDGET_BYTES
): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(
      `That image is ${formatMb(file.size)} and this browser could not resize it. ` +
        `Export it under ${formatMb(budgetBytes)} and try again.`
    )
  }

  try {
    let smallest: Blob | null = null
    for (const attempt of RECOMPRESS_ATTEMPTS) {
      const { width, height } = scaledDimensions(bitmap.width, bitmap.height, attempt.maxEdge)
      const blob = await drawToJpeg(bitmap, width, height, attempt.quality)
      if (!smallest || blob.size < smallest.size) smallest = blob
      if (blob.size <= budgetBytes) break
    }

    if (!smallest || smallest.size > budgetBytes) {
      throw new Error(
        `That image is still ${formatMb(smallest?.size ?? file.size)} after resizing. ` +
          `Export it under ${formatMb(budgetBytes)} and try again.`
      )
    }

    return new File([smallest], jpegFileName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } finally {
    bitmap.close()
  }
}

const uploadResponseSchema = z.object({
  url: z.string(),
  isVideo: z.boolean().default(false),
  media: z.object({
    filename: z.string(),
    mimeType: z.string(),
  }),
})

export type UploadResponse = z.infer<typeof uploadResponseSchema>

/**
 * Turn a failed upload into a message worth showing, whatever the body turned out to be.
 *
 * The routes answer with `{ error }`, but a request the platform refuses never reaches them, so the
 * body is as likely to be an HTML error page as JSON.
 */
export function uploadFailureMessage(status: number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string' &&
      (parsed as { error: string }).error.trim()
    ) {
      return (parsed as { error: string }).error
    }
  } catch {
    // Not JSON. That is the case this function exists for — fall through to the status.
  }

  if (status === 413) {
    return `That file is too large to upload. Keep it under ${formatMb(UPLOAD_BUDGET_BYTES)}.`
  }
  if (status === 401 || status === 403) {
    return 'Your session has expired or lacks permission. Sign in again and retry the upload.'
  }
  return `Upload failed (HTTP ${status}).`
}

/**
 * Read an upload response without ever handing a non-JSON body to a JSON parser that throws
 * something unreadable.
 */
export async function readUploadResponse(res: Response): Promise<UploadResponse> {
  const body = await res.text()

  if (!res.ok) throw new Error(uploadFailureMessage(res.status, body))

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('Upload failed: the server did not return a result.')
  }

  const result = uploadResponseSchema.safeParse(parsed)
  if (!result.success) throw new Error('Upload failed: the server returned an unexpected result.')

  return result.data
}
