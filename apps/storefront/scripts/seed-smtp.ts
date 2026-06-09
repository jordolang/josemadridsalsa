import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding default SMTP config...')

  const defaultEmail = 'mike@josemadridsalsa.com'

  // Upsert the default EmailConfiguration
  // Password left null — must be set via admin UI (where it gets encrypted)
  const emailConfig = await prisma.emailConfiguration.upsert({
    where: { id: 'default-smtp-config' },
    update: {
      name: 'Primary SMTP (Mike)',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUsername: defaultEmail,
      smtpSecure: false,
      fromEmail: defaultEmail,
      fromName: 'Mike @ JMS',
      replyToEmail: defaultEmail,
      isDefault: true,
      isActive: true,
      useResend: false,
    },
    create: {
      id: 'default-smtp-config',
      name: 'Primary SMTP (Mike)',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUsername: defaultEmail,
      smtpPassword: null,
      smtpSecure: false,
      fromEmail: defaultEmail,
      fromName: 'Mike @ JMS',
      replyToEmail: defaultEmail,
      isDefault: true,
      isActive: true,
      useResend: false,
    },
  })

  // Set any other existing configurations to not be default
  await prisma.emailConfiguration.updateMany({
    where: {
      id: { not: emailConfig.id },
      isDefault: true,
    },
    data: {
      isDefault: false,
    },
  })

  console.log(`Successfully seeded SMTP settings for ${defaultEmail}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

