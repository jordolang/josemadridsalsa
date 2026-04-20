import prisma from '@/lib/prisma'

async function main() {
  const slug = process.argv[2]
  if (!slug) {
    console.error('Usage: tsx scripts/activate-arena-team.ts <slug>')
    process.exit(1)
  }

  const before = await prisma.fundraiserTeam.findUnique({
    where: { slug },
    select: { id: true, status: true },
  })
  if (!before) {
    console.error(`No FundraiserTeam with slug "${slug}"`)
    process.exit(1)
  }
  if (before.status === 'ACTIVE') {
    console.log(`Already ACTIVE — no change.`)
    return
  }

  const after = await prisma.fundraiserTeam.update({
    where: { slug },
    data: { status: 'ACTIVE' },
    select: { slug: true, status: true, name: true },
  })
  console.log(`Activated: ${after.name} (${after.slug}) → ${after.status}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
