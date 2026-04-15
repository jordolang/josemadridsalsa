import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getJson } from 'serpapi'
import { eventBus } from '@/lib/scraper/event-bus'
import { EXCLUDED_DOMAINS } from '@/lib/scraper/school-config'

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

      try {
        if (!SERPAPI_KEY) {
          emit('error', 'system', 'SERPAPI_KEY environment variable is not set. Add it to your Vercel environment variables.')
          emit('error', 'system', 'Get a free API key at https://serpapi.com (100 searches/month free)')
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

        emit('info', 'system', 'Using SerpAPI for Google search (no browser needed, no CAPTCHA)')

        if (campaign.leadType === 'LOCAL_BUSINESS') {
          await runBusinessSearch(campaignId, campaign, emit)
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

interface SerpOrganicResult {
  title?: string
  link?: string
  snippet?: string
  displayed_link?: string
}

interface SerpLocalResult {
  title?: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  reviews?: number
  type?: string
  gps_coordinates?: { latitude: number; longitude: number }
  place_id?: string
  links?: { directions?: string }
  thumbnail?: string
}

interface SerpResponse {
  organic_results?: SerpOrganicResult[]
  local_results?: { places?: SerpLocalResult[] }
  search_information?: { total_results?: number }
  error?: string
}

async function serpSearch(params: Record<string, string | number>): Promise<SerpResponse> {
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

      const lead = await prisma.lead.create({
        data: {
          campaignId,
          schoolName: res.title,
          schoolUrl: res.link,
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

  for (const place of places) {
    if (!place.title) continue

    const dedupeKey = `${place.title}|${place.address || ''}`.toLowerCase()
    if (seenBusinesses.has(dedupeKey)) continue

    const isExcluded = EXCLUDED_DOMAINS.some(d => (place.website || '').includes(d))
    if (isExcluded) continue
    seenBusinesses.add(dedupeKey)

    await prisma.lead.create({
      data: {
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
      },
    })

    emit('success', 'search', `Business found: ${place.title}${place.rating ? ` (${place.rating}★ · ${place.reviews || 0} reviews)` : ''}${place.address ? ` — ${place.address}` : ''}`)

    totalFound++
    if (totalFound >= limit) break
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

    for (const res of organicResults) {
      if (!res.link || !res.title) continue

      const dedupeKey = `${res.title}|${res.link}`.toLowerCase()
      if (seenBusinesses.has(dedupeKey)) continue
      seenBusinesses.add(dedupeKey)

      const isExcluded = EXCLUDED_DOMAINS.some(d => res.link!.includes(d))
      if (isExcluded) continue

      await prisma.lead.create({
        data: {
          campaignId,
          schoolName: res.title,
          businessName: res.title,
          businessCategory: campaign.businessCategory,
          website: res.link,
          city: campaign.city,
          state: campaign.state,
          status: 'SCRAPED',
        },
      })

      emit('success', 'search', `Business found (web): ${res.title}`)
      totalFound++
      if (totalFound >= limit) break
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
