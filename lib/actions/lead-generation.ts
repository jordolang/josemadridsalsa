'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { runGoogleSearchScraper } from '@/lib/scraper/google-search';
import { runWebsiteParser } from '@/lib/scraper/website-parser';
import { runCampaignSender } from '@/lib/email/campaign-sender';

export async function createLeadCampaign(data: { name: string, city: string, state: string, district?: string, schoolType?: string, limit?: number }) {
  const campaign = await prisma.leadCampaign.create({
    data: {
      name: data.name,
      city: data.city,
      state: data.state,
      district: data.district,
      schoolType: data.schoolType || 'high school',
      limit: data.limit || 50,
      status: 'DRAFT'
    }
  });
  revalidatePath('/admin/lead-generation');
  return campaign.id;
}

export async function triggerGoogleSearchScraper(campaignId: string) {
  runGoogleSearchScraper(campaignId).catch(console.error);
  return { success: true };
}

export async function triggerWebsiteParser(campaignId: string) {
  runWebsiteParser(campaignId).catch(console.error);
  return { success: true };
}

export async function triggerEmailSender(campaignId: string) {
  runCampaignSender(campaignId).catch(console.error);
  return { success: true };
}

export async function triggerFullAutomation(campaignId: string) {
  (async () => {
    try {
      await runGoogleSearchScraper(campaignId);
      
      const campaignAfterScrape = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
      if (campaignAfterScrape?.status !== 'SCRAPE_COMPLETED') return;

      await runWebsiteParser(campaignId);

      const campaignAfterParse = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
      if (campaignAfterParse?.status !== 'PARSING_COMPLETED') return;

      if (!campaignAfterParse.templateId) {
        throw new Error("Cannot send emails: No template assigned.");
      }

      await runCampaignSender(campaignId);
    } catch (e) {
      console.error("Automation error:", e);
      await prisma.leadCampaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED' }
      });
    }
  })();
  return { success: true };
}

export async function deleteLeadCampaign(campaignId: string) {
  await prisma.leadCampaign.delete({ where: { id: campaignId } });
  revalidatePath('/admin/lead-generation');
}

export async function saveCampaignTemplate(campaignId: string, templateData: { name: string, subject: string, htmlContent: string }) {
  const template = await prisma.leadEmailTemplate.create({
    data: templateData
  });
  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { templateId: template.id }
  });
  revalidatePath(`/admin/lead-generation/${campaignId}`);
}
