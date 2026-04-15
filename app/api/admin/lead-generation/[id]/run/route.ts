import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { connectBrowser, createPage } from '@/lib/scraper/browser'
import { eventBus } from '@/lib/scraper/event-bus'
import {
  SEARCH_QUERY_TEMPLATES,
  MAX_SEARCH_PAGES,
  EXCLUDED_DOMAINS,
} from '@/lib/scraper/school-config'
import type { Browser, Page } from 'playwright'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  stage: 'search' | 'parse' | 'email' | 'system'
  message: string
}

function makeEntry(level: LogEntry['level'], stage: LogEntry['stage'], message: string): LogEntry {
  return { timestamp: new Date().toISOString(), level, stage, message }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('messaging:read')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: campaignId } = await params
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(level: LogEntry['level'], stage: LogEntry['stage'], message: string) {
        try {
          const entry = makeEntry(level, stage, message)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`))
        } catch {
          // stream closed
        }
      }

      let browser: Browser | null = null

      try {
        await prisma.leadCampaign.update({
          where: { id: campaignId },
          data: { status: 'SCRAPING' },
        })

        eventBus.emit({
          type: 'campaign:status_changed',
          data: { campaignId, status: 'SCRAPING', message: 'Started scraping' },
        })

        emit('info', 'system', 'Connecting to browser...')

        try {
          browser = await connectBrowser()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          emit('error', 'system', `Failed to connect to browser: ${msg}`)
          emit('error', 'system', process.env.BROWSERLESS_TOKEN
            ? 'Browserless.io connection failed. Check your BROWSERLESS_TOKEN.'
            : 'No BROWSERLESS_TOKEN set and local Chromium unavailable.')
          await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } })
          controller.close()
          return
        }

        emit('success', 'system', `Browser connected (${process.env.BROWSERLESS_TOKEN ? 'Browserless.io' : 'local'})`)

        const page = await createPage(browser)

        if (campaign.leadType === 'LOCAL_BUSINESS') {
          await runBusinessScrape(campaignId, campaign, page, emit)
        } else {
          await runSchoolScrape(campaignId, campaign, page, emit)
        }

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        emit('error', 'system', `Scraper crashed: ${msg}`)
        await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } }).catch(() => {})
      } finally {
        if (browser) {
          emit('info', 'system', 'Closing browser...')
          await browser.close().catch(() => {})
          emit('info', 'system', 'Browser closed.')
        }
        emit('info', 'system', 'Scrape session ended.')
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

type EmitFn = (level: LogEntry['level'], stage: LogEntry['stage'], message: string) => void

async function runSchoolScrape(
  campaignId: string,
  campaign: { city: string; state: string; district: string | null; schoolType: string | null; limit: number | null; searchQuery: string | null },
  page: Page,
  emit: EmitFn
) {
  let queryTemplate = SEARCH_QUERY_TEMPLATES.by_city
  if (campaign.schoolType?.toLowerCase().includes('middle')) {
    queryTemplate = SEARCH_QUERY_TEMPLATES.by_city_middle
  } else if (campaign.district) {
    queryTemplate = SEARCH_QUERY_TEMPLATES.by_district
  }

  const templateQuery = queryTemplate
    .replace('{city}', campaign.city || '')
    .replace('{state}', campaign.state || '')
    .replace('{district}', campaign.district || '')

  let query: string
  if (campaign.searchQuery && templateQuery) {
    query = `${campaign.searchQuery} ${templateQuery}`
  } else if (campaign.searchQuery) {
    query = `${campaign.searchQuery} ${campaign.city} ${campaign.state}`
  } else if (templateQuery) {
    query = templateQuery
  } else {
    query = `${campaign.city} ${campaign.state} ${campaign.schoolType} athletics`
  }

  emit('info', 'search', `Search query: "${query.trim()}"`)

  const encodedQuery = encodeURIComponent(query.trim().replace(/\s+/g, ' '))
  let currentUrl = `https://www.google.com/search?q=${encodedQuery}&gl=us&hl=en`
  const limit = campaign.limit || 50
  let totalFound = 0
  const seenUrls = new Set<string>()

  for (let pageNum = 0; pageNum < MAX_SEARCH_PAGES; pageNum++) {
    emit('info', 'search', `Navigating to Google search page ${pageNum + 1}...`)
    await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(() =>
      page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    )
    await page.waitForTimeout(2000 + Math.random() * 1500)

    try {
      await page.click('button#L2AGLb, button#W0wltc, button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Reject all")', { timeout: 3000 })
      emit('info', 'search', 'Dismissed consent dialog')
      await page.waitForTimeout(2000)
    } catch { /* no consent */ }

    const pageUrl = page.url()
    if (pageUrl.includes('/sorry/') || pageUrl.includes('consent.google')) {
      emit('warn', 'search', `Google redirected to: ${pageUrl} — may be a CAPTCHA or consent page`)
      emit('warn', 'search', 'Waiting 5s and retrying...')
      await page.waitForTimeout(5000)
    }

    const results = await page.evaluate(() => {
      const items: Array<{ url: string; title: string }> = []
      document.querySelectorAll('#main a, #search a, #res a, a').forEach(el => {
        const a = el as HTMLAnchorElement
        let url = a.href || ''
        if (url.includes('/url?q=')) {
          try { url = new URL(url).searchParams.get('q') || url } catch { /* skip */ }
        }
        const h3 = el.querySelector('h3')
        const title = h3 ? (h3.textContent || '') : (el.textContent || '')
        if (url && url.startsWith('http') && !url.includes('google.com') && title) {
          items.push({ url, title })
        }
      })
      return items
    })

    emit('info', 'search', `Found ${results.length} links on page ${pageNum + 1}`)

    if (results.length === 0) {
      const pageTitle = await page.title()
      emit('warn', 'search', `Page title: "${pageTitle}" — Google may have shown a CAPTCHA or no results matched the query`)
    }

    for (const res of results) {
      let cleanUrl = res.url
      try {
        const urlObj = new URL(res.url)
        cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`
      } catch { /* invalid url */ }

      const isExcluded = EXCLUDED_DOMAINS.some(domain => cleanUrl.includes(domain))
      if (isExcluded || seenUrls.has(cleanUrl)) continue
      seenUrls.add(cleanUrl)

      const lead = await prisma.lead.create({
        data: {
          campaignId,
          schoolName: res.title || 'Unknown School',
          schoolUrl: res.url,
          city: campaign.city,
          state: campaign.state,
          district: campaign.district,
          status: 'SCRAPED',
        },
      })

      emit('success', 'search', `Lead found: ${lead.schoolName}`)

      eventBus.emit({
        type: 'lead:found',
        data: { campaignId, lead: { id: lead.id, schoolName: lead.schoolName, schoolUrl: lead.schoolUrl ?? '', status: lead.status } },
      })

      totalFound++
      if (totalFound >= limit) break
    }

    if (totalFound >= limit) break

    emit('info', 'search', `Progress: ${totalFound}/${limit} leads`)

    const nextButton = await page.$('a#pnnext')
    if (nextButton) {
      const nextHref = await nextButton.getAttribute('href')
      if (nextHref) {
        currentUrl = `https://www.google.com${nextHref}`
      } else break
    } else break
  }

  emit('success', 'search', `Search complete — ${totalFound} schools found`)

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'SCRAPE_COMPLETED', totalFound },
  })

  eventBus.emit({
    type: 'campaign:status_changed',
    data: { campaignId, status: 'SCRAPE_COMPLETED', message: `Completed with ${totalFound} leads found` },
  })
}

async function runBusinessScrape(
  campaignId: string,
  campaign: { city: string; state: string; businessCategory: string | null; searchQuery: string | null; limit: number | null },
  page: Page,
  emit: EmitFn
) {
  const defaultQuery = `${campaign.businessCategory || 'business'} in ${campaign.city}, ${campaign.state}`
  const query = campaign.searchQuery
    ? `${campaign.searchQuery} in ${campaign.city}, ${campaign.state}`
    : defaultQuery

  emit('info', 'search', `Search query: "${query.trim()}"`)

  const encodedQuery = encodeURIComponent(query.trim().replace(/\s+/g, ' '))
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&gl=us&hl=en`
  const limit = campaign.limit || 50
  let totalFound = 0
  const seenBusinesses = new Set<string>()

  emit('info', 'search', 'Navigating to Google search...')
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(() =>
    page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
  )
  await page.waitForTimeout(2000 + Math.random() * 1500)

  try {
    await page.click('button#L2AGLb, button#W0wltc, button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Reject all")', { timeout: 3000 })
    emit('info', 'search', 'Dismissed consent dialog')
    await page.waitForTimeout(2000)
  } catch { /* no consent */ }

  const bizPageUrl = page.url()
  if (bizPageUrl.includes('/sorry/') || bizPageUrl.includes('consent.google')) {
    emit('warn', 'search', `Google redirected to: ${bizPageUrl} — may be a CAPTCHA or consent page`)
  }

  emit('info', 'search', 'Extracting business listings from local pack...')

  const businesses = await page.evaluate(() => {
    const results: Array<{ name: string; address: string; phone: string; website: string; rating: number | null; reviewCount: number | null; googleMapsUrl: string; category: string }> = []
    const cards = document.querySelectorAll('[data-attrid="kc:/collection/knowledge_panels/has_phone:phone"], .VkpGBb, [data-hveid] .rllt__details, [jscontroller] .dbg0pd')
    cards.forEach(card => {
      const nameEl = card.querySelector('[data-attrid="title"], .dbg0pd, .OSrXXb, span.fontHeadlineSmall') || card.querySelector('a[data-cid] span, div[role="heading"]')
      const name = nameEl?.textContent?.trim() || ''
      if (!name) return
      const text = card.textContent || ''
      const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
      const ratingEl = card.querySelector('.yi40Hd, .BTtC6e, span[aria-label*="stars"], span[aria-label*="rating"]')
      let rating: number | null = null
      if (ratingEl) { const p = parseFloat(ratingEl.textContent || ''); if (!isNaN(p)) rating = p }
      const reviewEl = card.querySelector('.RDApEe, .hqzQac, span[aria-label*="review"]')
      let reviewCount: number | null = null
      if (reviewEl) { const m = (reviewEl.textContent || '').match(/\(?([\d,]+)\)?/); if (m) reviewCount = parseInt(m[1].replace(/,/g, ''), 10) }
      const addressEl = card.querySelector('.rllt__details div:nth-child(3), .rllt__details div:nth-child(2), .lMbq3e')
      const linkEl = card.querySelector('a[href*="maps"], a[data-cid]') as HTMLAnchorElement | null
      const websiteEl = card.querySelector('a[href*="http"]:not([href*="google"]):not([href*="maps"])') as HTMLAnchorElement | null
      const categoryEl = card.querySelector('.rllt__details div:first-child span, .YhemCb')
      results.push({ name, address: addressEl?.textContent?.trim() || '', phone: phoneMatch ? phoneMatch[0] : '', website: websiteEl?.href || '', rating, reviewCount, googleMapsUrl: linkEl?.href || '', category: categoryEl?.textContent?.trim() || '' })
    })
    return results
  })

  emit('info', 'search', `Found ${businesses.length} businesses in local pack`)

  for (const biz of businesses) {
    const dedupeKey = `${biz.name}|${biz.address}`.toLowerCase()
    if (seenBusinesses.has(dedupeKey)) continue
    const isExcluded = EXCLUDED_DOMAINS.some(d => (biz.website || '').includes(d))
    if (isExcluded) continue
    seenBusinesses.add(dedupeKey)

    await prisma.lead.create({
      data: {
        campaignId,
        schoolName: biz.name,
        businessName: biz.name,
        businessCategory: biz.category || campaign.businessCategory,
        address: biz.address,
        phone: biz.phone || null,
        website: biz.website || null,
        rating: biz.rating,
        reviewCount: biz.reviewCount,
        googleMapsUrl: biz.googleMapsUrl || null,
        city: campaign.city,
        state: campaign.state,
        status: 'SCRAPED',
      },
    })

    emit('success', 'search', `Business found: ${biz.name}${biz.rating ? ` (${biz.rating} stars)` : ''}`)
    totalFound++
    if (totalFound >= limit) break
  }

  if (totalFound < limit) {
    emit('info', 'search', `Need more results (${totalFound}/${limit}). Searching Google Maps...`)
    const mapsUrl = `https://www.google.com/maps/search/${encodedQuery}`
    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000 + Math.random() * 2000)

    for (let scroll = 0; scroll < 10 && totalFound < limit; scroll++) {
      const mapResults = await page.evaluate(() => {
        const results: Array<{ name: string; address: string; phone: string; website: string; rating: number | null; reviewCount: number | null; googleMapsUrl: string; category: string }> = []
        document.querySelectorAll('[role="feed"] > div > div > a').forEach(item => {
          const el = item as HTMLAnchorElement
          const name = el.getAttribute('aria-label') || el.querySelector('.fontHeadlineSmall')?.textContent?.trim() || ''
          if (!name) return
          const text = el.textContent || ''
          const ratingMatch = text.match(/([\d.]+)\s*\(/)
          const reviewMatch = text.match(/\(([\d,]+)\)/)
          const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
          const address = lines.find(l => /\d/.test(l) && (l.includes(',') || l.includes('St') || l.includes('Ave'))) || ''
          const category = lines.find(l => !l.includes('(') && !l.match(/\d{3}/) && l.length < 40 && l !== name) || ''
          results.push({ name, address, phone: phoneMatch ? phoneMatch[0] : '', website: '', rating: ratingMatch ? parseFloat(ratingMatch[1]) : null, reviewCount: reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : null, googleMapsUrl: el.href || '', category })
        })
        return results
      })

      emit('info', 'search', `Google Maps scroll ${scroll + 1}: found ${mapResults.length} results`)

      for (const biz of mapResults) {
        const dedupeKey = `${biz.name}|${biz.address}`.toLowerCase()
        if (seenBusinesses.has(dedupeKey)) continue
        seenBusinesses.add(dedupeKey)

        await prisma.lead.create({
          data: {
            campaignId,
            schoolName: biz.name,
            businessName: biz.name,
            businessCategory: biz.category || campaign.businessCategory,
            address: biz.address,
            phone: biz.phone || null,
            website: biz.website || null,
            rating: biz.rating,
            reviewCount: biz.reviewCount,
            googleMapsUrl: biz.googleMapsUrl || null,
            city: campaign.city,
            state: campaign.state,
            status: 'SCRAPED',
          },
        })

        emit('success', 'search', `Business found: ${biz.name}${biz.rating ? ` (${biz.rating} stars)` : ''}`)
        totalFound++
        if (totalFound >= limit) break
      }

      if (totalFound >= limit) break

      await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]')
        if (feed) feed.scrollTop = feed.scrollHeight
      })
      await page.waitForTimeout(2000 + Math.random() * 1500)
    }
  }

  emit('success', 'search', `Search complete — ${totalFound} businesses found`)

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'SCRAPE_COMPLETED', totalFound },
  })

  eventBus.emit({
    type: 'campaign:status_changed',
    data: { campaignId, status: 'SCRAPE_COMPLETED', message: `Completed with ${totalFound} businesses found` },
  })
}
