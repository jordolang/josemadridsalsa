/**
 * Removes every fundraiser row created by seed-fundraiser-demo.ts.
 *
 * Identifies demo rows by the `demo-` slug prefix (and, for sale events,
 * the matching `demo-` orderId prefix). Pure delete — safe to run repeatedly.
 *
 * Run: pnpm db:cleanup:fundraiser
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const demoTeams = await prisma.fundraiserTeam.findMany({
    where: { slug: { startsWith: 'demo-' } },
    select: { id: true, slug: true },
  })
  if (demoTeams.length === 0) {
    console.log('No demo- teams found. Nothing to clean up.')
    return
  }

  const teamIds = demoTeams.map((t) => t.id)

  const [shields, saleEvents, shareEvents, characters, teams] = await Promise.all([
    prisma.fundraiserShield.deleteMany({ where: { teamId: { in: teamIds } } }),
    prisma.fundraiserSaleEvent.deleteMany({ where: { teamId: { in: teamIds } } }),
    prisma.fundraiserShareEvent.deleteMany({ where: { teamId: { in: teamIds } } }),
    prisma.fundraiserCharacter.deleteMany({ where: { teamId: { in: teamIds } } }),
    prisma.fundraiserTeam.deleteMany({ where: { id: { in: teamIds } } }),
  ])

  console.log(
    `Removed: ${teams.count} team(s), ${characters.count} character(s), ${saleEvents.count} sale(s), ${shareEvents.count} share(s), ${shields.count} shield(s).`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
