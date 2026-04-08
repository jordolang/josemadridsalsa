import { chromium } from 'playwright';
import { prisma } from '@/lib/prisma';
import { eventBus } from './event-bus';
import {
  SEARCH_QUERY_TEMPLATES,
  MAX_SEARCH_PAGES,
  EXCLUDED_DOMAINS
} from './school-config';

export async function runGoogleSearchScraper(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'SCRAPING' }
  });

  // Emit status change
  eventBus.emit({
    type: 'campaign:status_changed',
    data: {
      campaignId,
      status: 'SCRAPING',
      message: 'Started Google Search scraping'
    }
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Construct query
    let queryTemplate = SEARCH_QUERY_TEMPLATES.by_city;
    if (campaign.schoolType?.toLowerCase().includes('middle')) {
      queryTemplate = SEARCH_QUERY_TEMPLATES.by_city_middle;
    } else if (campaign.district) {
      queryTemplate = SEARCH_QUERY_TEMPLATES.by_district;
    }

    let query = queryTemplate
      .replace('{city}', campaign.city || '')
      .replace('{state}', campaign.state || '')
      .replace('{district}', campaign.district || '');
    
    // Fallback if no specific templates fit
    if (!query) {
       query = `${campaign.city} ${campaign.state} ${campaign.schoolType} athletics`;
    }

    const encodedQuery = encodeURIComponent(query.trim().replace(/\s+/g, ' '));
    let currentUrl = `https://www.google.com/search?q=${encodedQuery}&gl=us&hl=en`;
    
    let totalFound = 0;
    const seenUrls = new Set<string>();

    for (let pageNum = 0; pageNum < MAX_SEARCH_PAGES; pageNum++) {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000 + Math.random() * 1000); // Random delay

      // Try to click consent buttons if they appear
      try {
        await page.click('button#L2AGLb, button#W0wltc, button:has-text("Accept all"), button:has-text("I agree")', { timeout: 1500 });
        await page.waitForTimeout(1000);
      } catch (e) {
        // No consent page or already accepted
      }

      // Parse search results

      const results = await page.$$eval('#main a, #search a, #res a, a', elements => {
        return elements.map(el => {
          const a = el as HTMLAnchorElement;
          let url = a.href || '';
          if (url.includes('/url?q=')) {
            try { url = new URL(url).searchParams.get('q') || url; } catch(e) {}
          }
          const h3 = el.querySelector('h3');
          return {
            url,
            title: h3 ? h3.textContent : el.textContent
          };
        }).filter(item => item.url && item.url.startsWith('http') && !item.url.includes('google.com') && item.title);
      });
      
      console.log(`Found ${results.length} links on page ${pageNum}`);

      for (const res of results) {
        // Clean URL (remove tracking params, hash, etc.)
        let cleanUrl = res.url;
        try {
          const urlObj = new URL(res.url);
          cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        } catch (e) {
          // invalid url
        }

        // Check if excluded domain
        const isExcluded = EXCLUDED_DOMAINS.some(domain => cleanUrl.includes(domain));
        if (isExcluded || seenUrls.has(cleanUrl)) continue;

        seenUrls.add(cleanUrl);

        // Store Lead
        const lead = await prisma.lead.create({
          data: {
            campaignId,
            schoolName: res.title || 'Unknown School',
            schoolUrl: res.url, // save original url
            city: campaign.city,
            state: campaign.state,
            district: campaign.district,
            status: 'SCRAPED',
          }
        });

        // Emit real-time event
        eventBus.emit({
          type: 'lead:found',
          data: {
            campaignId,
            lead: {
              id: lead.id,
              schoolName: lead.schoolName,
              schoolUrl: lead.schoolUrl,
              status: lead.status,
            }
          }
        });

        totalFound++;
        
        if (totalFound >= (campaign.limit || 50)) break;
      }

      if (totalFound >= (campaign.limit || 50)) break;

      // Emit progress
      eventBus.emit({
        type: 'campaign:progress',
        data: {
          campaignId,
          currentStep: 'search',
          progress: {
            current: totalFound,
            total: campaign.limit || 50
          }
        }
      });

      // Next page
      const nextButton = await page.$('a#pnnext');
      if (nextButton) {
        const nextHref = await nextButton.getAttribute('href');
        if (nextHref) {
          currentUrl = `https://www.google.com${nextHref}`;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'SCRAPE_COMPLETED', totalFound }
    });

    // Emit completion event
    eventBus.emit({
      type: 'campaign:status_changed',
      data: {
        campaignId,
        status: 'SCRAPE_COMPLETED',
        message: `Completed with ${totalFound} leads found`
      }
    });

  } catch (error) {
    console.error("Google Search Scraping failed:", error);

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
        step: 'search'
      }
    });
  } finally {
    await browser.close();
  }
}
