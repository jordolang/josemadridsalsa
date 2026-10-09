import { describe, it, expect } from 'vitest'
import { EMAIL_IMAGE_BLOB_BASE_URL, SOCIAL_ICON_SOURCES } from '@/lib/email/shared/components'
import { planEmailImageUploads } from '@/lib/email/image-upload-plan'

describe('planEmailImageUploads', () => {
  const plan = planEmailImageUploads(['b.png', 'a.JPG', 'footer.html', '.DS_Store', 'c.gif'])

  it('uploads local images under the folder emails read from, keeping their format', () => {
    const local = plan.filter((item) => 'localFile' in item)
    expect(local).toEqual([
      { pathname: 'email-templates/a.JPG', contentType: 'image/jpeg', localFile: 'a.JPG' },
      { pathname: 'email-templates/b.png', contentType: 'image/png', localFile: 'b.png' },
      { pathname: 'email-templates/c.gif', contentType: 'image/gif', localFile: 'c.gif' },
    ])
    expect(EMAIL_IMAGE_BLOB_BASE_URL.endsWith('/email-templates')).toBe(true)
  })

  it('copies every footer social icon from its original host', () => {
    const remote = plan.filter((item) => 'remoteUrl' in item)
    expect(remote).toEqual(
      Object.entries(SOCIAL_ICON_SOURCES).map(([name, url]) => ({
        pathname: `email-templates/${name}`,
        contentType: 'image/png',
        remoteUrl: url,
      }))
    )
  })
})
