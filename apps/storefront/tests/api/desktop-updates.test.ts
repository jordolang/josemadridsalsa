import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/desktop/updates/[file]/route'

const UPDATES_ORIGIN = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/desktop'

const call = (file: string) =>
  GET(new Request(`http://localhost/api/desktop/updates/${file}`), { params: Promise.resolve({ file }) })

describe('GET /api/desktop/updates/[file]', () => {
  it.each(['latest.yml', 'JoseMadridSalsaAdmin-Setup-2.1.0.exe', 'JoseMadridSalsaAdmin-Setup-2.1.0.exe.blockmap', 'JoseMadridSalsaAdmin-2.1.0.dmg'])(
    'sends %s on to the public store',
    async (file) => {
      const response = await call(file)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(`${UPDATES_ORIGIN}/${file}`)
    },
  )

  it.each(['products/peach.webp', '..%2Fsite%2Flogo.png', 'latest.yml.bak', 'Other-1.0.dmg'])(
    'refuses %s rather than redirecting anywhere in the store',
    async (file) => {
      expect((await call(file)).status).toBe(404)
    },
  )
})
