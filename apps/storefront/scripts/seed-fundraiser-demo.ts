/**
 * Idempotent demo seeder for the fundraiser battle arena.
 *
 * Creates a handful of ACTIVE FundraiserTeam rows (all slug-prefixed with
 * `demo-`) plus FundraiserCharacter + FundraiserSaleEvent + FundraiserShield
 * rows so the /fundraise/[slug] and /arena/[period] pages have something
 * to render.
 *
 * Run:    pnpm db:seed:fundraiser
 * Undo:   pnpm db:cleanup:fundraiser
 */

import { PrismaClient } from '@prisma/client'
import { randomBytes, createHmac } from 'crypto'

const prisma = new PrismaClient()

function currentPeriod(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function hashApiKey(raw: string): string {
  const secret = process.env.FUNDRAISER_API_SECRET
  if (!secret) {
    throw new Error(
      'FUNDRAISER_API_SECRET must be set — required to hash fundraiser API keys.',
    )
  }
  return createHmac('sha256', secret).update(raw).digest('hex')
}

function makeApiKey(): { raw: string; hash: string } {
  const raw = `jms_live_${randomBytes(32).toString('hex')}`
  return { raw, hash: hashApiKey(raw) }
}

type SeedCharacter = {
  characterName: string
  characterClass: string
  gender: string
  skinColor: string
  hairColor: string
  quips: string[]
}

type SeedTeam = {
  slug: string
  name: string
  school: string
  teamColor: string
  teamColorDark: string
  goalAmount: number
  pricePerUnit: number
  contactName: string
  contactEmail: string
  characters: SeedCharacter[]
}

const TEAMS: SeedTeam[] = [
  {
    slug: 'demo-west-m-tornados',
    name: 'West M Tornados',
    school: 'West Muskingum HS',
    teamColor: '#9955FF',
    teamColorDark: '#452E7F',
    goalAmount: 1500,
    pricePerUnit: 10,
    contactName: 'Coach Miller',
    contactEmail: 'demo-tornados@josemadridsalsa.example',
    characters: [
      { characterName: 'Captain Vortex', characterClass: 'warrior', gender: 'm', skinColor: '#8B5E3C', hairColor: '#1A0A00', quips: ['Spin to win!', "I'll blow you away!"] },
      { characterName: 'Gale', characterClass: 'mage', gender: 'f', skinColor: '#D9A878', hairColor: '#C6895A', quips: ['Elements at my side', "Feel the storm!"] },
      { characterName: 'Zephyr', characterClass: 'archer', gender: 'm', skinColor: '#643B1A', hairColor: '#222222', quips: ['Never miss', 'Category 5, baby'] },
      { characterName: 'Breeze', characterClass: 'rogue', gender: 'f', skinColor: '#F1C9A5', hairColor: '#6B3A1F', quips: ['Blink and miss me', 'Faster than you can react'] },
    ],
  },
  {
    slug: 'demo-tri-valley-scotties',
    name: 'Tri-Valley Scotties',
    school: 'Tri-Valley HS',
    teamColor: '#DDAA00',
    teamColorDark: '#8B6A00',
    goalAmount: 1200,
    pricePerUnit: 10,
    contactName: 'Coach Bennett',
    contactEmail: 'demo-scotties@josemadridsalsa.example',
    characters: [
      { characterName: 'Terrier Prime', characterClass: 'paladin', gender: 'm', skinColor: '#8B5E3C', hairColor: '#E4B04A', quips: ['Woof. You done?', 'Terrier-ifying!'] },
      { characterName: 'Barkley', characterClass: 'warrior', gender: 'm', skinColor: '#A67244', hairColor: '#2E1A0D', quips: ['Sit. Stay. Lose.', 'These paws hit HARD'] },
      { characterName: 'Piper', characterClass: 'rogue', gender: 'f', skinColor: '#ECC39E', hairColor: '#311B0A', quips: ['Good girl', "Who's a winner?"] },
      { characterName: 'Biscuit', characterClass: 'berserker', gender: 'm', skinColor: '#C68955', hairColor: '#000000', quips: ['Rrrrrrruff', 'Fetch this!'] },
    ],
  },
  {
    slug: 'demo-central-coyotes',
    name: 'Central Coyotes',
    school: 'Central HS',
    teamColor: '#E35D5B',
    teamColorDark: '#7A2826',
    goalAmount: 2000,
    pricePerUnit: 10,
    contactName: 'Coach Diaz',
    contactEmail: 'demo-coyotes@josemadridsalsa.example',
    characters: [
      { characterName: 'Howl', characterClass: 'berserker', gender: 'm', skinColor: '#6B3A1F', hairColor: '#1A0A00', quips: ['AHOOOO!', 'Pack up'] },
      { characterName: 'Sage', characterClass: 'mage', gender: 'f', skinColor: '#D9A878', hairColor: '#3A2616', quips: ['Desert magic', 'I conjure victory'] },
      { characterName: 'Cactus', characterClass: 'paladin', gender: 'm', skinColor: '#8B5E3C', hairColor: '#5A3A22', quips: ['Prickly defense', 'Not today'] },
    ],
  },
  {
    slug: 'demo-harmony-choir',
    name: 'Harmony Choir',
    school: 'Easton Arts Academy',
    teamColor: '#22C55E',
    teamColorDark: '#14532D',
    goalAmount: 1800,
    pricePerUnit: 10,
    contactName: 'Ms. Song',
    contactEmail: 'demo-choir@josemadridsalsa.example',
    characters: [
      { characterName: 'Crescendo', characterClass: 'mage', gender: 'f', skinColor: '#F1C9A5', hairColor: '#6B3A1F', quips: ['The high note', 'Feel the harmony'] },
      { characterName: 'Tenor', characterClass: 'paladin', gender: 'm', skinColor: '#8B5E3C', hairColor: '#1A0A00', quips: ['Hold the line', 'One voice'] },
      { characterName: 'Allegro', characterClass: 'rogue', gender: 'f', skinColor: '#ECC39E', hairColor: '#5A3A22', quips: ['Fast tempo', 'Keep up if you can'] },
    ],
  },
]

type SeedSale = {
  teamSlug: string
  amount: number
  donorName: string | null
  donorEmail: string | null
  donorComment: string | null
  isAnonymous: boolean
  ageHours: number
}

const SALES: SeedSale[] = [
  { teamSlug: 'demo-west-m-tornados', amount: 50, donorName: 'Leslie Alexander', donorEmail: 'leslie@example.com', donorComment: 'This is SUCH a cool cause! Glad I can help you reach your goal!', isAnonymous: false, ageHours: 0.25 },
  { teamSlug: 'demo-west-m-tornados', amount: 250, donorName: 'James McElroy', donorEmail: 'james@example.com', donorComment: "Let's GOOOoooOOoo!!", isAnonymous: false, ageHours: 1 },
  { teamSlug: 'demo-west-m-tornados', amount: 50, donorName: 'Dianne Russell', donorEmail: 'dianne@example.com', donorComment: 'I knew that ya\'ll would be changing the world!', isAnonymous: false, ageHours: 0.08 },
  { teamSlug: 'demo-tri-valley-scotties', amount: 100, donorName: null, donorEmail: null, donorComment: null, isAnonymous: true, ageHours: 2 },
  { teamSlug: 'demo-tri-valley-scotties', amount: 25, donorName: 'Matthew Choi', donorEmail: 'matthew@example.com', donorComment: 'Proud alum, keep it up!', isAnonymous: false, ageHours: 4 },
  { teamSlug: 'demo-central-coyotes', amount: 500, donorName: 'Sandra Henderson', donorEmail: 'sandra@example.com', donorComment: 'Big push — go team!', isAnonymous: false, ageHours: 6 },
  { teamSlug: 'demo-central-coyotes', amount: 10, donorName: 'Riley Patel', donorEmail: 'riley@example.com', donorComment: null, isAnonymous: false, ageHours: 3 },
  { teamSlug: 'demo-harmony-choir', amount: 75, donorName: 'Taylor Brooks', donorEmail: 'taylor@example.com', donorComment: 'Your solos make me cry in the good way.', isAnonymous: false, ageHours: 0.5 },
  { teamSlug: 'demo-harmony-choir', amount: 100, donorName: null, donorEmail: null, donorComment: null, isAnonymous: true, ageHours: 5 },
  { teamSlug: 'demo-harmony-choir', amount: 40, donorName: 'Amelia Wu', donorEmail: 'amelia@example.com', donorComment: 'Break a leg at regionals!', isAnonymous: false, ageHours: 8 },
]

async function main() {
  const period = currentPeriod()
  console.log(`Seeding demo fundraiser teams for period ${period}`)

  const issuedKeys: Array<{ slug: string; rawKey: string }> = []

  for (const t of TEAMS) {
    const existing = await prisma.fundraiserTeam.findUnique({
      where: { slug: t.slug },
    })

    let team = existing

    if (!existing) {
      const { raw, hash } = makeApiKey()
      team = await prisma.fundraiserTeam.create({
        data: {
          slug: t.slug,
          name: t.name,
          school: t.school,
          activePeriod: period,
          status: 'ACTIVE',
          teamColor: t.teamColor,
          teamColorDark: t.teamColorDark,
          goalAmount: t.goalAmount,
          hpCurrent: t.goalAmount,
          // The campaign owns the store: the catalog, the price per jar and the split.
          fundraiser: {
            create: {
              name: t.name,
              slug: t.slug,
              organizationName: t.school,
              contactEmail: t.contactEmail,
              startDate: new Date(),
              endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              goal: t.goalAmount,
              defaultUnitPrice: t.pricePerUnit,
              status: 'ACTIVE',
              isActive: true,
            },
          },
          contactName: t.contactName,
          contactEmail: t.contactEmail,
          apiKeyHash: hash,
          apiKeyIssuedAt: new Date(),
          approvedBy: 'seed:fundraiser-demo',
          approvedAt: new Date(),
        },
      })
      issuedKeys.push({ slug: t.slug, rawKey: raw })
      console.log(`  + created team ${t.slug}`)
    } else {
      console.log(`  = team ${t.slug} already exists, skipping create`)
    }

    if (!team) continue

    const existingCharacters = await prisma.fundraiserCharacter.count({
      where: { teamId: team.id },
    })
    if (existingCharacters === 0) {
      await prisma.fundraiserCharacter.createMany({
        data: t.characters.map((c, i) => ({
          teamId: team.id,
          characterName: c.characterName,
          characterClass: c.characterClass,
          gender: c.gender,
          skinColor: c.skinColor,
          hairColor: c.hairColor,
          position: i,
          quips: c.quips,
        })),
      })
      console.log(`    + ${t.characters.length} characters`)
    } else {
      console.log(`    = ${existingCharacters} characters already present, skipping`)
    }
  }

  const teamBySlug = new Map<string, { id: string }>()
  for (const team of await prisma.fundraiserTeam.findMany({
    where: { slug: { startsWith: 'demo-' } },
    select: { id: true, slug: true },
  })) {
    teamBySlug.set(team.slug, { id: team.id })
  }

  for (const sale of SALES) {
    const team = teamBySlug.get(sale.teamSlug)
    if (!team) continue
    const orderId = `demo-${sale.teamSlug}-${Math.round(sale.amount * 100)}-${sale.ageHours}`
    const existing = await prisma.fundraiserSaleEvent.findUnique({
      where: { orderId },
    })
    if (existing) continue
    const createdAt = new Date(Date.now() - sale.ageHours * 60 * 60 * 1000)
    await prisma.fundraiserSaleEvent.create({
      data: {
        teamId: team.id,
        orderId,
        amount: sale.amount,
        donorName: sale.donorName,
        donorEmail: sale.donorEmail,
        donorComment: sale.donorComment,
        isAnonymous: sale.isAnonymous,
        createdAt,
      },
    })
    await prisma.fundraiserTeam.update({
      where: { id: team.id },
      data: { salesCount: { increment: 1 } },
    })
  }

  // Drop an active shield on the Scotties so the visuals show both states.
  const scotties = teamBySlug.get('demo-tri-valley-scotties')
  if (scotties) {
    const activeShield = await prisma.fundraiserShield.findFirst({
      where: { teamId: scotties.id, expiresAt: { gt: new Date() } },
    })
    if (!activeShield) {
      await prisma.fundraiserShield.create({
        data: {
          teamId: scotties.id,
          activatedAt: new Date(),
          expiresAt: new Date(Date.now() + 25 * 60 * 1000),
          remainingHP: 30,
        },
      })
      console.log('  + active shield on demo-tri-valley-scotties')
    }
  }

  if (issuedKeys.length > 0) {
    console.log('\nNew API keys (save these — not retrievable later):')
    for (const k of issuedKeys) {
      console.log(`  ${k.slug}: ${k.rawKey}`)
    }
  }

  console.log('\nDone. Try the pages:')
  console.log(`  /arena/${period}`)
  for (const t of TEAMS) {
    console.log(`  /fundraise/${t.slug}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
