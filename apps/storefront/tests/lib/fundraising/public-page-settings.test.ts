import { describe, expect, it } from 'vitest'

import {
  normalizeGaMeasurementId,
  toGooglePlaceUrl,
  toLiveStream,
  toTikTokProfileUrl,
  toYouTubeEmbedUrl,
} from '@/lib/fundraising/public-page-settings'

const NOCOOKIE = 'https://www.youtube-nocookie.com/embed/'

describe('toYouTubeEmbedUrl', () => {
  it('normalises every common YouTube URL to a youtube-nocookie embed', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(toYouTubeEmbedUrl(url)).toBe(`${NOCOOKIE}dQw4w9WgXcQ`)
    }
  })

  it('embeds playlists', () => {
    expect(toYouTubeEmbedUrl('https://www.youtube.com/playlist?list=PL1234567890ab')).toBe(
      `${NOCOOKIE}videoseries?list=PL1234567890ab`,
    )
  })

  it('rejects http, other hosts, look-alike hosts and malformed ids', () => {
    for (const url of [
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
      'https://evil.test/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/watch?v=dQw4w9WgXc"><x',
      'javascript:alert(1)',
      'not a url',
      null,
    ]) {
      expect(toYouTubeEmbedUrl(url)).toBeNull()
    }
  })
})

describe('toLiveStream', () => {
  it('embeds a Twitch channel with the page host as parent', () => {
    expect(toLiveStream('https://www.twitch.tv/salsa_stream', 'team.josemadrid.net:443')).toEqual({
      kind: 'iframe',
      provider: 'Twitch',
      src: 'https://player.twitch.tv/?channel=salsa_stream&parent=team.josemadrid.net',
    })
  })

  it('embeds Twitch VODs, YouTube and Facebook videos', () => {
    expect(toLiveStream('https://twitch.tv/videos/123456', 'x.test')).toMatchObject({ src: 'https://player.twitch.tv/?video=v123456&parent=x.test' })
    expect(toLiveStream('https://youtu.be/dQw4w9WgXcQ', 'x.test')).toMatchObject({ provider: 'YouTube', src: `${NOCOOKIE}dQw4w9WgXcQ` })
    const fb = toLiveStream('https://www.facebook.com/somepage/videos/987654321/', 'x.test')
    expect(fb).toMatchObject({ provider: 'Facebook' })
    expect(fb?.kind === 'iframe' && fb.src.startsWith('https://www.facebook.com/plugins/video.php?href=')).toBe(true)
  })

  it('links Kick rather than embedding it', () => {
    expect(toLiveStream('https://kick.com/salsa', 'x.test')).toEqual({ kind: 'link', provider: 'Kick', href: 'https://kick.com/salsa' })
  })

  it('rejects unknown hosts, http and non-stream Facebook pages', () => {
    expect(toLiveStream('https://evil.test/stream', 'x.test')).toBeNull()
    expect(toLiveStream('http://twitch.tv/salsa', 'x.test')).toBeNull()
    expect(toLiveStream('https://www.facebook.com/somepage', 'x.test')).toBeNull()
    expect(toLiveStream('https://twitch.tv/salsa', 'bad host"')).toBeNull()
  })
})

describe('toTikTokProfileUrl', () => {
  it('normalises profile and video URLs to the profile', () => {
    expect(toTikTokProfileUrl('https://tiktok.com/@jose.madrid')).toBe('https://www.tiktok.com/@jose.madrid')
    expect(toTikTokProfileUrl('https://www.tiktok.com/@jose_madrid/video/123')).toBe('https://www.tiktok.com/@jose_madrid')
  })

  it('rejects non-profile and non-TikTok URLs', () => {
    expect(toTikTokProfileUrl('https://www.tiktok.com/foryou')).toBeNull()
    expect(toTikTokProfileUrl('https://tiktok.com.evil.test/@x')).toBeNull()
    expect(toTikTokProfileUrl('http://tiktok.com/@jose')).toBeNull()
  })
})

describe('normalizeGaMeasurementId', () => {
  it('accepts GA4 and legacy UA ids, trimmed and uppercased', () => {
    expect(normalizeGaMeasurementId(' g-abc123xyz ')).toBe('G-ABC123XYZ')
    expect(normalizeGaMeasurementId('UA-12345678-1')).toBe('UA-12345678-1')
  })

  it('rejects anything that could break out of the gtag snippet', () => {
    for (const id of ["G-ABC');alert(1);//", 'GTM-ABC123', 'G-', 'UA-123', '', null]) {
      expect(normalizeGaMeasurementId(id)).toBeNull()
    }
  })
})

describe('toGooglePlaceUrl', () => {
  it('builds a documented Maps URL for a ChIJ Place ID', () => {
    expect(toGooglePlaceUrl('ChIJN1t_tDeuEmsRUsoyG83frY4', 'Lincoln High Band')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Lincoln+High+Band&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4',
    )
  })

  it('returns null for other ID shapes', () => {
    expect(toGooglePlaceUrl('1234567890', 'x')).toBeNull()
    expect(toGooglePlaceUrl('ChIJ"><script>', 'x')).toBeNull()
  })
})
