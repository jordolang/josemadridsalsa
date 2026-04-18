import { chromium, Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import { eventBus } from './event-bus';
import {
  ATHLETICS_PAGE_KEYWORDS,
  STAFF_TITLE_PATTERNS,
  GENERIC_EMAIL_PREFIXES,
  PAGE_LOAD_TIMEOUT
} from './school-config';

interface ParsedContact {
  name: string;
  title: string;
  email: string;
  phone?: string;
  sport?: string;
}

const BUSINESS_CONTACT_KEYWORDS = [
  'contact', 'about', 'about-us', 'team', 'staff', 'our-team', 'meet-the-team',
  'leadership', 'management', 'owners', 'owner',
];

const SCHOOL_ADMIN_KEYWORDS = [
  'staff', 'directory', 'administration', 'admin', 'office', 'contact',
  'our-team', 'leadership', 'about', 'faculty',
];

const SCHOOL_ADMIN_TITLE_PATTERNS: Record<string, RegExp> = {
  principal: /(?:principal|head\s+of\s+school|headmaster|headmistress)/i,
  vice_principal: /(?:vice\s+principal|assistant\s+principal|dean)/i,
  office_manager: /(?:office\s+manager|school\s+secretary|front\s+office|administrative\s+assistant)/i,
  counselor: /(?:counselor|guidance|advisor)/i,
};

export async function runWebsiteParser(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'PARSING_CONTACTS' }
  });

  // Emit status change
  eventBus.emit({
    type: 'campaign:status_changed',
    data: {
      campaignId,
      status: 'PARSING_CONTACTS',
      message: 'Started parsing contact information'
    }
  });

  const leads = await prisma.lead.findMany({
    where: {
      campaignId,
      status: 'SCRAPED',
      OR: [
        { schoolUrl: { not: null } },
        { website: { not: null } },
      ],
    },
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ig;

  let totalEmailsFound = campaign.totalEmailsFound || 0;

  try {
    for (const lead of leads) {
      if (!lead.schoolUrl && !lead.website) continue;
      
      const page = await context.newPage();
      let contactsFound: ParsedContact[] = [];
      const siteUrl = lead.website || lead.schoolUrl;

      try {
        await page.goto(siteUrl!, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null);
        await page.waitForTimeout(2000);

        if (campaign.leadType === 'LOCAL_BUSINESS') {
          contactsFound = await parseBusinessContacts(page, siteUrl!, emailPattern);
        } else if (campaign.leadType === 'LOCAL_SCHOOL') {
          contactsFound = await parseSchoolAdminContacts(page, siteUrl!, emailPattern);
        } else {
          contactsFound = await parseAthleticsContacts(page, siteUrl!, emailPattern);
        }

        if (contactsFound.length > 0) {
          // Update the existing lead with the first contact
          const firstContact = contactsFound[0];
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              contactName: firstContact.name,
              title: firstContact.title,
              email: firstContact.email,
              phone: firstContact.phone ?? null,
              sport: firstContact.sport,
              status: 'CONTACT_FOUND'
            }
          });

          // Emit contact parsed event
          eventBus.emit({
            type: 'lead:contact_parsed',
            data: {
              campaignId,
              leadId: lead.id,
              contact: {
                email: firstContact.email,
                phone: firstContact.phone,
                contactName: firstContact.name,
                title: firstContact.title,
                sport: firstContact.sport
              }
            }
          });

          totalEmailsFound++;

          // Create new leads for the remaining contacts
          for (let i = 1; i < contactsFound.length; i++) {
            const contact = contactsFound[i];
            const newLead = await prisma.lead.create({
              data: {
                campaignId: lead.campaignId,
                schoolName: lead.schoolName,
                schoolUrl: lead.schoolUrl,
                city: lead.city,
                state: lead.state,
                district: lead.district,
                contactName: contact.name,
                title: contact.title,
                email: contact.email,
                phone: contact.phone ?? null,
                sport: contact.sport,
                status: 'CONTACT_FOUND'
              }
            });

            // Emit contact parsed event for new lead
            eventBus.emit({
              type: 'lead:contact_parsed',
              data: {
                campaignId,
                leadId: newLead.id,
                contact: {
                  email: contact.email,
                  phone: contact.phone,
                  contactName: contact.name,
                  title: contact.title,
                  sport: contact.sport
                }
              }
            });

            totalEmailsFound++;
          }
        } else {
          const noContactMessages: Record<string, string> = {
            LOCAL_BUSINESS: 'No valid business contacts found',
            LOCAL_SCHOOL: 'No valid school admin contacts found',
            SCHOOL_ATHLETICS: 'No valid athletic contacts found',
          };
          await prisma.lead.update({
             where: { id: lead.id },
             data: { errorMessage: noContactMessages[campaign.leadType] || 'No contacts found' }
          });
        }

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Website parsing error';
        eventBus.emit({
          type: 'campaign:error',
          data: { campaignId, error: `Error parsing ${siteUrl}: ${errMsg}`, step: 'parse' },
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { errorMessage: errMsg }
        });
      } finally {
        await page.close();
      }
    }

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'PARSING_COMPLETED', totalEmailsFound }
    });

    // Emit completion event
    eventBus.emit({
      type: 'campaign:status_changed',
      data: {
        campaignId,
        status: 'PARSING_COMPLETED',
        message: `Completed parsing ${totalEmailsFound} emails`
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' }
    });

    // Emit error event
    eventBus.emit({
      type: 'campaign:error',
      data: {
        campaignId,
        error: errorMessage,
        step: 'parse'
      }
    });
  } finally {
    await browser.close();
  }
}

function extractValidEmails(
  htmlContent: string,
  emailPattern: RegExp
): string[] {
  const emails = Array.from(htmlContent.matchAll(emailPattern)).map((m) =>
    m[0].toLowerCase()
  );
  return [...new Set(emails)].filter(
    (e) =>
      !GENERIC_EMAIL_PREFIXES.some((prefix) => e.startsWith(prefix)) &&
      !e.includes('sentry.io') &&
      !e.match(/\.(png|jpg|jpeg|gif|webp)$/i)
  );
}

function findTargetPages(
  links: Array<{ href: string; text: string }>,
  keywords: string[],
  fallbackUrl: string
): string[] {
  const targetUrls = new Set<string>();
  for (const l of links) {
    const textMatches = keywords.some((k) =>
      l.text.toLowerCase().includes(k)
    );
    const hrefMatches = keywords.some((k) =>
      l.href.toLowerCase().includes(k)
    );
    if ((textMatches || hrefMatches) && l.href.startsWith('http')) {
      targetUrls.add(l.href);
    }
  }
  if (targetUrls.size === 0) {
    targetUrls.add(fallbackUrl);
  }
  return Array.from(targetUrls).slice(0, 3);
}

async function getPageContent(page: Page): Promise<{ pageText: string; htmlContent: string }> {
  const pageText = await page.innerText('body').catch(() => '');
  const htmlContent = await page.content();
  return { pageText, htmlContent };
}

async function parseAthleticsContacts(
  page: Page,
  siteUrl: string,
  emailPattern: RegExp
): Promise<ParsedContact[]> {
  const contacts: ParsedContact[] = [];
  const links = await page.$$eval('a', (els) =>
    els.map((a) => ({
      href: (a as HTMLAnchorElement).href,
      text: a.textContent || '',
    }))
  );

  const urlsToScan = findTargetPages(links, ATHLETICS_PAGE_KEYWORDS, siteUrl);

  for (const url of urlsToScan) {
    if (url !== siteUrl) {
      await page
        .goto(url, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: 'domcontentloaded' })
        .catch(() => null);
      await page.waitForTimeout(2000);
    }

    const { pageText, htmlContent } = await getPageContent(page);
    const validEmails = extractValidEmails(htmlContent, emailPattern);

    for (const email of validEmails) {
      const emailIndex = pageText.toLowerCase().indexOf(email);
      let title = 'Athletic Staff';
      let name = 'Coach / Director';
      let sport = '';

      if (emailIndex !== -1) {
        const contextStr = pageText
          .substring(
            Math.max(0, emailIndex - 200),
            Math.min(pageText.length, emailIndex + 200)
          )
          .toLowerCase();

        if (STAFF_TITLE_PATTERNS.athletic_director.test(contextStr)) {
          title = 'Athletic Director';
        } else if (STAFF_TITLE_PATTERNS.head_coach.test(contextStr)) {
          title = 'Head Coach';
        } else if (STAFF_TITLE_PATTERNS.assistant_coach.test(contextStr)) {
          title = 'Assistant Coach';
        }

        const sports = [
          'football', 'basketball', 'baseball', 'softball', 'soccer',
          'volleyball', 'track', 'wrestling', 'cheer',
        ];
        for (const s of sports) {
          if (contextStr.includes(s)) {
            sport = s.charAt(0).toUpperCase() + s.slice(1);
            break;
          }
        }
      }

      if (!contacts.some((c) => c.email === email)) {
        contacts.push({ name, title, email, sport });
      }
    }
  }

  return contacts;
}

async function parseBusinessContacts(
  page: Page,
  siteUrl: string,
  emailPattern: RegExp
): Promise<ParsedContact[]> {
  const contacts: ParsedContact[] = [];
  const links = await page.$$eval('a', (els) =>
    els.map((a) => ({
      href: (a as HTMLAnchorElement).href,
      text: a.textContent || '',
    }))
  );

  const urlsToScan = findTargetPages(links, BUSINESS_CONTACT_KEYWORDS, siteUrl);

  for (const url of urlsToScan) {
    if (url !== siteUrl) {
      await page
        .goto(url, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: 'domcontentloaded' })
        .catch(() => null);
      await page.waitForTimeout(2000);
    }

    const { pageText, htmlContent } = await getPageContent(page);
    const validEmails = extractValidEmails(htmlContent, emailPattern);

    const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = Array.from(pageText.matchAll(phonePattern)).map((m) => m[0]);

    for (const email of validEmails) {
      const emailIndex = pageText.toLowerCase().indexOf(email);
      let title = 'Business Contact';
      let name = 'Owner / Manager';
      let phone = phones[0] || '';

      if (emailIndex !== -1) {
        const contextStr = pageText
          .substring(
            Math.max(0, emailIndex - 300),
            Math.min(pageText.length, emailIndex + 300)
          )
          .toLowerCase();

        if (/(?:owner|founder|ceo|president)/i.test(contextStr)) {
          title = 'Owner';
        } else if (/(?:manager|general\s+manager|gm)/i.test(contextStr)) {
          title = 'Manager';
        } else if (/(?:director|vp|vice\s+president)/i.test(contextStr)) {
          title = 'Director';
        }

        const localPhone = contextStr.match(
          /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
        );
        if (localPhone) phone = localPhone[0];
      }

      if (!contacts.some((c) => c.email === email)) {
        contacts.push({ name, title, email, phone });
      }
    }
  }

  return contacts;
}

async function parseSchoolAdminContacts(
  page: Page,
  siteUrl: string,
  emailPattern: RegExp
): Promise<ParsedContact[]> {
  const contacts: ParsedContact[] = [];
  const links = await page.$$eval('a', (els) =>
    els.map((a) => ({
      href: (a as HTMLAnchorElement).href,
      text: a.textContent || '',
    }))
  );

  const urlsToScan = findTargetPages(links, SCHOOL_ADMIN_KEYWORDS, siteUrl);

  for (const url of urlsToScan) {
    if (url !== siteUrl) {
      await page
        .goto(url, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: 'domcontentloaded' })
        .catch(() => null);
      await page.waitForTimeout(2000);
    }

    const { pageText, htmlContent } = await getPageContent(page);
    const validEmails = extractValidEmails(htmlContent, emailPattern);

    const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = Array.from(pageText.matchAll(phonePattern)).map((m) => m[0]);

    for (const email of validEmails) {
      const emailIndex = pageText.toLowerCase().indexOf(email);
      let title = 'School Staff';
      let name = 'Administrator';
      let phone = phones[0] || '';

      if (emailIndex !== -1) {
        const contextStr = pageText
          .substring(
            Math.max(0, emailIndex - 300),
            Math.min(pageText.length, emailIndex + 300)
          )
          .toLowerCase();

        if (SCHOOL_ADMIN_TITLE_PATTERNS.principal.test(contextStr)) {
          title = 'Principal';
        } else if (SCHOOL_ADMIN_TITLE_PATTERNS.vice_principal.test(contextStr)) {
          title = 'Vice Principal';
        } else if (SCHOOL_ADMIN_TITLE_PATTERNS.office_manager.test(contextStr)) {
          title = 'Office Manager';
        } else if (SCHOOL_ADMIN_TITLE_PATTERNS.counselor.test(contextStr)) {
          title = 'Counselor';
        }

        const localPhone = contextStr.match(
          /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
        );
        if (localPhone) phone = localPhone[0];
      }

      if (!contacts.some((c) => c.email === email)) {
        contacts.push({ name, title, email, phone });
      }
    }
  }

  return contacts;
}
