import prisma from '@/lib/prisma'

async function main() {
  const slug = process.argv[2] || 'spring-band-fundraiser'
  const team = await prisma.fundraiserTeam.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      school: true,
      status: true,
      activePeriod: true,
      teamColor: true,
      teamColorDark: true,
      goalAmount: true,
      hpCurrent: true,
      salesCount: true,
      pricePerUnit: true,
      seasonId: true,
    },
  })
  console.log(JSON.stringify({ slug, team }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
