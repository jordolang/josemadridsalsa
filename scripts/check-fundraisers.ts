import prisma from '@/lib/prisma'

async function main() {
  const now = new Date()
  const future = new Date(Date.UTC(2026, 11, 31, 23, 59, 59))

  const updated = await prisma.fundraiser.updateMany({
    where: { isActive: true, status: 'ACTIVE', endDate: { lt: now } },
    data: { endDate: future },
  })
  console.log(`Extended ${updated.count} expired active campaigns to ${future.toISOString()}`)

  const all = await prisma.fundraiser.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      isActive: true,
      startDate: true,
      endDate: true,
      logoUrl: true,
      coverPhotoUrl: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })
  const active = all.filter(
    (f) =>
      f.isActive &&
      f.status === 'ACTIVE' &&
      f.startDate <= now &&
      f.endDate >= now,
  )
  console.log(
    JSON.stringify(
      { now: now.toISOString(), total: all.length, activeCount: active.length, rows: all },
      null,
      2,
    ),
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
