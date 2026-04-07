import { chromium, Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import {
  ATHLETICS_PAGE_KEYWORDS,
  STAFF_TITLE_PATTERNS,
  GENERIC_EMAIL_PREFIXES,
  PAGE_LOAD_TIMEOUT,
} from './school-config';
import { emitScraperEvent } from './scraper-events';

export async function runWebsiteParser(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error('Campaign not found');

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'PARSING_CONTACTS' },
  });

  const leads = await prisma.lead.findMany({
    where: { campaignId, status: 'SCRAPED', schoolUrl: { not: null } },
  });

  emitScraperEvent(
    campaignId,
    'info',
    'parse',
    `Website parser started: ${leads.length} schools to scan`
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const emailPattern =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

  let totalEmailsFound = campaign.totalEmailsFound || 0;

  try {
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (!lead.schoolUrl) continue;

      emitScraperEvent(
        campaignId,
        'info',
        'parse',
        `[${i + 1}/${leads.length}] Scanning: ${lead.schoolName}`,
        lead.schoolUrl
      );

      const page = await context.newPage();
      const contactsFound: Array<{
        name: string;
        title: string;
        email: string;
        sport?: string;
      }> = [];

      try {
        const navResult = await page
          .goto(lead.schoolUrl, {
            timeout: PAGE_LOAD_TIMEOUT,
            waitUntil: 'domcontentloaded',
          })
          .catch(() => null);

        if (!navResult) {
          emitScraperEvent(
            campaignId,
            'warn',
            'parse',
            `Failed to load: ${lead.schoolName}`,
            lead.schoolUrl
          );
          await prisma.lead.update({
            where: { id: lead.id },
            data: { errorMessage: 'Page failed to load' },
          });
          await page.close();
          continue;
        }

        await page.waitForTimeout(2000);

        // Find athletics/staff directory links
        const links = await page.$$eval('a', (els) =>
          els.map((a) => ({
            href: (a as HTMLAnchorElement).href,
            text: a.textContent || '',
          }))
        );

        const targetUrls = new Set<string>();
        for (const l of links) {
          const textMatches = ATHLETICS_PAGE_KEYWORDS.some((k) =>
            l.text.toLowerCase().includes(k)
          );
          const hrefMatches = ATHLETICS_PAGE_KEYWORDS.some((k) =>
            l.href.toLowerCase().includes(k)
          );
          if ((textMatches || hrefMatches) && l.href.startsWith('http')) {
            targetUrls.add(l.href);
          }
        }

        // If no explicit athletics page, scan the homepage
        if (targetUrls.size === 0) {
          targetUrls.add(lead.schoolUrl);
        }

        const urlsToScan = Array.from(targetUrls).slice(0, 3);
        emitScraperEvent(
          campaignId,
          'info',
          'parse',
          `Found ${urlsToScan.length} page(s) to scan on ${lead.schoolName}`
        );

        for (const url of urlsToScan) {
          if (url !== lead.schoolUrl) {
            await page
              .goto(url, {
                timeout: PAGE_LOAD_TIMEOUT,
                waitUntil: 'domcontentloaded',
              })
              .catch(() => null);
            await page.waitForTimeout(2000);
          }

          // Extract page text via Playwright's page.evaluate (safe Playwright API, not eval)
          const pageText = await page.textContent('body') || '';
          const htmlContent = await page.content();

          const emails = Array.from(htmlContent.matchAll(emailPattern)).map(
            (m) => m[0].toLowerCase()
          );
          const validEmails = [...new Set(emails)].filter((e) => {
            return (
              !GENERIC_EMAIL_PREFIXES.some((prefix) =>
                e.startsWith(prefix)
              ) &&
              !e.includes('sentry.io') &&
              !e.match(/\.(png|jpg|jpeg|gif|webp)$/i)
            );
          });

          if (validEmails.length > 0) {
            emitScraperEvent(
              campaignId,
              'info',
              'parse',
              `Found ${validEmails.length} email(s) on ${url}`
            );
          }

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
              } else if (
                STAFF_TITLE_PATTERNS.head_coach.test(contextStr)
              ) {
                title = 'Head Coach';
              } else if (
                STAFF_TITLE_PATTERNS.assistant_coach.test(contextStr)
              ) {
                title = 'Assistant Coach';
              }

              const sports = [
                'football',
                'basketball',
                'baseball',
                'softball',
                'soccer',
                'volleyball',
                'track',
                'wrestling',
                'cheer',
              ];
              for (const s of sports) {
                if (contextStr.includes(s)) {
                  sport = s.charAt(0).toUpperCase() + s.slice(1);
                  break;
                }
              }
            }

            if (!contactsFound.some((c) => c.email === email)) {
              contactsFound.push({ name, title, email, sport });
            }
          }
        }

        if (contactsFound.length > 0) {
          const firstContact = contactsFound[0];
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              contactName: firstContact.name,
              title: firstContact.title,
              email: firstContact.email,
              sport: firstContact.sport,
              status: 'CONTACT_FOUND',
            },
          });
          totalEmailsFound++;

          for (let j = 1; j < contactsFound.length; j++) {
            const contact = contactsFound[j];
            await prisma.lead.create({
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
                sport: contact.sport,
                status: 'CONTACT_FOUND',
              },
            });
            totalEmailsFound++;
          }

          emitScraperEvent(
            campaignId,
            'success',
            'parse',
            `${lead.schoolName}: ${contactsFound.length} contact(s) found`,
            contactsFound.map((c) => `${c.email} (${c.title})`).join(', ')
          );
        } else {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { errorMessage: 'No valid athletic contacts found' },
          });
          emitScraperEvent(
            campaignId,
            'warn',
            'parse',
            `${lead.schoolName}: no contacts found`
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Website parsing error';
        emitScraperEvent(
          campaignId,
          'error',
          'parse',
          `Error parsing ${lead.schoolName}: ${message}`
        );
        await prisma.lead.update({
          where: { id: lead.id },
          data: { errorMessage: message },
        });
      } finally {
        await page.close();
      }
    }

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'PARSING_COMPLETED', totalEmailsFound },
    });

    emitScraperEvent(
      campaignId,
      'success',
      'parse',
      `Parsing complete: ${totalEmailsFound} total emails found`
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    emitScraperEvent(
      campaignId,
      'error',
      'parse',
      `Website parser failed: ${message}`
    );
    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    });
  } finally {
    await browser.close();
  }
}
