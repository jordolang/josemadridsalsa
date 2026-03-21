import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding default SMTP config...')

  const defaultEmail = 'mike@josemadridsalsa.com'

  // Upsert the default EmailConfiguration
  const emailConfig = await prisma.emailConfiguration.upsert({
    where: { 
      // We don't have a unique constraint on name or fromEmail in this snippet, 
      // but let's check if there is an existing one. If not, we can create one.
      // Wait, there is no unique constraint we know of. Let's just findFirst,
      // and if it doesn't exist, create it.
      id: "default-smtp-config" // we can pass an ID or just check 
    },
    update: {
      name: 'Primary SMTP (Mike)',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUsername: defaultEmail,
      smtpPassword: 'YOUR_APP_PASSWORD_HERE', // Placeholder
      smtpSecure: false,
      fromEmail: defaultEmail,
      fromName: 'Mike @ JMS',
      replyToEmail: defaultEmail,
      isDefault: true,
      isActive: true,
      useResend: false,
    },
    create: {
      id: "default-smtp-config",
      name: 'Primary SMTP (Mike)',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUsername: defaultEmail,
      smtpPassword: 'YOUR_APP_PASSWORD_HERE', // Placeholder
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

