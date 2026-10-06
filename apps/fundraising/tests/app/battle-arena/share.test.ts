import { describe, expect, it } from 'vitest'
import { GET } from '@/app/battle-arena/share/route'

const ORIGIN = 'https://fundraising.josemadrid.net'

async function share(query: string) {
  const res = GET(new Request(`${ORIGIN}/battle-arena/share?${query}`))
  return { res, html: await res.text() }
}

describe('GET /battle-arena/share', () => {
  it('names the winner in the preview and sends the visitor to the game', async () => {
    const { res, html } = await share('w=Ember&by=Jordan&t=Mage&n=8')

    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(html).toContain('<meta property="og:title" content="Ember (Jordan) won in an 8-fighter brawl">')
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/battle-arena/og-image.jpg">`)
    expect(html).toContain(`location.replace("${ORIGIN}/battle-arena")`)
  })

  it('sends an invite into its online room', async () => {
    const { html } = await share('room=ab12c')

    expect(html).toContain('Join the fight in room AB12C.')
    expect(html).toContain(`location.replace("${ORIGIN}/battle-arena?room=AB12C")`)
  })

  it('escapes what the link carries', async () => {
    const { html } = await share(`w=${encodeURIComponent('<script>x</script>')}&team=1&n=99`)

    expect(html).not.toContain('<script>x')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt; took the crown in an 8-fighter brawl')
  })
})
