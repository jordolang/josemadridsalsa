/**
 * Seed Email Templates
 * Populates the database with professional email templates
 */

import { PrismaClient } from '@prisma/client'
import { emailTemplates } from '../lib/email/template-library'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding email templates...')

  for (const template of emailTemplates) {
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

  console.log(`\n✅ Successfully seeded ${emailTemplates.length} email templates!`)
  
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
