import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { SPORT_PITCHES, SUBJECT_LINE_TEMPLATES, DEFAULT_PITCH } from '@/lib/scraper/school-config';
import { emitScraperEvent } from '@/lib/scraper/scraper-events';

export async function runCampaignSender(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({ 
    where: { id: campaignId },
    include: { template: true }
  });
  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.template) throw new Error("No template assigned to campaign");

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING_EMAILS' }
  });

  const leads = await prisma.lead.findMany({
    where: { campaignId, status: 'CONTACT_FOUND', email: { not: null } }
  });

  emitScraperEvent(campaignId, 'info', 'email', `Email sender started: ${leads.length} leads to contact`);

  let totalSent = campaign.totalSent || 0;
  let totalFailed = campaign.totalFailed || 0;

  for (let idx = 0; idx < leads.length; idx++) {
    const lead = leads[idx];
    if (!lead.email) continue;

    emitScraperEvent(campaignId, 'info', 'email', `[${idx + 1}/${leads.length}] Sending to ${lead.email}`, lead.schoolName || '');

    try {
      // 1. Process variables in template
      let html = campaign.template.htmlContent;
      let subject = campaign.template.subject;

      // Determine pitch based on sport
      const sportKey = lead.sport ? lead.sport.toLowerCase() : '';
      const sportPitch = SPORT_PITCHES[sportKey] || DEFAULT_PITCH;

      // Allow fallback if subject wasn't explicitly set in template, or replace variable in template subject
      if (!subject || subject.trim() === '') {
        subject = SUBJECT_LINE_TEMPLATES.default;
      }

      const variables: Record<string, string> = {
        school_name: lead.schoolName || 'Your School',
        contact_name: lead.contactName || 'Coach',
        title: lead.title || 'Athletic Director',
        sport: lead.sport || 'Athletics program',
        sport_pitch: sportPitch,
        city: lead.city || '',
        state: lead.state || '',
      };

      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, value);
        subject = subject.replace(regex, value);
      }

      // 3. Send email using existing email utility
      // Note: We're sending one by one with a delay to respect rate limits.
      const emailOptions = {
        to: lead.email,
        subject,
        html
      };

      const res = await sendEmail(emailOptions);

      // "res.error" denotes failure inside sendEmail
      if (res && (res as any).error) {
         throw new Error(((res as any).error as any)?.message || "Resend returned error");
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'EMAIL_SENT', sentAt: new Date(), errorMessage: null }
      });
      totalSent++;
      emitScraperEvent(campaignId, 'success', 'email', `Sent to ${lead.email}`, `${lead.schoolName} - ${lead.title}`);

    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      emitScraperEvent(campaignId, 'error', 'email', `Failed: ${lead.email} - ${errMsg}`);
      totalFailed++;
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'EMAIL_FAILED', errorMessage: e instanceof Error ? e.message : String(e) }
      });
    }
    
    // Sleep to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED', totalSent, totalFailed }
  });

  emitScraperEvent(campaignId, 'success', 'email', `Email sending complete: ${totalSent} sent, ${totalFailed} failed`);
}
