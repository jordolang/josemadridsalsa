import type { NewsletterBlock, NewsletterTemplate } from '@/types/email'
import { announcementNewsletterTemplate } from './templates/announcement-newsletter'
import { announcementSingleTemplate } from './templates/announcement-single'

type BuildTemplateOptions = {
  heroTitle: string
  heroSubtitle: string
  heroImage: string
  subject: string
  preheader: string
  buttonLabel: string
  buttonHref: string
  sections: Array<{
    heading: string
    copy: string
  }>
  highlight?: string
  footerNote?: string
  tags: string[]
}

const baseTableOpen = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Jose Madrid Salsa Newsletter</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Helvetica Neue', Arial, sans-serif; color:#0f172a;">
    <table role="presentation" width="100%" border="0" cellPadding="0" cellSpacing="0" style="background-color:#f8fafc;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" border="0" cellPadding="0" cellSpacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 20px 40px rgba(15,23,42,0.08); margin:32px 16px;">
`

const baseTableClose = `
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

function buildTemplate({
  heroTitle,
  heroSubtitle,
  heroImage,
  subject,
  preheader,
  buttonLabel,
  buttonHref,
  sections,
  highlight,
  footerNote,
  tags,
}: BuildTemplateOptions): NewsletterTemplate {
  const html =
    `${baseTableOpen}
            <tr>
              <td style="padding:20px 32px; background-color:#f1f5f9; font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#dd3b3b;">
                ${preheader}
              </td>
            </tr>
            <tr>
              <td>
                <img src="${heroImage}" alt="" style="display:block; width:100%; height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px; font-size:32px; line-height:1.2; color:#0f172a;">${heroTitle}</h1>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#475569;">${heroSubtitle}</p>
                <a
                  href="${buttonHref}"
                  style="display:inline-block; padding:14px 28px; background-color:#dd3b3b; color:#ffffff; border-radius:999px; text-decoration:none; font-weight:600; font-size:15px;"
                >
                  ${buttonLabel}
                </a>
              </td>
            </tr>
            ${
              highlight
                ? `<tr>
              <td style="padding:0 32px 32px;">
                <div style="padding:20px; border-radius:16px; background-color:#fef3c7; color:#c2410c; font-size:14px; line-height:1.5;">
                  ${highlight}
                </div>
              </td>
            </tr>`
                : ''
            }
            ${sections
              .map(
                (section) => `
            <tr>
              <td style="padding:0 32px 28px;">
                <h2 style="margin:0 0 10px; font-size:22px; color:#0f172a;">${section.heading}</h2>
                <p style="margin:0; font-size:15px; line-height:1.7; color:#475569;">${section.copy}</p>
              </td>
            </tr>
            `
              )
              .join('')}
            <tr>
              <td style="padding:0 32px 12px;">
                <hr style="height:1px; border:none; background-color:#e2e8f0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0 0 12px; font-size:13px; color:#94a3b8; line-height:1.6;">
                  ${footerNote ?? 'You are receiving this email because you opted in at JoseMadridSalsa.com.'}
                </p>
                <p style="margin:0; font-size:13px; color:#94a3b8;">
                  <a href="https://www.josemadridsalsa.com" style="color:#dd3b3b; text-decoration:none;">Website</a> ·
                  <a href="https://www.facebook.com/JoseMadridSalsa" style="color:#dd3b3b; text-decoration:none;">Facebook</a> ·
                  <a href="https://www.instagram.com/JoseMadridSalsa" style="color:#dd3b3b; text-decoration:none;">Instagram</a>
                </p>
              </td>
            </tr>
${baseTableClose}`

  return {
    id: subject.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: heroTitle,
    subject,
    description: preheader,
    tags,
    html,
  }
}

export const newsletterTemplates: NewsletterTemplate[] = [
  buildTemplate({
    subject: 'January Salsa Drop & Fundraising Kits',
    heroTitle: 'Heat up the new year with limited batches',
    heroSubtitle:
      'New habanero honey salsa, fresh tasting booth bundles, and fundraising kits that ship in four days.',
    heroImage: '{{hero_image_url_january_drop}}',
    preheader: 'Fresh flavors and fundraising support',
    buttonLabel: 'Order the new batch',
    buttonHref: '{{primary_cta_url}}',
    highlight: 'Fundraisers now come with a co-branded order form, thank-you email template, and QR code posters.',
    sections: [
      {
        heading: 'Limited small-batch release',
        copy: 'Our January micro-batch features habanero honey with a hint of smoked paprika. Available through March or until sold out.',
      },
      {
        heading: 'Pop-up tasting booth',
        copy: 'Reserve the new display kit with table runner, sample trays, and signage—perfect for grocery demos or winter festivals.',
      },
      {
        heading: 'Support for fundraisers',
        copy: 'Schedule a 20-minute kickoff call with our fundraising specialist to plan your next school or community event.',
      },
    ],
    tags: ['fundraising', 'product', 'seasonal'],
  }),
  buildTemplate({
    subject: 'Wholesale partner update: merchandising refresh',
    heroTitle: 'Your Jose Madrid Salsa shelf makeover toolkit',
    heroSubtitle:
      'Drive repeat visits with new shelf talkers, QR codes, and a merchandising guide built for busy grocery teams.',
    heroImage: '{{hero_image_url_wholesale_refresh}}',
    preheader: 'New display tools for retailers',
    buttonLabel: 'Download toolkit',
    buttonHref: '{{merch_toolkit_url}}',
    sections: [
      {
        heading: 'Print-ready shelf talkers',
        copy: 'Highlight best-selling flavors with removable shelf talkers sized for standard 1.25” rails. Available in spicy, sweet, and limited edition sets.',
      },
      {
        heading: 'Cross-merchandising ideas',
        copy: 'Pair Jose Madrid Salsa with local chips, cheeses, and prepared meals. The toolkit includes planograms for endcaps and tasting tables.',
      },
      {
        heading: 'Staff training one-pager',
        copy: 'Keep product knowledge tight with tasting notes, heat levels, and talking points in an easy-to-print PDF.',
      },
    ],
    tags: ['wholesale', 'merchandising'],
  }),
  buildTemplate({
    subject: 'Fundraiser spotlight: Granville High sets a record',
    heroTitle: 'See how Granville High raised $14k in 10 days',
    heroSubtitle:
      'Copy their playbook: digital order forms, overnight sample requests, and a thank-you workflow you can reuse today.',
    heroImage: '{{hero_image_url_fundraiser_spotlight}}',
    preheader: 'Fundraiser success blueprint',
    buttonLabel: 'Download the playbook',
    buttonHref: '{{fundraiser_playbook_url}}',
    highlight: 'Granville High leaned on our ready-made social graphics and parent email templates—available for your next fundraiser.',
    sections: [
      {
        heading: 'Their winning timeline',
        copy: 'From kickoff night to final pickup, see how they stacked promotional moments across email, text, and social.',
      },
      {
        heading: 'Average order value boosts',
        copy: 'Bundled salsa trios lifted order value by 32%. We included the exact pricing matrix and bundle artwork.',
      },
      {
        heading: 'Volunteer toolkit downloads',
        copy: 'Assign roles fast with editable checklists, cash box logs, and sample station guides.',
      },
    ],
    tags: ['fundraising', 'customer-story'],
  }),
  buildTemplate({
    subject: 'Recipe digest: Winter comfort food pairings',
    heroTitle: '5 winter recipes to warm up the table',
    heroSubtitle:
      'Use Jose Madrid Salsa to liven up soups, slow cooker favorites, and game-day boards. Download the printable PDF for your customers.',
    heroImage: '{{hero_image_url_recipe_digest}}',
    preheader: 'Recipes your customers will love',
    buttonLabel: 'Get the printable PDF',
    buttonHref: '{{recipe_pdf_url}}',
    sections: [
      {
        heading: 'Smoky chipotle chili',
        copy: 'Layer our Chipotle Black Bean & Corn salsa into a hearty chili base. Serve with cornbread and a spoonful of crema.',
      },
      {
        heading: 'Sheet-pan nacho bar',
        copy: 'Build a nacho bar with Jose Madrid hot salsas, queso, roasted veggies, and house-made pickled jalapeños.',
      },
      {
        heading: 'Slow cooker pulled chicken',
        copy: 'Let our Pineapple Salsa work overtime in the slow cooker. Toss in chicken thighs, onions, and peppers for a sweet heat sandwich base.',
      },
    ],
    tags: ['recipe', 'content'],
  }),
  buildTemplate({
    subject: 'Merch drop: Represent the heat',
    heroTitle: 'New Jose Madrid Salsa merch is live',
    heroSubtitle:
      'From embroidered aprons to insulated coolers, the latest merch run keeps your team outfitted and fans stocked.',
    heroImage: '{{hero_image_url_merch_drop}}',
    preheader: 'Fresh gear for fans & teams',
    buttonLabel: 'Explore merch',
    buttonHref: '{{merch_collection_url}}',
    highlight:
      'Pre-orders placed before March 1 receive free direct-to-home shipping and a bonus set of limited-edition stickers.',
    sections: [
      {
        heading: 'Signature apparel',
        copy: 'Crewnecks, aprons, and caps featuring our 1982 mark. Choose from comfort colors or premium tri-blend fabrics.',
      },
      {
        heading: 'Event-ready kits',
        copy: 'Grab collapsible table runners, tasting flight displays, and signage sized for school fundraisers or farmers markets.',
      },
      {
        heading: 'Wholesale bundles',
        copy: 'Need a retail-ready gift set? We bundled salsa trios with recipe cards and a reusable tote—perfect for endcaps.',
      },
    ],
    tags: ['merchandise', 'product'],
  }),
  buildTemplate({
    subject: 'You’re invited: Jose Madrid Salsa tasting tour',
    heroTitle: 'Join us on the Spring tasting tour',
    heroSubtitle:
      'Meet founder Jose Madrid, sample micro-batch releases, and learn how to host a fundraiser with us this season.',
    heroImage: '{{hero_image_url_event_invite}}',
    preheader: 'Reserve your tasting slot',
    buttonLabel: 'RSVP today',
    buttonHref: '{{event_rsvp_url}}',
    highlight:
      'Bring a teammate or partner—every RSVP receives an event kit with swag, table signs, and exclusive coupon codes.',
    sections: [
      {
        heading: 'Tour stops',
        copy: 'Columbus, Cincinnati, Cleveland, and Pittsburgh. Each stop features local partners and exclusive flavor reveals.',
      },
      {
        heading: 'Fundraising workshops',
        copy: 'Get hands-on help setting your goals, pricing out kits, and setting up the online order form.',
      },
      {
        heading: 'Wholesale roundtables',
        copy: 'Retail buyers can review year-over-year performance and plan collaborative promotions with our team.',
      },
    ],
    tags: ['event', 'invitation'],
  }),
  // Standalone announcement layouts. Their markup lives alongside the seeded
  // template definitions so the gallery and the send path share one source.
  {
    id: 'announcement-newsletter',
    name: announcementNewsletterTemplate.name,
    subject: announcementNewsletterTemplate.subject,
    description: announcementNewsletterTemplate.description,
    tags: ['announcement', 'newsletter'],
    html: announcementNewsletterTemplate.html,
  },
  {
    id: 'announcement-single',
    name: announcementSingleTemplate.name,
    subject: announcementSingleTemplate.subject,
    description: announcementSingleTemplate.description,
    tags: ['announcement'],
    html: announcementSingleTemplate.html,
  },
]

export const newsletterBlocks: NewsletterBlock[] = [
  {
    id: 'hero-callout',
    label: 'Hero callout with button',
    category: 'hero',
    description: 'Large headline, supporting copy, and a rounded CTA button on a muted background.',
    html: `
<table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background-color:#fef2f2; border-radius:24px; overflow:hidden;">
  <tr>
    <td style="padding:32px;">
      <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#dc2626;">Featured</p>
      <h1 style="margin:0 0 12px; font-size:30px; color:#0f172a;">{{headline}}</h1>
      <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#475569;">{{supporting_copy}}</p>
      <a href="{{cta_href}}" style="display:inline-block; padding:14px 32px; background-color:#dc2626; color:#ffffff; text-decoration:none; border-radius:999px; font-weight:600;">{{cta_label}}</a>
    </td>
  </tr>
</table>
`,
  },
  {
    id: 'two-column-feature',
    label: 'Two-column feature',
    category: 'content',
    description: 'Balanced column layout for product highlights or program comparisons.',
    html: `
<table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
  <tr>
    <td width="50%" style="padding:16px; background-color:#f8fafc; border-radius:20px;">
      <h2 style="margin:0 0 8px; font-size:20px; color:#0f172a;">{{left_heading}}</h2>
      <p style="margin:0; font-size:15px; line-height:1.6; color:#475569;">{{left_copy}}</p>
    </td>
    <td width="50%" style="padding:16px;">
      <h2 style="margin:0 0 8px; font-size:20px; color:#0f172a;">{{right_heading}}</h2>
      <p style="margin:0; font-size:15px; line-height:1.6; color:#475569;">{{right_copy}}</p>
    </td>
  </tr>
</table>
`,
  },
  {
    id: 'product-grid',
    label: 'Product trio grid',
    category: 'content',
    description: 'Three evenly spaced product cards with name, flavor notes, and CTA links.',
    html: `
<table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
  <tr>
    <td style="padding:16px;">
      <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
        <tr>
          {{#each products}}
          <td width="33.33%" style="padding:12px;">
            <div style="border-radius:18px; border:1px solid #e2e8f0; padding:16px; text-align:center;">
              <img src="{{image_url}}" alt="{{name}}" style="width:100%; max-width:140px; margin:0 auto 12px; border-radius:12px;" />
              <p style="margin:0 0 6px; font-weight:600; color:#0f172a;">{{name}}</p>
              <p style="margin:0 0 12px; font-size:13px; color:#475569;">{{flavor_notes}}</p>
              <a href="{{cta_href}}" style="color:#dc2626; text-decoration:none; font-weight:600;">Shop now →</a>
            </div>
          </td>
          {{/each}}
        </tr>
      </table>
    </td>
  </tr>
</table>
`,
  },
  {
    id: 'cta-banner',
    label: 'Full-width CTA banner',
    category: 'cta',
    description: 'Bold call-to-action banner with optional secondary link.',
    html: `
<table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background:linear-gradient(135deg,#dc2626,#ea580c); border-radius:24px;">
  <tr>
    <td style="padding:32px; text-align:center; color:#ffffff;">
      <h2 style="margin:0 0 12px; font-size:26px;">{{cta_headline}}</h2>
      <p style="margin:0 0 20px; font-size:16px; line-height:1.6;">{{cta_copy}}</p>
      <a href="{{cta_href}}" style="display:inline-block; padding:14px 40px; background-color:#ffffff; color:#dc2626; border-radius:999px; font-weight:600; text-decoration:none;">{{cta_label}}</a>
      <p style="margin:16px 0 0; font-size:13px;">
        <a href="{{secondary_href}}" style="color:#fde68a; text-decoration:none;">{{secondary_label}}</a>
      </p>
    </td>
  </tr>
</table>
`,
  },
  {
    id: 'social-bar',
    label: 'Social share bar',
    category: 'social',
    description: 'Simple social icon list styled for email footers.',
    html: `
<table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background-color:#0f172a; border-radius:18px;">
  <tr>
    <td style="padding:18px 24px; text-align:center; color:#e2e8f0; font-size:13px;">
      <p style="margin:0 0 12px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase;">Stay connected</p>
      <a href="{{facebook_url}}" style="margin:0 6px; color:#e2e8f0; text-decoration:none;">Facebook</a>
      <a href="{{instagram_url}}" style="margin:0 6px; color:#e2e8f0; text-decoration:none;">Instagram</a>
      <a href="{{tiktok_url}}" style="margin:0 6px; color:#e2e8f0; text-decoration:none;">TikTok</a>
      <a href="{{youtube_url}}" style="margin:0 6px; color:#e2e8f0; text-decoration:none;">YouTube</a>
    </td>
  </tr>
</table>
`,
  },
  {
    id: 'footer-contact',
    label: 'Footer contact block',
    category: 'footer',
    description: 'Contact information with address, signature, and unsubscribe link.',
    html: `
<table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
  <tr>
    <td style="padding:18px 24px; font-size:12px; line-height:1.6; color:#94a3b8; text-align:center;">
      <p style="margin:0 0 8px;">Need help? Reply to this email or call <a href="tel:+17403493144" style="color:#dc2626; text-decoration:none;">740-349-3144</a>.</p>
      <p style="margin:0 0 8px;">Jose Madrid Salsa · 59 S 6th Street · Newark, OH 43055</p>
      <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#dc2626; text-decoration:none;">Unsubscribe</a></p>
    </td>
  </tr>
</table>
`,
  },
]
