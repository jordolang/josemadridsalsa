import { z } from 'zod'

/**
 * GET /battle-arena/share?w=Ember&by=Jordan&t=Mage&n=8[&team=1][&room=ABCDE]
 *
 * The Battle Arena game's shared match links. Facebook, Messenger and texts read this page's
 * Open Graph tags to build the post preview, so the preview names the winner; a person who
 * clicks the link is sent straight on to the game, into the online room when the link carries
 * one. (A script, not a meta refresh: link crawlers follow meta refreshes and would read the
 * game page's generic tags instead.)
 */

const text = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max))

const ShareQuerySchema = z.object({
  w: text(40),
  by: text(24),
  t: text(40),
  team: text(1).transform((v) => v === '1'),
  n: text(2).transform((v) => Math.min(8, Math.max(2, parseInt(v, 10) || 0))),
  room: text(5).transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')),
})

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

export function GET(request: Request) {
  const url = new URL(request.url)
  const { w: winner, by, t: title, team, n, room } = ShareQuerySchema.parse(Object.fromEntries(url.searchParams))
  const game = `${url.origin}/battle-arena${room.length === 5 ? `?room=${room}` : ''}`

  let ogTitle = 'José Madrid Salsa Battle Arena'
  let desc = 'Eight warriors, one blood-moon coliseum. Fight the CPU or your friends free in your browser. Last one standing wins.'
  if (winner) {
    const who = team ? winner : `${winner}${by && by !== 'CPU' ? ` (${by})` : ''}`
    ogTitle = `${who} ${team ? 'took the crown' : 'won'} in ${n === 8 ? 'an' : 'a'} ${n}-fighter brawl`
    desc = `${title ? `${title}. ` : ''}Think you can do better? Play José Madrid Salsa Battle Arena free in your browser.`
  }
  if (room.length === 5) desc = `Join the fight in room ${room}. ${desc}`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(ogTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="José Madrid Salsa Battle Arena">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url.toString())}">
<meta property="og:image" content="${esc(url.origin)}/battle-arena/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="José Madrid Salsa Battle Arena crest over a fight in the coliseum">
<meta name="twitter:card" content="summary_large_image">
<style>body{background:#120c0a;color:#efe4d2;font:18px system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}a{color:#ffc861}</style>
</head>
<body>
<p><a href="${esc(game)}">Enter the arena</a></p>
<script>location.replace(${JSON.stringify(game).replace(/</g, '\\u003c')});</script>
</body>
</html>
`
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
    },
  })
}
