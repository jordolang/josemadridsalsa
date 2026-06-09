'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/rbac';
import { runGoogleSearchScraper } from '@/lib/scraper/google-search';
import { runGoogleBusinessScraper } from '@/lib/scraper/google-business-search';
import { runWebsiteParser } from '@/lib/scraper/website-parser';
import { runCampaignSender } from '@/lib/email/campaign-sender';
import { emitScraperEvent, clearScraperLogs } from '@/lib/scraper/scraper-events';

interface CreateLeadCampaignInput {
  name: string
  city: string
  state: string
  leadType: 'SCHOOL_ATHLETICS' | 'LOCAL_BUSINESS' | 'LOCAL_SCHOOL'
  district?: string
  schoolType?: string
  businessCategory?: string
  searchQuery?: string
  radius?: string
  limit?: number
}

export async function createLeadCampaign(data: CreateLeadCampaignInput): Promise<string> {
  await requirePermission('messaging:read');
  const campaign = await prisma.leadCampaign.create({
    data: {
      name: data.name,
      city: data.city,
      state: data.state,
      leadType: data.leadType,
      district: data.district,
      schoolType: data.schoolType || (data.leadType !== 'LOCAL_BUSINESS' ? 'high school' : undefined),
      businessCategory: data.businessCategory,
      searchQuery: data.searchQuery,
      radius: data.radius,
      limit: data.limit || 50,
      status: 'DRAFT',
    },
  });
  revalidatePath('/admin/lead-generation');
  return campaign.id;
}

export async function triggerGoogleSearchScraper(campaignId: string) {
  await requirePermission('messaging:read');
  clearScraperLogs(campaignId);

  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    select: { leadType: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  const scraper =
    campaign.leadType === 'LOCAL_BUSINESS'
      ? runGoogleBusinessScraper
      : runGoogleSearchScraper;

  emitScraperEvent(
    campaignId,
    'info',
    'system',
    `Triggering ${campaign.leadType === 'LOCAL_BUSINESS' ? 'business' : 'school'} search scraper...`
  );

  scraper(campaignId).catch((err) => {
    emitScraperEvent(
      campaignId,
      'error',
      'system',
      `Scraper crashed: ${err instanceof Error ? err.message : String(err)}`
    );
  });

  return { success: true };
}

export async function triggerWebsiteParser(campaignId: string) {
  await requirePermission('messaging:read');
  emitScraperEvent(campaignId, 'info', 'system', 'Triggering website parser...');
  runWebsiteParser(campaignId).catch((err) => {
    emitScraperEvent(campaignId, 'error', 'system', `Parser crashed: ${err instanceof Error ? err.message : String(err)}`);
  });
  return { success: true };
}

export async function triggerEmailSender(campaignId: string) {
  await requirePermission('messaging:read');
  emitScraperEvent(campaignId, 'info', 'system', 'Triggering email sender...');
  runCampaignSender(campaignId).catch((err) => {
    emitScraperEvent(campaignId, 'error', 'system', `Email sender crashed: ${err instanceof Error ? err.message : String(err)}`);
  });
  return { success: true };
}

export async function triggerFullAutomation(campaignId: string) {
  await requirePermission('messaging:read');
  clearScraperLogs(campaignId);
  emitScraperEvent(campaignId, 'info', 'system', 'Starting full automation pipeline...');
  (async () => {
    try {
      const campaign = await prisma.leadCampaign.findUnique({
        where: { id: campaignId },
        select: { leadType: true, templateId: true },
      });
      if (!campaign) {
        emitScraperEvent(campaignId, 'error', 'system', 'Campaign not found');
        return;
      }

      const scraper =
        campaign.leadType === 'LOCAL_BUSINESS'
          ? runGoogleBusinessScraper
          : runGoogleSearchScraper;

      await scraper(campaignId);

      const campaignAfterScrape = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
      if (campaignAfterScrape?.status !== 'SCRAPE_COMPLETED') {
        emitScraperEvent(campaignId, 'error', 'system', `Search stage ended with status: ${campaignAfterScrape?.status}`);
        return;
      }

      emitScraperEvent(campaignId, 'info', 'system', 'Search complete, starting website parser...');
      await runWebsiteParser(campaignId);

      const campaignAfterParse = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
      if (campaignAfterParse?.status !== 'PARSING_COMPLETED') {
        emitScraperEvent(campaignId, 'error', 'system', `Parse stage ended with status: ${campaignAfterParse?.status}`);
        return;
      }

      if (!campaignAfterParse.templateId) {
        emitScraperEvent(campaignId, 'warn', 'system', 'No email template assigned - skipping email send stage');
        return;
      }

      emitScraperEvent(campaignId, 'info', 'system', 'Parsing complete, starting email sender...');
      await runCampaignSender(campaignId);
      emitScraperEvent(campaignId, 'success', 'system', 'Full automation pipeline complete!');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emitScraperEvent(campaignId, 'error', 'system', `Automation failed: ${msg}`);
      await prisma.leadCampaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED' }
      });
    }
  })();
  return { success: true };
}

export async function deleteLeadCampaign(campaignId: string) {
  await requirePermission('messaging:read');
  await prisma.leadCampaign.delete({ where: { id: campaignId } });
  revalidatePath('/admin/lead-generation');
}

export async function saveCampaignTemplate(campaignId: string, templateData: { name: string, subject: string, htmlContent: string }) {
  await requirePermission('messaging:read');
  const template = await prisma.leadEmailTemplate.create({
    data: templateData
  });
  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { templateId: template.id }
  });
  revalidatePath(`/admin/lead-generation/${campaignId}`);
}
