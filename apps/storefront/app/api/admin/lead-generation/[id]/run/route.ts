import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getJson } from 'serpapi'
import { eventBus } from '@/lib/scraper/event-bus'
import { emitScraperEvent } from '@/lib/scraper/scraper-events'
import { EXCLUDED_DOMAINS } from '@/lib/scraper/school-config'
import { fundraiserQueriesForCategory } from '@/lib/scraper/fundraiser-config'
import * as brightData from '@/lib/scraper/brightdata'
import type { SerpResponse, SerpParams } from '@/lib/scraper/brightdata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const SERPAPI_KEY = process.env.SERPAPI_KEY

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
  let actor: Awaited<ReturnType<typeof requirePermission>>
  try {
    actor = await requirePermission('messaging:read')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: campaignId } = await params
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Logged before the stream opens, so the action is named for what is actually known at
  // this point: the run was requested. A streaming response has no single completion point
  // to hook, so an entry saying "ran" could outlive a run that died on its first scrape.
  await logAuditWithRequest(
    {
      userId: actor.id,
      action: 'run_requested',
      entityType: 'lead_campaign',
      entityId: campaign.id,
      changes: { name: campaign.name },
    },
    request
  )

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(level: LogEntry['level'], stage: LogEntry['stage'], message: string) {
        // Dual-channel emit: writes to the response body stream for clients
        // reading the POST body directly, AND publishes to the EventSource
        // ring buffer so the ActivityLog (which connects via
        // /api/admin/scraper-logs/[id]) sees events even when Vercel
        // buffers the POST response.
        try {
          const entry = makeEntry(level, stage, message)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`))
        } catch {
          // stream closed — EventSource path still works
        }
        try {
          emitScraperEvent(campaignId, level, stage, message)
        } catch {
          // never let observability plumbing kill the scrape
        }
      }

      try {
        if (!hasSerpProvider()) {
          emit('error', 'system', 'No search provider configured. Set BRIGHTDATA_API_KEY (Bright Data SERP) or SERPAPI_KEY.')
          emit('error', 'system', 'Bright Data: https://brightdata.com/products/serp-api — or SerpAPI free tier: https://serpapi.com')
          await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } })
          controller.close()
          return
        }

        await prisma.leadCampaign.update({
          where: { id: campaignId },
          data: { status: 'SCRAPING' },
        })

        eventBus.emit({
          type: 'campaign:status_changed',
          data: { campaignId, status: 'SCRAPING', message: 'Started scraping' },
        })

        emit('info', 'system', `Using ${brightData.isSerpConfigured() ? 'Bright Data SERP API' : 'SerpAPI'} for Google search (no browser needed, no CAPTCHA)`)

        if (campaign.leadType === 'LOCAL_BUSINESS') {
          await runBusinessSearch(campaignId, campaign, emit)
        } else if (campaign.leadType === 'FUNDRAISER_ORG') {
          await runFundraiserOrgSearch(campaignId, campaign, emit)
        } else {
          await runSchoolSearch(campaignId, campaign, emit)
        }

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        emit('error', 'system', `Scraper crashed: ${msg}`)
        await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } }).catch(() => {})
      } finally {
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

/** True when at least one SERP provider (Bright Data or SerpAPI) is configured. */
function hasSerpProvider(): boolean {
  return brightData.isSerpConfigured() || Boolean(SERPAPI_KEY)
}

/**
 * Unified structured search. Prefers Bright Data's SERP API when configured;
 * falls back to SerpAPI if Bright Data errors or returns nothing usable.
 */
async function serpSearch(params: SerpParams): Promise<SerpResponse> {
  if (brightData.isSerpConfigured()) {
    try {
      const data = await brightData.serpSearch(params)
      const hasResults =
        (data.organic_results?.length || 0) > 0 ||
        (data.local_results?.places?.length || 0) > 0
      if (hasResults || !SERPAPI_KEY) return data
    } catch {
      // Fall through to SerpAPI if it's available.
      if (!SERPAPI_KEY) throw new Error('Bright Data SERP request failed and no SerpAPI fallback is configured')
    }
  }
  return serpApiSearch(params)
}

async function serpApiSearch(params: SerpParams): Promise<SerpResponse> {
  return new Promise((resolve, reject) => {
    getJson({
      api_key: SERPAPI_KEY!,
      ...params,
    }, (data: SerpResponse) => {
      if (data.error) reject(new Error(data.error))
      else resolve(data)
    })
  })
}

async function runSchoolSearch(
  campaignId: string,
  campaign: { city: string; state: string; district: string | null; schoolType: string | null; limit: number | null; searchQuery: string | null },
  emit: EmitFn
) {
  const baseQuery = campaign.district
    ? `${campaign.district} ${campaign.schoolType || 'high school'} athletics ${campaign.state}`
    : `${campaign.city} ${campaign.state} ${campaign.schoolType || 'high school'} athletics`

  const query = campaign.searchQuery
    ? `${campaign.searchQuery} ${campaign.city} ${campaign.state}`
    : baseQuery

  emit('info', 'search', `Search query: "${query.trim()}"`)

  const limit = campaign.limit || 50
  let totalFound = 0
  const seenUrls = new Set<string>()
  const maxPages = Math.min(Math.ceil(limit / 10), 5)

  for (let page = 0; page < maxPages && totalFound < limit; page++) {
    emit('info', 'search', `Fetching Google results page ${page + 1}...`)

    const data = await serpSearch({
      engine: 'google',
      q: query.trim(),
      location: `${campaign.city}, ${campaign.state}, United States`,
      hl: 'en',
      gl: 'us',
      num: 10,
      start: page * 10,
    })

    const results = data.organic_results || []
    emit('info', 'search', `SerpAPI returned ${results.length} organic results`)

    if (results.length === 0) {
      emit('warn', 'search', 'No more results available from Google')
      break
    }

    // Stage rows in memory, batch-insert with createMany per page. Cuts DB
    // round-trips from N (one per lead) to 1 per page, keeping scrape time
    // comfortably under Vercel's 120s maxDuration. Per-row emit happens
    // after the insert so the UI still streams lead-by-lead.
    const pageRows: Array<{
      campaignId: string
      schoolName: string
      schoolUrl: string
      city: string
      state: string
      district: string | null
      status: 'SCRAPED'
    }> = []

    for (const res of results) {
      if (!res.link || !res.title) continue

      let cleanUrl = res.link
      try {
        const urlObj = new URL(res.link)
        cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`
      } catch { continue }

      const isExcluded = EXCLUDED_DOMAINS.some(domain => cleanUrl.includes(domain))
      if (isExcluded || seenUrls.has(cleanUrl)) continue
      seenUrls.add(cleanUrl)

      pageRows.push({
        campaignId,
        schoolName: res.title,
        schoolUrl: res.link,
        city: campaign.city,
        state: campaign.state,
        district: campaign.district,
        status: 'SCRAPED',
      })

      totalFound++
      if (totalFound >= limit) break
    }

    if (pageRows.length > 0) {
      await prisma.lead.createMany({ data: pageRows, skipDuplicates: true })
      for (const row of pageRows) {
        emit('success', 'search', `Lead found: ${row.schoolName}`)
        eventBus.emit({
          type: 'lead:found',
          data: {
            campaignId,
            // No id available from createMany — consumers should use
            // schoolUrl as the dedupe key until a later lookup fills ids.
            lead: { id: '', schoolName: row.schoolName, schoolUrl: row.schoolUrl, status: row.status },
          },
        })
      }
    }

    emit('info', 'search', `Progress: ${totalFound}/${limit} leads`)
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

async function runBusinessSearch(
  campaignId: string,
  campaign: { city: string; state: string; businessCategory: string | null; searchQuery: string | null; limit: number | null },
  emit: EmitFn
) {
  const query = campaign.searchQuery
    ? `${campaign.searchQuery} in ${campaign.city}, ${campaign.state}`
    : `${campaign.businessCategory || 'business'} in ${campaign.city}, ${campaign.state}`

  emit('info', 'search', `Search query: "${query.trim()}"`)
  emit('info', 'search', 'Using SerpAPI Google Maps engine for business data...')

  const limit = campaign.limit || 50
  let totalFound = 0
  const seenBusinesses = new Set<string>()

  const data = await serpSearch({
    engine: 'google_maps',
    q: query.trim(),
    ll: '', // let SerpAPI geocode from query
    hl: 'en',
    type: 'search',
  })

  const places = data.local_results?.places || []
  emit('info', 'search', `SerpAPI returned ${places.length} business listings`)

  const mapsRows: Array<{
    campaignId: string
    schoolName: string
    businessName: string
    businessCategory: string | null
    address: string | null
    phone: string | null
    website: string | null
    rating: number | null
    reviewCount: number | null
    googleMapsUrl: string | null
    placeId: string | null
    city: string
    state: string
    status: 'SCRAPED'
  }> = []
  const mapsMessages: string[] = []

  for (const place of places) {
    if (!place.title) continue

    const dedupeKey = `${place.title}|${place.address || ''}`.toLowerCase()
    if (seenBusinesses.has(dedupeKey)) continue

    const isExcluded = EXCLUDED_DOMAINS.some(d => (place.website || '').includes(d))
    if (isExcluded) continue
    seenBusinesses.add(dedupeKey)

    mapsRows.push({
      campaignId,
      schoolName: place.title,
      businessName: place.title,
      businessCategory: place.type || campaign.businessCategory,
      address: place.address || null,
      phone: place.phone || null,
      website: place.website || null,
      rating: place.rating || null,
      reviewCount: place.reviews || null,
      googleMapsUrl: place.links?.directions || null,
      placeId: place.place_id || null,
      city: campaign.city,
      state: campaign.state,
      status: 'SCRAPED',
    })
    mapsMessages.push(
      `Business found: ${place.title}${place.rating ? ` (${place.rating}★ · ${place.reviews || 0} reviews)` : ''}${place.address ? ` — ${place.address}` : ''}`,
    )

    totalFound++
    if (totalFound >= limit) break
  }

  if (mapsRows.length > 0) {
    await prisma.lead.createMany({ data: mapsRows, skipDuplicates: true })
    for (const msg of mapsMessages) emit('success', 'search', msg)
  }

  if (totalFound < limit) {
    emit('info', 'search', `Need more results (${totalFound}/${limit}). Trying organic Google search...`)

    const organicData = await serpSearch({
      engine: 'google',
      q: query.trim(),
      location: `${campaign.city}, ${campaign.state}, United States`,
      hl: 'en',
      gl: 'us',
      num: 20,
    })

    const organicResults = organicData.organic_results || []
    emit('info', 'search', `SerpAPI returned ${organicResults.length} organic results`)

    const organicRows: Array<{
      campaignId: string
      schoolName: string
      businessName: string
      businessCategory: string | null
      website: string
      city: string
      state: string
      status: 'SCRAPED'
    }> = []
    const organicMessages: string[] = []

    for (const res of organicResults) {
      if (!res.link || !res.title) continue

      const dedupeKey = `${res.title}|${res.link}`.toLowerCase()
      if (seenBusinesses.has(dedupeKey)) continue
      seenBusinesses.add(dedupeKey)

      const isExcluded = EXCLUDED_DOMAINS.some(d => res.link!.includes(d))
      if (isExcluded) continue

      organicRows.push({
        campaignId,
        schoolName: res.title,
        businessName: res.title,
        businessCategory: campaign.businessCategory,
        website: res.link,
        city: campaign.city,
        state: campaign.state,
        status: 'SCRAPED',
      })
      organicMessages.push(`Business found (web): ${res.title}`)
      totalFound++
      if (totalFound >= limit) break
    }

    if (organicRows.length > 0) {
      await prisma.lead.createMany({ data: organicRows, skipDuplicates: true })
      for (const msg of organicMessages) emit('success', 'search', msg)
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

async function runFundraiserOrgSearch(
  campaignId: string,
  campaign: { city: string; state: string; businessCategory: string | null; searchQuery: string | null; limit: number | null },
  emit: EmitFn,
) {
  // A custom query overrides the curated set; otherwise expand the category
  // (or every category, when none is chosen) into Google Maps searches.
  const templates = campaign.searchQuery
    ? [campaign.searchQuery.includes('{city}') ? campaign.searchQuery : `${campaign.searchQuery} {city} {state}`]
    : fundraiserQueriesForCategory(campaign.businessCategory)

  const limit = campaign.limit || 50
  let totalFound = 0
  const seen = new Set<string>()

  emit('info', 'search', `Targeting fundraiser organizations${campaign.businessCategory ? ` — ${campaign.businessCategory}` : ''} in ${campaign.city}, ${campaign.state}`)
  emit('info', 'search', `Running up to ${templates.length} search queries...`)

  for (const template of templates) {
    if (totalFound >= limit) break

    const query = template
      .replace('{city}', campaign.city)
      .replace('{state}', campaign.state)
      .trim()
      .replace(/\s+/g, ' ')

    emit('info', 'search', `Query: "${query}"`)

    let data: SerpResponse
    try {
      data = await serpSearch({ engine: 'google_maps', q: query, hl: 'en', type: 'search' })
    } catch (err) {
      emit('warn', 'search', `Query failed: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }

    const places = data.local_results?.places || []
    emit('info', 'search', `Found ${places.length} listings`)

    const rows: Array<{
      campaignId: string
      schoolName: string
      businessName: string
      businessCategory: string | null
      address: string | null
      phone: string | null
      website: string | null
      rating: number | null
      reviewCount: number | null
      googleMapsUrl: string | null
      placeId: string | null
      city: string
      state: string
      status: 'SCRAPED'
    }> = []
    const messages: string[] = []

    for (const place of places) {
      if (!place.title) continue

      const dedupeKey = `${place.title}|${place.address || ''}`.toLowerCase()
      if (seen.has(dedupeKey)) continue

      const isExcluded = EXCLUDED_DOMAINS.some(d => (place.website || '').includes(d))
      if (isExcluded) continue
      seen.add(dedupeKey)

      rows.push({
        campaignId,
        schoolName: place.title,
        businessName: place.title,
        businessCategory: campaign.businessCategory || place.type || null,
        address: place.address || null,
        phone: place.phone || null,
        website: place.website || null,
        rating: place.rating || null,
        reviewCount: place.reviews || null,
        googleMapsUrl: place.links?.directions || null,
        placeId: place.place_id || null,
        city: campaign.city,
        state: campaign.state,
        status: 'SCRAPED',
      })
      messages.push(
        `Org found: ${place.title}${place.rating ? ` (${place.rating}★ · ${place.reviews || 0} reviews)` : ''}${place.address ? ` — ${place.address}` : ''}`,
      )

      totalFound++
      if (totalFound >= limit) break
    }

    if (rows.length > 0) {
      await prisma.lead.createMany({ data: rows, skipDuplicates: true })
      for (const msg of messages) emit('success', 'search', msg)
    }

    emit('info', 'search', `Progress: ${totalFound}/${limit} organizations`)
  }

  emit('success', 'search', `Search complete — ${totalFound} organizations found`)

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'SCRAPE_COMPLETED', totalFound },
  })

  eventBus.emit({
    type: 'campaign:status_changed',
    data: { campaignId, status: 'SCRAPE_COMPLETED', message: `Completed with ${totalFound} organizations found` },
  })
}
