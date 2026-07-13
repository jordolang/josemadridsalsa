import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { connectBrowser, browserProviderName } from '@/lib/scraper/browser'
import { eventBus } from '@/lib/scraper/event-bus'
import { isUnlockerConfigured, fetchViaUnlocker } from '@/lib/scraper/brightdata'
import {
  STAFF_TITLE_PATTERNS,
} from '@/lib/scraper/school-config'
import { FUNDRAISER_TITLE_PATTERNS } from '@/lib/scraper/fundraiser-config'
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
  let skipLeadIds: string[] = []
  try {
    const body = await request.json()
    if (Array.isArray(body?.leadIds) && body.leadIds.length > 0) {
      requestLeadIds = body.leadIds
    }
    if (Array.isArray(body?.skipLeadIds)) {
      skipLeadIds = body.skipLeadIds.filter((id: unknown): id is string => typeof id === 'string')
    }
  } catch {
    // No body or invalid JSON — parse all SCRAPED leads (backward compatible)
  }
  const skipLeadSet = new Set(skipLeadIds)

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

      function emitErrorPause(leadName: string, domain: string, errorMessage: string) {
        try {
          const event = {
            type: 'error_pause',
            timestamp: new Date().toISOString(),
            leadName,
            domain,
            errorMessage,
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch { /* stream closed */ }
      }

      let browser: Browser | null = null
      const DOMAINS_PER_CONNECTION = 3

      async function reconnectBrowser(): Promise<Browser | null> {
        if (browser) {
          await browser.close().catch(() => {})
          browser = null
        }
        emit('info', 'system', 'Reconnecting to browser...')
        try {
          const b = await connectBrowser()
          emit('success', 'system', `Browser reconnected (${browserProviderName()})`)
          return b
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          emit('error', 'system', `Failed to reconnect: ${msg}`)
          return null
        }
      }

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
          emit('error', 'system', process.env.BROWSERLESS_TOKEN || process.env.BRIGHTDATA_BROWSER_URL
            ? `${browserProviderName()} connection failed.`
            : 'No BRIGHTDATA_BROWSER_URL or BROWSERLESS_TOKEN set. Add one to environment variables.')
          await prisma.leadCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } })
          controller.close()
          return
        }

        emit('success', 'system', `Browser connected (${browserProviderName()})`)

        let totalEmailsFound = campaign.totalEmailsFound || 0
        const startTime = Date.now()
        const maxRunTime = 240000
        let domainIndex = 0
        let consecutiveFailures = 0
        const MAX_CONSECUTIVE_FAILURES = 3

        for (const [domain, allDomainLeads] of domainToLeads) {
          // Filter out any leads the user asked to skip
          const domainLeads = allDomainLeads.filter(l => !skipLeadSet.has(l.id))
          if (domainLeads.length === 0) {
            emit('info', 'parse', `Skipping ${domain} — all leads marked for skip`)
            continue
          }

          if (Date.now() - startTime > maxRunTime) {
            emit('warn', 'system', `Time limit approaching. Stopping to save progress.`)
            break
          }

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            emit('error', 'system', `${MAX_CONSECUTIVE_FAILURES} consecutive domains failed — browser session may be dead. Stopping.`)
            break
          }

          // Reconnect browser every DOMAINS_PER_CONNECTION domains to avoid Browserless session death
          if (domainIndex > 0 && domainIndex % DOMAINS_PER_CONNECTION === 0) {
            emit('info', 'system', `Rotating browser connection after ${DOMAINS_PER_CONNECTION} domains...`)
            browser = await reconnectBrowser()
            if (!browser) {
              emit('error', 'system', 'Browser reconnect failed — stopping parser')
              break
            }
          }

          domainIndex++
          const representativeUrl = domainLeads[0].website || domainLeads[0].schoolUrl!
          const representativeName = domainLeads[0].schoolName || domainLeads[0].businessName || domain
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
            const mainNavError = await page.goto(representativeUrl, { timeout: SITE_NAV_TIMEOUT, waitUntil: 'domcontentloaded' })
              .then(() => null)
              .catch((err: unknown) => err instanceof Error ? err.message : String(err))
            if (mainNavError) {
              emit('warn', 'parse', `Could not load ${domain}: ${mainNavError}`)

              // Bright Data Web Unlocker rescue: the browser was blocked, but
              // the Unlocker can often still fetch the page HTML behind the
              // block. Try it before giving up on this domain.
              if (isUnlockerConfigured()) {
                emit('info', 'parse', `Retrying ${domain} via Bright Data Web Unlocker...`)
                const rescued = await unlockerRescue(representativeUrl).catch(() => new Map<string, string>())
                if (rescued.size > 0) {
                  const rescuedContacts: ParsedContact[] = []
                  for (const [email, surrounding] of rescued) {
                    rescuedContacts.push(extractContactInfo(email, surrounding, campaign.leadType))
                  }
                  emit('success', 'parse', `Web Unlocker recovered ${rescuedContacts.length} emails from ${domain}`)
                  totalEmailsFound += await persistDomainContacts(rescuedContacts, domainLeads, campaignId, emit)
                  consecutiveFailures = 0
                  await context.close().catch(() => {})
                  continue
                }
                emit('warn', 'parse', `Web Unlocker found no emails on ${domain}`)
              }

              emitErrorPause(representativeName, domain, mainNavError)
              consecutiveFailures++
              await context.close().catch(() => {})
              continue
            }
            consecutiveFailures = 0
            await page.waitForTimeout(2000)

            // STEP 2: Scan the main page for ALL links and categorize them
            emit('info', 'parse', `Scanning ${domain} main page for directory/staff links...`)

            const pageAnalysis = await page.evaluate((keywords: string[]) => {
              const allLinks: Array<{ href: string; text: string; score: number }> = []
              const allEmails: string[] = []

              // Extract emails from body text
              const bodyText = document.body?.textContent || ''
              const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
              const foundEmails = bodyText.match(emailRe) || []
              allEmails.push(...foundEmails)

              // Extract emails from mailto: href attributes (most reliable source)
              document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
                const href = el.getAttribute('href') || ''
                const mailtoEmail = href.replace(/^mailto:/i, '').split('?')[0].trim()
                if (mailtoEmail && mailtoEmail.includes('@')) allEmails.push(mailtoEmail)
              })

              // Score every link on the page
              document.querySelectorAll('a[href]').forEach(el => {
                const a = el as HTMLAnchorElement
                const href = a.href
                if (!href || !href.startsWith('http')) return
                const hrefLower = href.toLowerCase()
                const textLower = (a.textContent || '').toLowerCase().trim()

                let score = 0
                for (const kw of keywords) {
                  if (hrefLower.includes(kw)) score += 3
                  if (textLower.includes(kw)) score += 2
                }

                if (score > 0) {
                  allLinks.push({ href, text: textLower.substring(0, 80), score })
                }
              })

              // Sort by score descending, dedupe, take top 8
              const seen = new Set<string>()
              const topLinks = allLinks
                .sort((a, b) => b.score - a.score)
                .filter(l => {
                  if (seen.has(l.href)) return false
                  seen.add(l.href)
                  return true
                })
                .slice(0, 8)

              return { topLinks, mainPageEmails: [...new Set(allEmails)] }
            }, DIRECTORY_KEYWORDS)

            // Also extract from raw HTML to catch any remaining mailto:/obfuscated emails
            const mainPageHtml = await page.content()
            const mainEmails = [...new Set([
              ...extractEmails(pageAnalysis.mainPageEmails.join(' ')),
              ...extractEmails(mainPageHtml),
            ])]

            if (mainEmails.length > 0) {
              emit('info', 'parse', `Found ${mainEmails.length} emails on main page`)
            }

            if (pageAnalysis.topLinks.length > 0) {
              emit('info', 'parse', `Found ${pageAnalysis.topLinks.length} promising links: ${pageAnalysis.topLinks.map(l => `"${l.text || safePathname(l.href)}" (${safePathname(l.href)})`).join(', ')}`)
            } else {
              emit('info', 'parse', `No directory/staff links found on ${domain} main page`)
            }

            // STEP 3: Visit the best subpages and collect ALL emails
            const allFoundEmails = new Set<string>(mainEmails)
            const emailContexts = new Map<string, string>()

            // Store context for main page emails using already-fetched HTML
            for (const email of mainEmails) {
              const idx = mainPageHtml.indexOf(email)
              if (idx >= 0) {
                emailContexts.set(email, mainPageHtml.substring(Math.max(0, idx - 400), idx + email.length + 400))
              }
            }

            // Visit each subpage
            for (const link of pageAnalysis.topLinks) {
              if (Date.now() - startTime > maxRunTime) break

              try {
                emit('info', 'parse', `  → Checking: "${link.text || safePathname(link.href)}" (${safePathname(link.href)})`)
                const subNav = await page.goto(link.href, { timeout: SUBPAGE_NAV_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null)
                if (!subNav) continue
                await page.waitForTimeout(1500)

                const subHtml = await page.content()
                const subEmails = extractEmails(subHtml)

                const newEmails = subEmails.filter(e => !allFoundEmails.has(e))
                if (newEmails.length > 0) {
                  emit('success', 'parse', `  ✓ Found ${newEmails.length} new emails on "${link.text || safePathname(link.href)}"`)
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

            // STEP 3b: If no emails found yet, try common contact/staff paths directly
            if (allFoundEmails.size === 0) {
              const CONTACT_FALLBACK_PATHS = [
                '/contact', '/contact-us', '/about', '/about-us',
                '/staff', '/directory', '/team', '/our-team', '/people',
              ]
              let siteOrigin = ''
              try { siteOrigin = new URL(representativeUrl).origin } catch { /* skip */ }

              if (siteOrigin) {
                emit('info', 'parse', `No emails found via scoring — trying ${CONTACT_FALLBACK_PATHS.length} common paths on ${domain}`)
                for (const path of CONTACT_FALLBACK_PATHS) {
                  if (Date.now() - startTime > maxRunTime || allFoundEmails.size > 0) break
                  const fallbackUrl = `${siteOrigin}${path}`
                  try {
                    const fallbackNav = await page.goto(fallbackUrl, { timeout: SUBPAGE_NAV_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null)
                    if (!fallbackNav) continue
                    await page.waitForTimeout(1000)
                    const fallbackHtml = await page.content()
                    const fallbackEmails = extractEmails(fallbackHtml)
                    if (fallbackEmails.length > 0) {
                      emit('success', 'parse', `  ✓ Found ${fallbackEmails.length} emails at ${path}`)
                      for (const email of fallbackEmails) {
                        allFoundEmails.add(email)
                        const idx = fallbackHtml.indexOf(email)
                        if (idx >= 0) {
                          emailContexts.set(email, fallbackHtml.substring(Math.max(0, idx - 400), idx + email.length + 400))
                        }
                      }
                    }
                  } catch { /* skip this fallback path */ }
                }
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
              totalEmailsFound += await persistDomainContacts(contacts, domainLeads, campaignId, emit)
            } else {
              emit('info', 'parse', `No contacts found on ${domain}`)
            }

          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Parse error'
            emit('error', 'parse', `Error on ${domain}: ${msg}`)
            emitErrorPause(representativeName, domain, msg)
            consecutiveFailures++

            // If browser/context died, force a reconnect before the next domain
            if (/browser has been closed|target.*closed|context.*closed|websocket/i.test(msg)) {
              emit('warn', 'system', 'Detected dead browser session — will reconnect before next domain')
              if (browser) {
                await browser.close().catch(() => {})
                browser = null
              }
              const reconnected = await reconnectBrowser()
              if (!reconnected) {
                emit('error', 'system', 'Reconnect failed — stopping parser')
                break
              }
              browser = reconnected
              consecutiveFailures = 0
            }
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
  } else if (leadType === 'FUNDRAISER_ORG') {
    for (const [t, p] of FUNDRAISER_TITLE_PATTERNS) {
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

// Minimal shape of the leads we assign contacts to (subset of the Prisma Lead).
interface DomainLead {
  id: string
  schoolName: string
  schoolUrl: string | null
  businessName: string | null
  website: string | null
  city: string | null
  state: string | null
  district: string | null
}

/**
 * Assign parsed contacts to the leads sharing a domain: fill the existing leads
 * first, then spin up new leads for any surplus contacts. Returns how many
 * contacts were persisted so the caller can advance its running total.
 */
async function persistDomainContacts(
  contacts: ParsedContact[],
  domainLeads: DomainLead[],
  campaignId: string,
  emit: EmitFn,
): Promise<number> {
  let persisted = 0
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
    persisted++
    contactIdx++
  }

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
    persisted++
  }

  return persisted
}

/**
 * Fetch a site's main page plus common contact paths through the Bright Data
 * Web Unlocker and return a map of email → surrounding HTML (for title/name
 * inference). Used to rescue domains the headless browser cannot reach.
 */
async function unlockerRescue(representativeUrl: string): Promise<Map<string, string>> {
  const emailContexts = new Map<string, string>()

  let origin = ''
  try { origin = new URL(representativeUrl).origin } catch { /* keep only main url */ }

  const urls = [representativeUrl]
  if (origin) {
    for (const path of ['/contact', '/contact-us', '/about', '/staff', '/team', '/our-team']) {
      urls.push(`${origin}${path}`)
    }
  }

  for (const url of urls) {
    let html: string
    try {
      html = await fetchViaUnlocker(url)
    } catch {
      continue
    }
    for (const email of extractEmails(html)) {
      if (emailContexts.has(email)) continue
      const idx = html.indexOf(email)
      const surrounding = idx >= 0
        ? html.substring(Math.max(0, idx - 400), idx + email.length + 400)
        : ''
      emailContexts.set(email, surrounding)
    }
  }

  return emailContexts
}
