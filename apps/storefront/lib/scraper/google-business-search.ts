import { prisma } from '@/lib/prisma'
import { eventBus } from './event-bus'
import { emitScraperEvent } from './scraper-events'
import { connectBrowser, createPage, browserProviderName } from './browser'
import { EXCLUDED_DOMAINS } from './school-config'

interface BusinessResult {
  name: string
  address: string
  phone: string
  website: string
  rating: number | null
  reviewCount: number | null
  googleMapsUrl: string
  category: string
}

async function createBusinessLead(
  campaignId: string,
  biz: BusinessResult,
  campaign: { businessCategory: string | null; city: string; state: string }
) {
  const lead = await prisma.lead.create({
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

  eventBus.emit({
    type: 'lead:found',
    data: {
      campaignId,
      lead: {
        id: lead.id,
        schoolName: lead.schoolName,
        schoolUrl: lead.website ?? '',
        status: lead.status,
      },
    },
  })

  return lead
}

export async function runGoogleBusinessScraper(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
  })
  if (!campaign) throw new Error('Campaign not found')

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'SCRAPING' },
  })

  eventBus.emit({
    type: 'campaign:status_changed',
    data: {
      campaignId,
      status: 'SCRAPING',
      message: 'Started Google Business scraping',
    },
  })

  emitScraperEvent(campaignId, 'info', 'system', 'Connecting to browser...')

  let browser;
  try {
    browser = await connectBrowser()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    emitScraperEvent(campaignId, 'error', 'system', `Failed to connect to browser: ${msg}`)
    emitScraperEvent(campaignId, 'error', 'system', process.env.BROWSERLESS_TOKEN || process.env.BRIGHTDATA_BROWSER_URL
      ? `${browserProviderName()} connection failed. Check your credentials.`
      : 'No BRIGHTDATA_BROWSER_URL or BROWSERLESS_TOKEN set and local Chromium unavailable. Set one in your environment variables.')
    await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } })
    eventBus.emit({ type: 'campaign:status_changed', data: { campaignId, status: 'FAILED', message: 'Browser connection failed' } })
    return
  }

  emitScraperEvent(campaignId, 'success', 'system', `Browser connected (${browserProviderName()})`)

  const page = await createPage(browser)

  try {
    const query =
      campaign.searchQuery ||
      `${campaign.businessCategory || 'business'} in ${campaign.city}, ${campaign.state}`

    emitScraperEvent(campaignId, 'info', 'search', `Search query: "${query.trim()}"`)

    const encodedQuery = encodeURIComponent(query.trim().replace(/\s+/g, ' '))
    const searchUrl = `https://www.google.com/search?q=${encodedQuery}&gl=us&hl=en`

    emitScraperEvent(campaignId, 'info', 'search', 'Navigating to Google search...')
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500 + Math.random() * 1500)

    // Dismiss consent dialogs
    try {
      await page.click(
        'button#L2AGLb, button#W0wltc, button:has-text("Accept all"), button:has-text("I agree")',
        { timeout: 2000 }
      )
      await page.waitForTimeout(1000)
    } catch {
      // No consent dialog
    }

    const limit = campaign.limit || 50
    let totalFound = 0
    const seenBusinesses = new Set<string>()

    emitScraperEvent(campaignId, 'info', 'search', 'Extracting business listings from Google local pack...')
    const businesses = await extractBusinessResults(page)
    emitScraperEvent(campaignId, 'info', 'search', `Found ${businesses.length} businesses in local pack`)

    for (const biz of businesses) {
      const dedupeKey = `${biz.name}|${biz.address}`.toLowerCase()
      if (seenBusinesses.has(dedupeKey)) continue

      const isExcluded = EXCLUDED_DOMAINS.some((domain) =>
        (biz.website || '').includes(domain)
      )
      if (isExcluded) continue

      seenBusinesses.add(dedupeKey)

      await createBusinessLead(campaignId, biz, campaign)

      totalFound++
      if (totalFound >= limit) break
    }

    if (totalFound < limit) {
      emitScraperEvent(campaignId, 'info', 'search', `Need more results (${totalFound}/${limit}). Searching Google Maps...`)
      const mapsUrl = `https://www.google.com/maps/search/${encodedQuery}`
      await page.goto(mapsUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000 + Math.random() * 2000)

      const maxScrollAttempts = 10
      for (let scroll = 0; scroll < maxScrollAttempts && totalFound < limit; scroll++) {
        const mapResults = await extractMapsResults(page)

        for (const biz of mapResults) {
          const dedupeKey = `${biz.name}|${biz.address}`.toLowerCase()
          if (seenBusinesses.has(dedupeKey)) continue
          seenBusinesses.add(dedupeKey)

          await createBusinessLead(campaignId, biz, campaign)

          totalFound++
          if (totalFound >= limit) break
        }

        if (totalFound >= limit) break

        eventBus.emit({
          type: 'campaign:progress',
          data: {
            campaignId,
            currentStep: 'search',
            progress: { current: totalFound, total: limit },
          },
        })

        // Scroll down in the maps sidebar for more results
        await page.evaluate(() => {
          const feed = document.querySelector('[role="feed"]')
          if (feed) feed.scrollTop = feed.scrollHeight
        })
        await page.waitForTimeout(2000 + Math.random() * 1500)
      }
    }

    emitScraperEvent(campaignId, 'success', 'search', `Search complete — ${totalFound} businesses found`)

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'SCRAPE_COMPLETED', totalFound },
    })

    eventBus.emit({
      type: 'campaign:status_changed',
      data: {
        campaignId,
        status: 'SCRAPE_COMPLETED',
        message: `Completed with ${totalFound} businesses found`,
      },
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    emitScraperEvent(campaignId, 'error', 'search', `Scraping failed: ${errorMessage}`)

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    })

    eventBus.emit({
      type: 'campaign:error',
      data: { campaignId, error: errorMessage, step: 'search' },
    })
  } finally {
    emitScraperEvent(campaignId, 'info', 'system', 'Closing browser connection...')
    await browser.close()
    emitScraperEvent(campaignId, 'info', 'system', 'Browser closed.')
  }
}

async function extractBusinessResults(
  page: import('playwright').Page
): Promise<BusinessResult[]> {
  return page.evaluate(() => {
    const results: Array<{
      name: string
      address: string
      phone: string
      website: string
      rating: number | null
      reviewCount: number | null
      googleMapsUrl: string
      category: string
    }> = []

    // Google local pack cards
    const cards = document.querySelectorAll('[data-attrid="kc:/collection/knowledge_panels/has_phone:phone"], .VkpGBb, [data-hveid] .rllt__details, [jscontroller] .dbg0pd')

    cards.forEach((card) => {
      const nameEl =
        card.querySelector('[data-attrid="title"], .dbg0pd, .OSrXXb, span.fontHeadlineSmall') ||
        card.querySelector('a[data-cid] span, div[role="heading"]')
      const name = nameEl?.textContent?.trim() || ''
      if (!name) return

      const text = card.textContent || ''

      const phoneMatch = text.match(
        /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
      )
      const phone = phoneMatch ? phoneMatch[0] : ''

      const ratingEl = card.querySelector('.yi40Hd, .BTtC6e, span[aria-label*="stars"], span[aria-label*="rating"]')
      let rating: number | null = null
      if (ratingEl) {
        const parsed = parseFloat(ratingEl.textContent || '')
        if (!isNaN(parsed)) rating = parsed
      }

      const reviewEl = card.querySelector('.RDApEe, .hqzQac, span[aria-label*="review"]')
      let reviewCount: number | null = null
      if (reviewEl) {
        const reviewText = reviewEl.textContent || ''
        const reviewMatch = reviewText.match(/\(?([\d,]+)\)?/)
        if (reviewMatch) {
          reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10)
        }
      }

      const addressEl = card.querySelector('.rllt__details div:nth-child(3), .rllt__details div:nth-child(2), .lMbq3e')
      const address = addressEl?.textContent?.trim() || ''

      const linkEl = card.querySelector('a[href*="maps"], a[data-cid]') as HTMLAnchorElement | null
      const googleMapsUrl = linkEl?.href || ''

      const websiteEl = card.querySelector('a[href*="http"]:not([href*="google"]):not([href*="maps"])') as HTMLAnchorElement | null
      const website = websiteEl?.href || ''

      const categoryEl = card.querySelector('.rllt__details div:first-child span, .YhemCb')
      const category = categoryEl?.textContent?.trim() || ''

      results.push({
        name,
        address,
        phone,
        website,
        rating,
        reviewCount,
        googleMapsUrl,
        category,
      })
    })

    return results
  })
}

async function extractMapsResults(
  page: import('playwright').Page
): Promise<BusinessResult[]> {
  return page.evaluate(() => {
    const results: Array<{
      name: string
      address: string
      phone: string
      website: string
      rating: number | null
      reviewCount: number | null
      googleMapsUrl: string
      category: string
    }> = []

    const items = document.querySelectorAll('[role="feed"] > div > div > a')

    items.forEach((item) => {
      const el = item as HTMLAnchorElement
      const ariaLabel = el.getAttribute('aria-label') || ''
      const name = ariaLabel || el.querySelector('.fontHeadlineSmall')?.textContent?.trim() || ''
      if (!name) return

      const text = el.textContent || ''
      const googleMapsUrl = el.href || ''

      const ratingMatch = text.match(/([\d.]+)\s*\(/)
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null

      const reviewMatch = text.match(/\(([\d,]+)\)/)
      const reviewCount = reviewMatch
        ? parseInt(reviewMatch[1].replace(/,/g, ''), 10)
        : null

      const phoneMatch = text.match(
        /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
      )
      const phone = phoneMatch ? phoneMatch[0] : ''

      // Address is typically after the category in maps results
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
      const address = lines.find(
        (l) =>
          /\d/.test(l) &&
          (l.includes(',') || l.includes('St') || l.includes('Ave') || l.includes('Rd') || l.includes('Blvd') || l.includes('Dr'))
      ) || ''

      const categoryLine = lines.find(
        (l) => !l.includes('(') && !l.match(/\d{3}/) && l.length < 40 && l !== name
      )
      const category = categoryLine || ''

      results.push({
        name,
        address,
        phone,
        website: '',
        rating,
        reviewCount,
        googleMapsUrl,
        category,
      })
    })

    return results
  })
}
