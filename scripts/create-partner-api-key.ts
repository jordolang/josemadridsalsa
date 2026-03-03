import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { hashApiKey } from '@/lib/api/api-key-utils'

const prisma = new PrismaClient()

function parseArgs() {
  const [, , nameArg, ...rest] = process.argv
  if (!nameArg) {
    throw new Error('Usage: npm run api-keys:create -- <Partner Name> [--user=email] [--scopes=forms:read,forms:write]')
  }
  const options: { name: string; userEmail?: string; scopes?: string[] } = { name: nameArg }
  rest.forEach((arg) => {
    if (arg.startsWith('--user=')) {
      options.userEmail = arg.replace('--user=', '').trim()
    } else if (arg.startsWith('--scopes=')) {
      const scopes = arg.replace('--scopes=', '').trim()
      options.scopes = scopes.split(',').map((scope) => scope.trim()).filter(Boolean)
    }
  })
  return options
}

async function main() {
  const { name, userEmail, scopes } = parseArgs()

  let userId: string | undefined
  if (userEmail) {
    const user = await prisma.user.findUnique({ where: { email: userEmail.toLowerCase().trim() } })
    if (!user) {
      throw new Error(`User with email ${userEmail} not found`)
    }
    userId = user.id
  }

  const rawKey = crypto.randomBytes(32).toString('hex')
  const keyHash = hashApiKey(rawKey)

  await prisma.partnerApiKey.create({
    data: {
      name,
      keyHash,
      scopes: scopes && scopes.length > 0 ? scopes : ['forms:read', 'forms:write'],
      userId,
    },
  })

  console.log('Created API key for', name)
  if (userEmail) {
    console.log(`Linked to user: ${userEmail}`)
  }
  console.log('Store this key securely. It will not be shown again:')
  console.log(rawKey)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
