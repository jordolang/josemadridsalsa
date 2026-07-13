/**
 * Fundraiser-organization targeting.
 *
 * The FUNDRAISER_ORG lead type casts a wide net over any entity that typically
 * runs fundraisers — booster clubs, PTA/PTO, youth sports leagues, marching
 * bands, scouts, dance/cheer/gymnastics teams, churches, nonprofits, and the
 * like — not just schools. Each category is a set of Google Maps search phrases
 * with {city}/{state} placeholders that the search stage expands per campaign.
 */

export interface FundraiserCategory {
  /** Value stored on the lead / campaign and shown in the UI. */
  label: string
  /** Query phrases; {city} and {state} are substituted at search time. */
  queries: string[]
}

export const FUNDRAISER_CATEGORIES: FundraiserCategory[] = [
  {
    label: 'Youth Sports Leagues',
    queries: [
      'youth sports league {city} {state}',
      'little league baseball {city} {state}',
      'youth soccer club {city} {state}',
      'travel sports team {city} {state}',
    ],
  },
  {
    label: 'Booster Clubs & PTA/PTO',
    queries: [
      'school booster club {city} {state}',
      'athletic booster club {city} {state}',
      'PTA PTO {city} {state}',
    ],
  },
  {
    label: 'Bands & Performing Arts',
    queries: [
      'marching band boosters {city} {state}',
      'music boosters {city} {state}',
      'community theater {city} {state}',
    ],
  },
  {
    label: 'Cheer, Dance & Gymnastics',
    queries: [
      'cheerleading team {city} {state}',
      'dance studio {city} {state}',
      'gymnastics gym {city} {state}',
    ],
  },
  {
    label: 'Scouts & Youth Clubs',
    queries: [
      'boy scouts troop {city} {state}',
      'girl scouts {city} {state}',
      '4-H club {city} {state}',
    ],
  },
  {
    label: 'Churches & Faith Groups',
    queries: [
      'church youth group {city} {state}',
      'church {city} {state}',
    ],
  },
  {
    label: 'Nonprofits & Charities',
    queries: [
      'nonprofit organization {city} {state}',
      'charity {city} {state}',
      'animal rescue shelter {city} {state}',
    ],
  },
  {
    label: 'Schools & Preschools',
    queries: [
      'preschool daycare {city} {state}',
      'elementary school {city} {state}',
    ],
  },
  {
    label: 'Civic & Community',
    queries: [
      'volunteer fire department {city} {state}',
      'community center {city} {state}',
    ],
  },
]

/** Flat list of every query phrase, used when no specific category is chosen. */
export const ALL_FUNDRAISER_QUERIES: string[] = FUNDRAISER_CATEGORIES.flatMap(
  (c) => c.queries
)

export function fundraiserQueriesForCategory(category?: string | null): string[] {
  if (!category) return ALL_FUNDRAISER_QUERIES
  const match = FUNDRAISER_CATEGORIES.find(
    (c) => c.label.toLowerCase() === category.toLowerCase()
  )
  return match ? match.queries : ALL_FUNDRAISER_QUERIES
}

/** Contact titles common at fundraiser-running organizations. */
export const FUNDRAISER_TITLE_PATTERNS: [string, RegExp][] = [
  ['President', /president|chairperson|\bchair\b/i],
  ['Treasurer', /treasurer|finance/i],
  ['Fundraising Coordinator', /fundrais(?:ing|er)\s+(?:coordinator|chair|director)|fundrais(?:ing|er)/i],
  ['Booster President', /booster/i],
  ['PTA President', /pta|pto|parent[-\s]?teacher/i],
  ['Director', /director|executive\s+director/i],
  ['Coordinator', /coordinator|organizer/i],
  ['Coach', /coach|head\s+coach/i],
  ['Pastor', /pastor|reverend|minister|youth\s+pastor/i],
  ['Troop Leader', /troop\s+leader|scoutmaster|den\s+leader/i],
  ['Secretary', /secretary/i],
  ['Board Member', /board\s+member|trustee/i],
]
