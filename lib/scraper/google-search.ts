import { chromium } from 'playwright';
import { prisma } from '@/lib/prisma';
import {
  SEARCH_QUERY_TEMPLATES,
  MAX_SEARCH_PAGES,
  EXCLUDED_DOMAINS,
  SCHOOL_DOMAIN_PATTERNS,
} from './school-config';
import { emitScraperEvent } from './scraper-events';

const BRAVE_SEARCH_URL = 'https://search.brave.com/search';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runGoogleSearchScraper(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error('Campaign not found');

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'SCRAPING' },
  });

  emitScraperEvent(
    campaignId,
    'info',
    'search',
    'Search scraper started (Brave Search)',
    `Target: ${campaign.city}, ${campaign.state}`
  );

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });

  try {
    const queries = buildSearchQueries(campaign);
    emitScraperEvent(
      campaignId,
      'info',
      'search',
      `Generated ${queries.length} search queries`,
      queries.join(' | ')
    );

    let totalFound = 0;
    const seenUrls = new Set<string>();
    const limit = campaign.limit || 50;

    for (const query of queries) {
      if (totalFound >= limit) break;

      for (let pageNum = 0; pageNum < MAX_SEARCH_PAGES; pageNum++) {
        if (totalFound >= limit) break;

        emitScraperEvent(
          campaignId,
          'info',
          'search',
          `Searching: "${query}" (page ${pageNum + 1})`,
          `Found so far: ${totalFound}`
        );

        const page = await context.newPage();

        try {
          const searchUrl =
            pageNum === 0
              ? `${BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}`
              : `${BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&offset=${pageNum}`;

          await page.goto(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          });

          // Wait for results to render
          await page
            .waitForSelector('#results .snippet', { timeout: 10000 })
            .catch(() => null);
          await delay(2000);

          // Parse Brave Search snippets - take only the FIRST external link per snippet
          // (the main result), skipping sub-links like "Online Store", "For Students", etc.
          const snippets = page.locator('#results .snippet');
          const snippetCount = await snippets.count();

          const pageResults: Array<{ url: string; title: string }> = [];
          const seenSnippetDomains = new Set<string>();

          for (let i = 0; i < snippetCount; i++) {
            const snippet = snippets.nth(i);
            const anchors = snippet.locator('a[href^="http"]');
            const anchorCount = await anchors.count();

            if (anchorCount > 0) {
              const mainAnchor = anchors.first();
              const url = (await mainAnchor.getAttribute('href')) || '';
              const rawTitle = (await mainAnchor.textContent()) || '';

              if (
                url.startsWith('http') &&
                rawTitle.trim().length > 3 &&
                !url.includes('brave.com')
              ) {
                // Deduplicate by domain within a single page of results
                // (Brave shows sub-links under the same domain)
                let domain: string;
                try {
                  domain = new URL(url).hostname;
                } catch {
                  domain = url;
                }

                if (!seenSnippetDomains.has(domain)) {
                  seenSnippetDomains.add(domain);
                  pageResults.push({
                    url,
                    title: cleanTitle(rawTitle.trim()),
                  });
                }
              }
            }
          }

          emitScraperEvent(
            campaignId,
            'info',
            'search',
            `Page ${pageNum + 1}: found ${pageResults.length} results from ${snippetCount} snippets`
          );

          for (const res of pageResults) {
            if (totalFound >= limit) break;

            let cleanUrl: string;
            try {
              const urlObj = new URL(res.url);
              cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
            } catch {
              cleanUrl = res.url;
            }

            const isExcluded = EXCLUDED_DOMAINS.some((domain) =>
              cleanUrl.includes(domain)
            );
            if (isExcluded) continue;
            if (seenUrls.has(cleanUrl)) continue;

            seenUrls.add(cleanUrl);

            const isSchoolDomain = SCHOOL_DOMAIN_PATTERNS.some((p) =>
              cleanUrl.includes(p)
            );

            await prisma.lead.create({
              data: {
                campaignId,
                schoolName: res.title || 'Unknown School',
                schoolUrl: res.url,
                city: campaign.city,
                state: campaign.state,
                district: campaign.district,
                status: 'SCRAPED',
              },
            });
            totalFound++;

            const domainTag = isSchoolDomain ? ' [school domain]' : '';
            emitScraperEvent(
              campaignId,
              'success',
              'search',
              `Saved: ${res.title}${domainTag}`,
              cleanUrl
            );
          }

          await delay(1500 + Math.random() * 1000);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Unknown search error';
          emitScraperEvent(
            campaignId,
            'warn',
            'search',
            `Search page ${pageNum + 1} failed: ${message}`
          );
          await delay(3000);
        } finally {
          await page.close();
        }
      }
    }

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'SCRAPE_COMPLETED', totalFound },
    });

    emitScraperEvent(
      campaignId,
      'success',
      'search',
      `Search complete: ${totalFound} schools found`,
      `Unique URLs checked: ${seenUrls.size}`
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    emitScraperEvent(
      campaignId,
      'error',
      'search',
      `Search scraper failed: ${message}`
    );
    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    });
  } finally {
    await browser.close();
  }
}

function buildSearchQueries(campaign: {
  city: string | null;
  state: string | null;
  district: string | null;
  schoolType: string | null;
}): string[] {
  const city = campaign.city || '';
  const state = campaign.state || '';
  const district = campaign.district || '';
  const schoolType = campaign.schoolType || 'high school';

  const queries: string[] = [];

  if (district) {
    queries.push(
      SEARCH_QUERY_TEMPLATES.by_district
        .replace('{district}', district)
        .replace('{state}', state)
    );
  }

  if (schoolType.toLowerCase().includes('middle')) {
    queries.push(
      SEARCH_QUERY_TEMPLATES.by_city_middle
        .replace('{city}', city)
        .replace('{state}', state)
    );
  } else {
    queries.push(
      SEARCH_QUERY_TEMPLATES.by_city
        .replace('{city}', city)
        .replace('{state}', state)
    );
  }

  queries.push(
    SEARCH_QUERY_TEMPLATES.by_city_coaches
      .replace('{city}', city)
      .replace('{state}', state)
  );

  queries.push(
    `${city} ${state} ${schoolType} athletics coaching staff directory`
  );

  return queries.filter((q) => q.trim().length > 0);
}

function cleanTitle(title: string): string {
  let cleaned = title;

  // Brave format: "SiteName domain.com  > breadcrumb  > path   Actual Title - Suffix"
  // Strategy: find the last segment after breadcrumb arrows + whitespace gap
  const breadcrumbMatch = cleaned.match(
    /^[A-Za-z0-9 ]+\s+[a-z0-9.-]+\.[a-z]{2,}(?:\s*[›>]\s*[^\s][^›>]*)*\s{2,}(.+)$/i
  );
  if (breadcrumbMatch && breadcrumbMatch[1].length >= 5) {
    cleaned = breadcrumbMatch[1];
  }

  // Remove video duration prefix (e.g., "01:29  YouTube")
  cleaned = cleaned.replace(/^\d{2}:\d{2}\s+YouTube\s+/i, '');

  // Remove trailing site names / suffixes
  cleaned = cleaned.replace(
    /\s*[-|]\s*(Brave|Search|Home|Official Site|Website|YouTube).*$/i,
    ''
  );

  // Remove trailing ellipsis
  cleaned = cleaned.replace(/\s*\.{3}\s*$/, '');

  cleaned = cleaned.trim();

  // If cleaning made it too short, try extracting from the original title
  // by just removing the domain part
  if (cleaned.length < 5) {
    cleaned = title
      .replace(/^[A-Za-z0-9 ]+\s+[a-z0-9.-]+\.[a-z]{2,}\s*/i, '')
      .replace(/[›>]/g, '')
      .trim();
  }

  return cleaned.length >= 3 ? cleaned : title.trim();
}
