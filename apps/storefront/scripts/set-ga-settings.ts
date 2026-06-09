import prisma from '@/lib/prisma'

const MEASUREMENT_ID = 'G-41VW8RHTM0'
const PROPERTY_ID = '531121261'
const DATA_STREAM_ID = '14301098356'

async function main() {
  const existing = await prisma.analyticsSetting.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  const record = existing
    ? await prisma.analyticsSetting.update({
        where: { id: existing.id },
        data: {
          measurementId: MEASUREMENT_ID,
          propertyId: PROPERTY_ID,
          dataStreamId: DATA_STREAM_ID,
        },
        select: { id: true, measurementId: true, propertyId: true, dataStreamId: true },
      })
    : await prisma.analyticsSetting.create({
        data: {
          measurementId: MEASUREMENT_ID,
          propertyId: PROPERTY_ID,
          dataStreamId: DATA_STREAM_ID,
        },
        select: { id: true, measurementId: true, propertyId: true, dataStreamId: true },
      })

  console.log('AnalyticsSetting updated:', record)
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
