/**
 * Creates the "everything is live" launch email as a DRAFT campaign addressed to
 * every subscribed contact on every mailing list (each address once). Nothing is
 * sent: review it in /admin/email-campaigns and press Launch there.
 *
 * Dry run by default: prints the list sizes and the merged recipient count and
 * writes nothing. Pass --apply to upsert the template and create the draft.
 *
 *   npm run email:launch-campaign --workspace @jose-madrid/storefront            # dry run
 *   npm run email:launch-campaign --workspace @jose-madrid/storefront -- --apply # write
 *
 * The Google review link comes from GOOGLE_REVIEW_URL (or
 * NEXT_PUBLIC_GOOGLE_BUSINESS_URL), the same source the checkout success page uses.
 */
import { PrismaClient } from '@prisma/client'
import { getErrorMessage } from '@/lib/errors'
import { everythingIsLiveTemplate } from '@/lib/email/templates/everything-is-live'
import { mergeListSubscribers } from '@/lib/email/all-lists-recipients'
import { insertRecipients } from '@/lib/email/recipients'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

const CAMPAIGN_NAME = 'Everything Is Live: New Website + Fundraising Launch'
const PREVIEW_TEXT =
  'Order through our brand-new site, check out the new fundraising site, and tell us what you think.'
const googleReviewUrl =
  process.env.GOOGLE_REVIEW_URL ??
  process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ??
  'https://g.page/jose-madrid-salsa/review'

async function createLaunchCampaign() {
  try {
    const lists = await prisma.mailingList.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { subscribers: { where: { status: 'SUBSCRIBED' } } } },
      },
      orderBy: { name: 'asc' },
    })
    const subscribers = await prisma.mailingListSubscriber.findMany({
      where: { status: 'SUBSCRIBED' },
      select: { email: true, firstName: true, lastName: true },
    })
    const recipients = mergeListSubscribers(subscribers)

    console.log(apply ? 'APPLYING launch campaign\n' : 'DRY RUN (pass --apply to write)\n')
    for (const list of lists) {
      console.log(`  ${list.name}: ${list._count.subscribers} subscribed`)
    }
    console.log(`\n${lists.length} lists, ${recipients.length} unique recipients`)
    console.log(`Subject: ${everythingIsLiveTemplate.subject}`)
    console.log(`Google review link: ${googleReviewUrl}`)

    const existing = await prisma.emailCampaign.findFirst({
      where: { name: CAMPAIGN_NAME, status: { in: ['DRAFT', 'SCHEDULED', 'SENDING'] } },
      select: { id: true, status: true },
    })
    if (existing) {
      console.log(`\nA ${existing.status} campaign with this name already exists (${existing.id}); not creating another.`)
      return
    }
    if (recipients.length === 0) {
      console.log('\nNo subscribed contacts on any list; nothing to create.')
      return
    }
    if (!apply) return

    const { key, name, subject, html, text, variables, category } = everythingIsLiveTemplate
    const template = await prisma.emailTemplate.upsert({
      where: { key },
      update: { name, subject, html, text, variables, category, isActive: true },
      create: { key, name, subject, html, text, variables, category, isActive: true, sentCount: 0 },
      select: { id: true },
    })

    const campaign = await prisma.emailCampaign.create({
      data: {
        name: CAMPAIGN_NAME,
        templateId: template.id,
        subject,
        previewText: PREVIEW_TEXT,
        status: 'DRAFT',
        totalRecipients: recipients.length,
        notes: `All mailing lists (${lists.map((l) => l.name).join(', ')}), each address once.`,
      },
      select: { id: true },
    })

    try {
      await insertRecipients(
        campaign.id,
        recipients.map((r) => ({ ...r, variables: { googleReviewUrl } })),
      )
    } catch (error) {
      await prisma.emailCampaign.delete({ where: { id: campaign.id } }).catch(() => {})
      throw error
    }

    console.log(`\nCreated DRAFT campaign ${campaign.id}. Review and launch it at /admin/email-campaigns/${campaign.id}`)
  } catch (error) {
    console.error('Failed to create the launch campaign:', getErrorMessage(error))
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

createLaunchCampaign()
