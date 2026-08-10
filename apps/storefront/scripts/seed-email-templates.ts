/**
 * Seed Email Templates
 * Populates the database with professional email templates
 */

import { PrismaClient } from '@prisma/client'
import { emailTemplates } from '../lib/email/templates/index'

const prisma = new PrismaClient()

async function main() {
  // Seeding upserts, so a blanket run replaces the stored HTML of every
  // template — including any edited in the admin panel. Pass keys to limit the
  // run to specific templates:
  //   npm run db:seed:email-templates -- announcement_single order_confirmation_light
  const requestedKeys = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))

  const selected = requestedKeys.length
    ? emailTemplates.filter((template) => requestedKeys.includes(template.key))
    : emailTemplates

  if (requestedKeys.length) {
    const unknown = requestedKeys.filter(
      (key) => !emailTemplates.some((template) => template.key === key)
    )
    if (unknown.length) {
      console.error(`❌ Unknown template key(s): ${unknown.join(', ')}`)
      process.exit(1)
    }
    console.log(`🌱 Seeding ${selected.length} selected email template(s)...`)
  } else {
    console.log('🌱 Seeding email templates...')
  }

  for (const template of selected) {
    console.log(`  ✓ Creating template: ${template.name}`)

    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      update: {
        name: template.name,
        subject: template.subject,
        html: template.html,
        text: template.text,
        variables: template.variables,
        category: template.category,
        isActive: true,
      },
      create: {
        key: template.key,
        name: template.name,
        subject: template.subject,
        html: template.html,
        text: template.text,
        variables: template.variables,
        category: template.category,
        isActive: true,
        sentCount: 0,
      },
    })
  }

  console.log(`\n✅ Successfully seeded ${selected.length} email templates!`)
  
  // Display summary
  const counts = await prisma.emailTemplate.groupBy({
    by: ['category'],
    _count: true,
  })
  
  console.log('\n📊 Template Summary:')
  counts.forEach(({ category, _count }) => {
    console.log(`  ${category}: ${_count} templates`)
  })
}

main()
  .catch((e) => {
    console.error('❌ Error seeding email templates:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
