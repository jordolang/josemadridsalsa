import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { connectBrowser } from '@/lib/scraper/browser'
import { eventBus } from '@/lib/scraper/event-bus'
import {
  ATHLETICS_PAGE_KEYWORDS,
  STAFF_TITLE_PATTERNS,
  GENERIC_EMAIL_PREFIXES,
} from '@/lib/scraper/school-config'
import type { Browser, Page } from 'playwright'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const PER_SITE_TIMEOUT = 10000
const PER_SUBPAGE_TIMEOUT = 8000

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  stage: 'search' | 'parse' | 'email' | 'system'
  message: string
}

type EmitFn = (level: LogEntry['level'], stage: LogEntry['stage'], message: string) => void

interface ParsedContact {
  name: string
  title: string
  email: string
  phone?: string
  sport?: string
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi

const BUSINESS_CONTACT_KEYWORDS = [
  'contact', 'about', 'about-us', 'team', 'staff', 'our-team',
  'leadership', 'management', 'owners', 'owner',
]

const SCHOOL_ADMIN_KEYWORDS = [
  'staff', 'directory', 'administration', 'admin', 'office',
  'contact', 'our-team', 'leadership', 'about', 'faculty',
]

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function safePathname(url: string): string {
  try { return new URL(url).pathname } catch { return url }
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
          const entry: LogEntry = { timestamp: new Date().toISOString(), level, stage, message }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`))
        } catch { /* stream closed */ }
      }

      let browser: Browser | null = null

      try {
        const leads = await prisma.lead.findMany({
          where: {
            campaignId,
            status: 'SCRAPED',
            OR: [
              { schoolUrl: { not: null } },
              { website: { not: null } },
            ],
          },
        })

        if (leads.length === 0) {
          emit('warn', 'parse', 'No scraped leads with URLs found. Run search first.')
          await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'PARSING_COMPLETED' } })
          controller.close()
          return
        }

        emit('info', 'parse', `Found ${leads.length} leads to parse for contacts`)

        await prisma.leadCampaign.update({
          where: { id: campaignId },
          data: { status: 'PARSING_CONTACTS' },
        })

        eventBus.emit({
          type: 'campaign:status_changed',
          data: { campaignId, status: 'PARSING_CONTACTS', message: 'Started parsing contacts' },
        })

        emit('info', 'system', 'Connecting to browser for website parsing...')

        try {
          browser = await connectBrowser()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          emit('error', 'system', `Failed to connect to browser: ${msg}`)
          emit('error', 'system', process.env.BROWSERLESS_TOKEN
            ? 'Browserless.io connection failed. Check your BROWSERLESS_TOKEN.'
            : 'No BROWSERLESS_TOKEN set. Website parsing requires a browser. Add BROWSERLESS_TOKEN to your environment.')
          await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } })
          controller.close()
          return
        }

        emit('success', 'system', `Browser connected (${process.env.BROWSERLESS_TOKEN ? 'Browserless.io' : 'local'})`)

        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/New_York',
          viewport: { width: 1920, height: 1080 },
        })
        const page = await context.newPage()

        let totalEmailsFound = campaign.totalEmailsFound || 0
        const startTime = Date.now()
        const maxRunTime = 250000

        for (let i = 0; i < leads.length; i++) {
          if (Date.now() - startTime > maxRunTime) {
            emit('warn', 'system', `Time limit approaching (${Math.round((Date.now() - startTime) / 1000)}s). Stopping to save progress.`)
            break
          }

          const lead = leads[i]
          const siteUrl = lead.website || lead.schoolUrl
          if (!siteUrl) continue

          emit('info', 'parse', `[${i + 1}/${leads.length}] Visiting: ${safeHostname(siteUrl)}`)

          try {
            const navResult = await page.goto(siteUrl, { timeout: PER_SITE_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null)

            if (!navResult) {
              emit('warn', 'parse', `Could not load ${safeHostname(siteUrl)} (timeout or error)`)
              continue
            }

            await page.waitForTimeout(1500)

            let contacts: ParsedContact[] = []

            if (campaign.leadType === 'LOCAL_BUSINESS') {
              contacts = await parseBusinessContacts(page, siteUrl, emit)
            } else if (campaign.leadType === 'LOCAL_SCHOOL') {
              contacts = await parseSchoolAdminContacts(page, siteUrl, emit)
            } else {
              contacts = await parseAthleticsContacts(page, siteUrl, emit)
            }

            if (contacts.length > 0) {
              const first = contacts[0]
              await prisma.lead.update({
                where: { id: lead.id },
                data: {
                  contactName: first.name || null,
                  title: first.title || null,
                  email: first.email,
                  sport: first.sport || null,
                  status: 'CONTACT_FOUND',
                },
              })

              const nameDisplay = first.name ? `${first.name} ` : ''
              emit('success', 'parse', `Contact: ${nameDisplay}(${first.email})${first.title ? ` — ${first.title}` : ''}`)
              totalEmailsFound++

              for (let j = 1; j < contacts.length; j++) {
                const c = contacts[j]
                await prisma.lead.create({
                  data: {
                    campaignId,
                    schoolName: lead.schoolName,
                    schoolUrl: lead.schoolUrl,
                    businessName: lead.businessName,
                    website: lead.website,
                    city: lead.city,
                    state: lead.state,
                    district: lead.district,
                    contactName: c.name || null,
                    title: c.title || null,
                    email: c.email,
                    sport: c.sport || null,
                    status: 'CONTACT_FOUND',
                  },
                })
                emit('success', 'parse', `Additional: ${c.name || ''} (${c.email})`)
                totalEmailsFound++
              }
            } else {
              emit('info', 'parse', `No contacts on ${safeHostname(siteUrl)}`)
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Parse error'
            emit('error', 'parse', `Error on ${safeHostname(siteUrl)}: ${msg}`)
            await prisma.lead.update({
              where: { id: lead.id },
              data: { errorMessage: msg },
            }).catch(() => {})
          }
        }

        emit('success', 'parse', `Parsing complete — ${totalEmailsFound} contacts found across ${leads.length} leads`)

        await prisma.leadCampaign.update({
          where: { id: campaignId },
          data: { status: 'PARSING_COMPLETED', totalEmailsFound },
        })

        eventBus.emit({
          type: 'campaign:status_changed',
          data: { campaignId, status: 'PARSING_COMPLETED', message: `Completed parsing ${totalEmailsFound} emails` },
        })

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        emit('error', 'system', `Parser crashed: ${msg}`)
        await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } }).catch(() => {})
      } finally {
        if (browser) {
          emit('info', 'system', 'Closing browser...')
          await browser.close().catch(() => {})
          emit('info', 'system', 'Browser closed.')
        }
        emit('info', 'system', 'Parse session ended.')
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

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_PATTERN) || []
  return [...new Set(matches)].filter(
    email => !GENERIC_EMAIL_PREFIXES.some(prefix => email.toLowerCase().startsWith(prefix + '@'))
  )
}

async function findTargetPages(page: Page, keywords: string[], emit: EmitFn): Promise<string[]> {
  const links = await page.evaluate((kws: string[]) => {
    const results: string[] = []
    document.querySelectorAll('a[href]').forEach(el => {
      const a = el as HTMLAnchorElement
      const href = a.href
      if (!href.startsWith('http')) return
      const lower = href.toLowerCase()
      const text = (a.textContent || '').toLowerCase()
      if (kws.some(kw => lower.includes(kw) || text.includes(kw))) {
        results.push(href)
      }
    })
    return [...new Set(results)].slice(0, 3)
  }, keywords)

  if (links.length > 0) {
    emit('info', 'parse', `Found ${links.length} subpages: ${links.map(l => safePathname(l)).join(', ')}`)
  }

  return links
}

async function visitAndExtractEmails(page: Page, url: string, seenEmails: Set<string>, emit: EmitFn): Promise<{ email: string; surrounding: string }[]> {
  try {
    const navResult = await page.goto(url, { timeout: PER_SUBPAGE_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null)
    if (!navResult) return []
    await page.waitForTimeout(1000)
  } catch {
    return []
  }

  const html = await page.content()
  const emails = extractEmails(html)
  const results: { email: string; surrounding: string }[] = []

  for (const email of emails) {
    if (seenEmails.has(email)) continue
    seenEmails.add(email)

    const idx = html.indexOf(email)
    const surrounding = html.substring(Math.max(0, idx - 300), idx + email.length + 300)
    results.push({ email, surrounding })
  }

  return results
}

async function parseAthleticsContacts(page: Page, siteUrl: string, emit: EmitFn): Promise<ParsedContact[]> {
  const contacts: ParsedContact[] = []
  const seenEmails = new Set<string>()

  const html = await page.content()
  const mainEmails = extractEmails(html)

  for (const email of mainEmails) {
    if (seenEmails.has(email)) continue
    seenEmails.add(email)

    const idx = html.indexOf(email)
    const surrounding = html.substring(Math.max(0, idx - 200), idx + email.length + 200)

    let sport = ''
    for (const [sportKey, pattern] of Object.entries(STAFF_TITLE_PATTERNS)) {
      if (pattern.test(surrounding)) { sport = sportKey; break }
    }

    const nameMatch = surrounding.match(/(?:coach|mr\.|mrs\.|ms\.|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
    const titleMatch = surrounding.match(/(?:head\s+coach|assistant\s+coach|athletic\s+director|coach)/i)

    contacts.push({
      name: nameMatch ? nameMatch[1] : '',
      title: titleMatch ? titleMatch[0] : '',
      email,
      sport,
    })
  }

  const subpageLinks = await findTargetPages(page, ATHLETICS_PAGE_KEYWORDS, emit)

  for (const link of subpageLinks) {
    const found = await visitAndExtractEmails(page, link, seenEmails, emit)

    for (const { email, surrounding } of found) {
      let sport = ''
      for (const [sportKey, pattern] of Object.entries(STAFF_TITLE_PATTERNS)) {
        if (pattern.test(surrounding)) { sport = sportKey; break }
      }
      const nameMatch = surrounding.match(/(?:coach|mr\.|mrs\.|ms\.|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
      const titleMatch = surrounding.match(/(?:head\s+coach|assistant\s+coach|athletic\s+director|coach)/i)

      contacts.push({
        name: nameMatch ? nameMatch[1] : '',
        title: titleMatch ? titleMatch[0] : '',
        email,
        sport,
      })
    }
  }

  return contacts
}

async function parseSchoolAdminContacts(page: Page, siteUrl: string, emit: EmitFn): Promise<ParsedContact[]> {
  const contacts: ParsedContact[] = []
  const seenEmails = new Set<string>()

  const html = await page.content()
  for (const email of extractEmails(html)) {
    if (seenEmails.has(email)) continue
    seenEmails.add(email)
    const idx = html.indexOf(email)
    const surrounding = html.substring(Math.max(0, idx - 300), idx + email.length + 300)

    let title = ''
    const titlePatterns: Record<string, RegExp> = {
      Principal: /principal|head\s+of\s+school/i,
      'Vice Principal': /vice\s+principal|assistant\s+principal|dean/i,
      'Office Manager': /office\s+manager|school\s+secretary|administrative\s+assistant/i,
    }
    for (const [t, p] of Object.entries(titlePatterns)) {
      if (p.test(surrounding)) { title = t; break }
    }
    const nameMatch = surrounding.match(/(?:mr\.|mrs\.|ms\.|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
    contacts.push({ name: nameMatch ? nameMatch[1] : '', title, email })
  }

  const subpageLinks = await findTargetPages(page, SCHOOL_ADMIN_KEYWORDS, emit)

  for (const link of subpageLinks) {
    const found = await visitAndExtractEmails(page, link, seenEmails, emit)
    for (const { email, surrounding } of found) {
      let title = ''
      const titlePatterns: Record<string, RegExp> = {
        Principal: /principal|head\s+of\s+school/i,
        'Vice Principal': /vice\s+principal|assistant\s+principal|dean/i,
        'Office Manager': /office\s+manager|school\s+secretary|administrative\s+assistant/i,
      }
      for (const [t, p] of Object.entries(titlePatterns)) {
        if (p.test(surrounding)) { title = t; break }
      }
      const nameMatch = surrounding.match(/(?:mr\.|mrs\.|ms\.|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
      contacts.push({ name: nameMatch ? nameMatch[1] : '', title, email })
    }
  }

  return contacts
}

async function parseBusinessContacts(page: Page, siteUrl: string, emit: EmitFn): Promise<ParsedContact[]> {
  const contacts: ParsedContact[] = []
  const seenEmails = new Set<string>()

  const html = await page.content()
  for (const email of extractEmails(html)) {
    if (seenEmails.has(email)) continue
    seenEmails.add(email)
    const idx = html.indexOf(email)
    const surrounding = html.substring(Math.max(0, idx - 300), idx + email.length + 300)
    const titleMatch = surrounding.match(/(?:owner|manager|director|founder|ceo|president|partner|general\s+manager)/i)
    const nameMatch = surrounding.match(/(?:mr\.|mrs\.|ms\.|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
    contacts.push({ name: nameMatch ? nameMatch[1] : '', title: titleMatch ? titleMatch[0] : '', email })
  }

  const subpageLinks = await findTargetPages(page, BUSINESS_CONTACT_KEYWORDS, emit)

  for (const link of subpageLinks) {
    const found = await visitAndExtractEmails(page, link, seenEmails, emit)
    for (const { email, surrounding } of found) {
      const titleMatch = surrounding.match(/(?:owner|manager|director|founder|ceo|president|partner|general\s+manager)/i)
      const nameMatch = surrounding.match(/(?:mr\.|mrs\.|ms\.|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
      contacts.push({ name: nameMatch ? nameMatch[1] : '', title: titleMatch ? titleMatch[0] : '', email })
    }
  }

  return contacts
}
