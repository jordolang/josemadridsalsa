import { chromium, Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import { eventBus } from './event-bus';
import {
  ATHLETICS_PAGE_KEYWORDS,
  STAFF_TITLE_PATTERNS,
  GENERIC_EMAIL_PREFIXES,
  PAGE_LOAD_TIMEOUT
} from './school-config';

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
    where: { campaignId, status: 'SCRAPED', schoolUrl: { not: null } }
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ig;

  let totalEmailsFound = campaign.totalEmailsFound || 0;

  try {
    for (const lead of leads) {
      if (!lead.schoolUrl) continue;
      
      const page = await context.newPage();
      let contactsFound: Array<{ name: string, title: string, email: string, sport?: string }> = [];
      
      try {
        await page.goto(lead.schoolUrl, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null);
        await page.waitForTimeout(2000);

        // Find athletics/staff directory links
        const links = await page.$$eval('a', els => els.map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent || '' })));
        
        let targetUrls = new Set<string>();
        for (const l of links) {
           const textMatches = ATHLETICS_PAGE_KEYWORDS.some(k => l.text.toLowerCase().includes(k));
           const hrefMatches = ATHLETICS_PAGE_KEYWORDS.some(k => l.href.toLowerCase().includes(k));
           if ((textMatches || hrefMatches) && l.href.startsWith('http')) {
             targetUrls.add(l.href);
           }
        }

        // If no explicit athletics page, maybe scan the homepage
        if (targetUrls.size === 0) {
           targetUrls.add(lead.schoolUrl);
        }

        const urlsToScan = Array.from(targetUrls).slice(0, 3); // Check up to 3 likely pages

        for (const url of urlsToScan) {
           if (url !== lead.schoolUrl) {
              await page.goto(url, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null);
              await page.waitForTimeout(2000);
           }

           // Basic parsing logic: Look for text nodes that might have titles and emails nearby
           const pageText = await page.evaluate(() => document.body.innerText || '');
           const htmlContent = await page.content();

           const emails = Array.from(htmlContent.matchAll(emailPattern)).map(m => m[0].toLowerCase());
           const validEmails = [...new Set(emails)].filter(e => {
             return !GENERIC_EMAIL_PREFIXES.some(prefix => e.startsWith(prefix)) &&
                    !e.includes('sentry.io') && 
                    !e.match(/\.(png|jpg|jpeg|gif|webp)$/i);
           });

           // VERY simplified association: if we see an email, we guess the title from surrounding text.
           // A real implementation would parse DOM trees to group rows/cards.
           // For MVP, we will just assign general roles based on keywords found near the email in text.
           
           for (const email of validEmails) {
             // Find text around email
             const emailIndex = pageText.toLowerCase().indexOf(email);
             let title = 'Athletic Staff';
             let name = 'Coach / Director';
             let sport = '';

             if (emailIndex !== -1) {
               const contextStr = pageText.substring(Math.max(0, emailIndex - 200), Math.min(pageText.length, emailIndex + 200)).toLowerCase();
               
               if (STAFF_TITLE_PATTERNS.athletic_director.test(contextStr)) {
                 title = 'Athletic Director';
               } else if (STAFF_TITLE_PATTERNS.head_coach.test(contextStr)) {
                 title = 'Head Coach';
               } else if (STAFF_TITLE_PATTERNS.assistant_coach.test(contextStr)) {
                 title = 'Assistant Coach';
               }

               // Check for sports like football, basketball
               const sports = ['football', 'basketball', 'baseball', 'softball', 'soccer', 'volleyball', 'track', 'wrestling', 'cheer'];
               for (const s of sports) {
                 if (contextStr.includes(s)) {
                   sport = s.charAt(0).toUpperCase() + s.slice(1);
                   break;
                 }
               }
             }

             // Deduplicate
             if (!contactsFound.some(c => c.email === email)) {
               contactsFound.push({ name, title, email, sport });
             }
           }
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
                phone: undefined,
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
                  phone: undefined,
                  contactName: contact.name,
                  title: contact.title,
                  sport: contact.sport
                }
              }
            });

            totalEmailsFound++;
          }
        } else {
          // Mark as scraped but no contact found, keeping status 'SCRAPED'
          await prisma.lead.update({
             where: { id: lead.id },
             data: { errorMessage: 'No valid athletic contacts found' }
          });
        }

      } catch (err: any) {
        console.error(`Error parsing website ${lead.schoolUrl}:`, err);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { errorMessage: err.message || 'Website parsing error' }
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

  } catch (error) {
    console.error("Website parsing failed:", error);

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
