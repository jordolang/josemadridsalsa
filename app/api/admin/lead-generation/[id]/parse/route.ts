import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { connectBrowser } from '@/lib/scraper/browser'
import { eventBus } from '@/lib/scraper/event-bus'
import {
  STAFF_TITLE_PATTERNS,
  GENERIC_EMAIL_PREFIXES,
} from '@/lib/scraper/school-config'
import type { Browser, Page } from 'playwright'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const SITE_NAV_TIMEOUT = 10000
const SUBPAGE_NAV_TIMEOUT = 8000

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
  sport?: string
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi

const DIRECTORY_KEYWORDS = [
  'director', 'staff', 'facult', 'personnel',
  'contact', 'about', 'team', 'our-team',
  'administr', 'office', 'leader', 'manag',
  'coach', 'athlet',
  'owner', 'meet-the-team', 'people', 'employee',
  'roster', 'phone', 'email',
]

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function safePathname(url: string): string {
  try { return new URL(url).pathname } catch { return url }
}

const FAKE_EMAIL_DOMAIN_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|css|js|ico|woff|woff2|ttf|eot|mp4|mp3|pdf)$/i
const URL_ENCODING_ARTIFACTS = /u002f|%2f|%40|u0040/i

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_RE) || []
  return [...new Set(matches)]
    .map(e => e.toLowerCase())
    .filter(email => {
      if (GENERIC_EMAIL_PREFIXES.some(prefix => email.startsWith(prefix + '@'))) return false
      if (FAKE_EMAIL_DOMAIN_EXTENSIONS.test(email)) return false
      if (URL_ENCODING_ARTIFACTS.test(email)) return false
      const [local, domain] = email.split('@')
      if (!domain || !domain.includes('.')) return false
      if (local.length < 2 || domain.length < 4) return false
      if (email.includes('sentry.io')) return false
      return true
    })
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

  let requestLeadIds: string[] | undefined
  try {
    const body = await request.json()
    if (Array.isArray(body?.leadIds) && body.leadIds.length > 0) {
      requestLeadIds = body.leadIds
    }
  } catch {
    // No body or invalid JSON — parse all SCRAPED leads (backward compatible)
  }

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
        const leadWhere: Record<string, unknown> = {
          campaignId,
          status: 'SCRAPED',
          OR: [
            { schoolUrl: { not: null } },
            { website: { not: null } },
          ],
        }
        if (requestLeadIds) {
          leadWhere.id = { in: requestLeadIds }
        }

        const leads = await prisma.lead.findMany({ where: leadWhere })

        if (leads.length === 0) {
          emit('warn', 'parse', 'No scraped leads with URLs found. Run search first.')
          await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'PARSING_COMPLETED' } })
          controller.close()
          return
        }

        // Deduplicate by domain — no point visiting the same site 6 times
        const domainToLeads = new Map<string, typeof leads>()
        for (const lead of leads) {
          const url = lead.website || lead.schoolUrl
          if (!url) continue
          const domain = safeHostname(url)
          const existing = domainToLeads.get(domain) || []
          existing.push(lead)
          domainToLeads.set(domain, existing)
        }

        emit('info', 'parse', `Found ${leads.length} leads across ${domainToLeads.size} unique domains`)

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
            ? 'Browserless.io connection failed.'
            : 'No BROWSERLESS_TOKEN set. Add it to environment variables.')
          await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } })
          controller.close()
          return
        }

        emit('success', 'system', `Browser connected (${process.env.BROWSERLESS_TOKEN ? 'Browserless.io' : 'local'})`)

        let totalEmailsFound = campaign.totalEmailsFound || 0
        const startTime = Date.now()
        const maxRunTime = 240000
        let domainIndex = 0
        let consecutiveFailures = 0
        const MAX_CONSECUTIVE_FAILURES = 5

        for (const [domain, domainLeads] of domainToLeads) {
          if (Date.now() - startTime > maxRunTime) {
            emit('warn', 'system', `Time limit approaching. Stopping to save progress.`)
            break
          }

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            emit('error', 'system', `${MAX_CONSECUTIVE_FAILURES} consecutive domains failed — browser context may be dead. Stopping.`)
            break
          }

          domainIndex++
          const representativeUrl = domainLeads[0].website || domainLeads[0].schoolUrl!
          emit('info', 'parse', `[${domainIndex}/${domainToLeads.size}] Scanning ${domain} (${domainLeads.length} leads from this domain)`)

          let page: Page | null = null
          try {
            const context = await browser.newContext({
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              locale: 'en-US',
              timezoneId: 'America/New_York',
              viewport: { width: 1920, height: 1080 },
            })
            page = await context.newPage()

            // STEP 1: Visit the main page
            const mainNav = await page.goto(representativeUrl, { timeout: SITE_NAV_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null)
            if (!mainNav) {
              emit('warn', 'parse', `Could not load ${domain} — skipping`)
              consecutiveFailures++
              await context.close().catch(() => {})
              continue
            }
            consecutiveFailures = 0
            await page.waitForTimeout(1500)

            // STEP 2: Scan the main page for ALL links and categorize them
            emit('info', 'parse', `Scanning ${domain} main page for directory/staff links...`)

            const pageAnalysis = await page.evaluate((keywords: string[]) => {
              const allLinks: Array<{ href: string; text: string; score: number }> = []
              const allEmails: string[] = []

              // Extract emails from main page
              const bodyText = document.body?.textContent || ''
              const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
              const foundEmails = bodyText.match(emailRe) || []
              allEmails.push(...foundEmails)

              // Score every link on the page
              document.querySelectorAll('a[href]').forEach(el => {
                const a = el as HTMLAnchorElement
                const href = a.href
                if (!href || !href.startsWith('http')) return
                const hrefLower = href.toLowerCase()
                const textLower = (a.textContent || '').toLowerCase().trim()
                if (!textLower || textLower.length > 100) return

                let score = 0
                for (const kw of keywords) {
                  if (hrefLower.includes(kw)) score += 3
                  if (textLower.includes(kw)) score += 2
                }

                if (score > 0) {
                  allLinks.push({ href, text: textLower.substring(0, 60), score })
                }
              })

              // Sort by score descending, dedupe, take top 5
              const seen = new Set<string>()
              const topLinks = allLinks
                .sort((a, b) => b.score - a.score)
                .filter(l => {
                  if (seen.has(l.href)) return false
                  seen.add(l.href)
                  return true
                })
                .slice(0, 5)

              return { topLinks, mainPageEmails: [...new Set(allEmails)] }
            }, DIRECTORY_KEYWORDS)

            const mainEmails = extractEmails(pageAnalysis.mainPageEmails.join(' '))

            if (mainEmails.length > 0) {
              emit('info', 'parse', `Found ${mainEmails.length} emails on main page`)
            }

            if (pageAnalysis.topLinks.length > 0) {
              emit('info', 'parse', `Found ${pageAnalysis.topLinks.length} promising links: ${pageAnalysis.topLinks.map(l => `"${l.text}" (${safePathname(l.href)})`).join(', ')}`)
            } else {
              emit('info', 'parse', `No directory/staff links found on ${domain} main page`)
            }

            // STEP 3: Visit the best subpages and collect ALL emails
            const allFoundEmails = new Set<string>(mainEmails)
            const emailContexts = new Map<string, string>()

            // Store context for main page emails
            if (mainEmails.length > 0) {
              const mainHtml = await page.content()
              for (const email of mainEmails) {
                const idx = mainHtml.indexOf(email)
                if (idx >= 0) {
                  emailContexts.set(email, mainHtml.substring(Math.max(0, idx - 400), idx + email.length + 400))
                }
              }
            }

            // Visit each subpage
            for (const link of pageAnalysis.topLinks) {
              if (Date.now() - startTime > maxRunTime) break

              try {
                emit('info', 'parse', `  → Checking: "${link.text}" (${safePathname(link.href)})`)
                const subNav = await page.goto(link.href, { timeout: SUBPAGE_NAV_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null)
                if (!subNav) continue
                await page.waitForTimeout(1000)

                const subHtml = await page.content()
                const subEmails = extractEmails(subHtml)

                const newEmails = subEmails.filter(e => !allFoundEmails.has(e))
                if (newEmails.length > 0) {
                  emit('success', 'parse', `  ✓ Found ${newEmails.length} new emails on "${link.text}"`)
                  for (const email of newEmails) {
                    allFoundEmails.add(email)
                    const idx = subHtml.indexOf(email)
                    if (idx >= 0) {
                      emailContexts.set(email, subHtml.substring(Math.max(0, idx - 400), idx + email.length + 400))
                    }
                  }
                }
              } catch {
                emit('warn', 'parse', `  Could not load subpage: ${safePathname(link.href)}`)
              }
            }

            // STEP 4: Parse contacts from collected emails + context
            const contacts: ParsedContact[] = []
            for (const email of allFoundEmails) {
              const surrounding = emailContexts.get(email) || ''
              const contact = extractContactInfo(email, surrounding, campaign.leadType)
              contacts.push(contact)
            }

            emit('info', 'parse', `Total emails found on ${domain}: ${contacts.length}`)

            // STEP 5: Assign contacts to leads from this domain
            if (contacts.length > 0) {
              let contactIdx = 0
              for (const lead of domainLeads) {
                if (contactIdx >= contacts.length) break
                const c = contacts[contactIdx]

                await prisma.lead.update({
                  where: { id: lead.id },
                  data: {
                    contactName: c.name || null,
                    title: c.title || null,
                    email: c.email,
                    sport: c.sport || null,
                    status: 'CONTACT_FOUND',
                  },
                })

                const nameDisplay = c.name ? `${c.name} ` : ''
                emit('success', 'parse', `Contact assigned: ${nameDisplay}(${c.email})${c.title ? ` — ${c.title}` : ''} → ${lead.schoolName}`)
                totalEmailsFound++
                contactIdx++
              }

              // Create new leads for remaining contacts
              for (let j = contactIdx; j < contacts.length; j++) {
                const c = contacts[j]
                const refLead = domainLeads[0]
                await prisma.lead.create({
                  data: {
                    campaignId,
                    schoolName: refLead.schoolName,
                    schoolUrl: refLead.schoolUrl,
                    businessName: refLead.businessName,
                    website: refLead.website,
                    city: refLead.city,
                    state: refLead.state,
                    district: refLead.district,
                    contactName: c.name || null,
                    title: c.title || null,
                    email: c.email,
                    sport: c.sport || null,
                    status: 'CONTACT_FOUND',
                  },
                })
                emit('success', 'parse', `Extra contact: ${c.name || ''} (${c.email})`)
                totalEmailsFound++
              }
            } else {
              emit('info', 'parse', `No contacts found on ${domain}`)
            }

          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Parse error'
            emit('error', 'parse', `Error on ${domain}: ${msg}`)
            consecutiveFailures++
          } finally {
            if (page) {
              const ctx = page.context()
              await ctx.close().catch(() => {})
            }
          }
        }

        emit('success', 'parse', `Parsing complete — ${totalEmailsFound} contacts found across ${domainToLeads.size} domains`)

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

function extractContactInfo(email: string, surrounding: string, leadType: string): ParsedContact {
  let name = ''
  let title = ''
  let sport = ''

  if (leadType === 'SCHOOL_ATHLETICS') {
    for (const [sportKey, pattern] of Object.entries(STAFF_TITLE_PATTERNS)) {
      if (pattern.test(surrounding)) { sport = sportKey; break }
    }
    const titleMatch = surrounding.match(/(?:head\s+coach|assistant\s+coach|athletic\s+director|coach|coordinator)/i)
    if (titleMatch) title = titleMatch[0]
  } else if (leadType === 'LOCAL_SCHOOL') {
    const titlePatterns: [string, RegExp][] = [
      ['Principal', /principal|head\s+of\s+school|headmaster/i],
      ['Vice Principal', /vice\s+principal|assistant\s+principal|dean/i],
      ['Office Manager', /office\s+manager|school\s+secretary|administrative\s+assistant/i],
      ['Counselor', /counselor|guidance|advisor/i],
      ['Teacher', /teacher|instructor|educator/i],
    ]
    for (const [t, p] of titlePatterns) {
      if (p.test(surrounding)) { title = t; break }
    }
  } else {
    const titleMatch = surrounding.match(/(?:owner|manager|director|founder|ceo|president|partner|general\s+manager)/i)
    if (titleMatch) title = titleMatch[0]
  }

  // Try multiple name patterns
  const namePatterns = [
    /(?:coach|mr\.|mrs\.|ms\.|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*[-–—|,]\s*(?:coach|principal|director|teacher|manager|owner))/i,
    /(?:name|contact):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
  ]

  for (const pattern of namePatterns) {
    const match = surrounding.match(pattern)
    if (match) { name = match[1].trim(); break }
  }

  return { name, title, email, sport: sport || undefined }
}
