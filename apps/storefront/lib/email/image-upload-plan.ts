/**
 * What `npm run email:upload-images` puts in the Vercel Blob store: every image
 * in public/email-templates, plus the footer's social icons copied from their
 * original host. Each lands at `email-templates/<filename>`, the folder
 * `getImageBaseUrl()` points at. Formats are kept as they are: several email
 * clients (Outlook among them) cannot show WebP.
 */
import { SOCIAL_ICON_SOURCES } from '@/lib/email/shared/components'

export const EMAIL_IMAGE_BLOB_FOLDER = 'email-templates'

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
}

export type EmailImageUpload =
  | { pathname: string; contentType: string; localFile: string }
  | { pathname: string; contentType: string; remoteUrl: string }

function extension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot < 0 ? '' : filename.slice(dot).toLowerCase()
}

export function planEmailImageUploads(localFilenames: string[]): EmailImageUpload[] {
  const local = localFilenames
    .filter((name) => extension(name) in CONTENT_TYPES)
    .sort()
    .map((name) => ({
      pathname: `${EMAIL_IMAGE_BLOB_FOLDER}/${name}`,
      contentType: CONTENT_TYPES[extension(name)],
      localFile: name,
    }))
  const social = Object.entries(SOCIAL_ICON_SOURCES).map(([name, url]) => ({
    pathname: `${EMAIL_IMAGE_BLOB_FOLDER}/${name}`,
    contentType: CONTENT_TYPES[extension(name)],
    remoteUrl: url,
  }))
  return [...local, ...social]
}
