import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { SPORT_PITCHES, SUBJECT_LINE_TEMPLATES, DEFAULT_PITCH } from '@/lib/scraper/school-config';

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

  let totalSent = campaign.totalSent || 0;
  let totalFailed = campaign.totalFailed || 0;

  for (const lead of leads) {
    if (!lead.email) continue;

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

    } catch (e: any) {
      console.error(`Failed to send email to ${lead.email}:`, e);
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
}
