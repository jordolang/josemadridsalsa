/**
 * Host every email image in the Vercel Blob store, where `getImageBaseUrl()`
 * points, so sent mail never depends on the website or a third-party host.
 *
 *   npm run email:upload-images --workspace @jose-madrid/storefront            # dry run
 *   npm run email:upload-images --workspace @jose-madrid/storefront -- --apply # upload
 *
 * Needs BLOB_READ_WRITE_TOKEN for the josemadridsalsa-blob store. Uploads keep
 * their filenames and overwrite, so re-running after adding an image is safe.
 * After uploading, run `npm run email:repair-images -- --apply` to point
 * templates already saved in the database at the store.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { put } from '@vercel/blob'
import { getErrorMessage } from '@/lib/errors'
import { EMAIL_IMAGE_BLOB_BASE_URL } from '@/lib/email/shared/components'
import { planEmailImageUploads } from '@/lib/email/image-upload-plan'

const IMAGE_DIR = path.join(process.cwd(), 'public', 'email-templates')
const apply = process.argv.includes('--apply')

async function uploadEmailImages() {
  const plan = planEmailImageUploads(await readdir(IMAGE_DIR))
  console.log(apply ? 'UPLOADING email images\n' : 'DRY RUN (pass --apply to upload)\n')

  if (apply && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set; nothing uploaded.')
    process.exitCode = 1
    return
  }

  let failures = 0
  for (const item of plan) {
    const from = 'localFile' in item ? `public/email-templates/${item.localFile}` : item.remoteUrl
    if (!apply) {
      console.log(`  ${item.pathname}  ←  ${from}`)
      continue
    }
    try {
      let body: Buffer
      if ('localFile' in item) {
        body = await readFile(path.join(IMAGE_DIR, item.localFile))
      } else {
        const response = await fetch(item.remoteUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status} from ${item.remoteUrl}`)
        body = Buffer.from(await response.arrayBuffer())
      }
      const { url } = await put(item.pathname, body, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: item.contentType,
      })
      console.log(`  up    ${url}`)
      if (!url.startsWith(EMAIL_IMAGE_BLOB_BASE_URL)) {
        console.warn(
          `  ! This token writes to a different store than emails read from (${EMAIL_IMAGE_BLOB_BASE_URL}). ` +
            'Set EMAIL_IMAGE_BASE_URL to this store\'s email-templates folder, or use the josemadridsalsa-blob token.',
        )
      }
    } catch (error) {
      failures++
      console.error(`  FAIL  ${item.pathname}: ${getErrorMessage(error)}`)
    }
  }

  console.log(`\n${plan.length} images${apply ? `, ${failures} failed` : ''}.`)
  if (failures > 0) process.exitCode = 1
}

uploadEmailImages()
