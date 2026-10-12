import { z } from 'zod'

/**
 * Fields both fundraiser sign-up forms collect for branding.
 *
 * Images arrive already uploaded (the `fundraiserSignupImage` UploadThing route), so the form
 * sends only the URL — and only one of ours is accepted. Anything else would let an applicant
 * put any image on the internet onto a public fundraiser page.
 */
export const uploadedImageUrl = z.string().url().refine((value) => {
  const { protocol, hostname } = new URL(value)
  return protocol === 'https:' && (hostname === 'utfs.io' || hostname.endsWith('.ufs.sh'))
}, 'Upload the image through the form')

export const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a color')
