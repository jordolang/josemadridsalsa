'use server'
// Social features server actions
// The primary message board uses /api/fundraisers/[slug]/messages directly

export async function getFundraiserTimeline(_fundraiserSlug: string) {
  return { 
    timelineEvents: [] as any[],
    goal: null as number | null,
    currentTotal: 0,
    enableSocialFeatures: true,
  }
}

export async function getFundraiserHeavyHitters(_fundraiserSlug: string) {
  return [] as any[]
}

export async function postSupportMessage(_data: {
  fundraiserSlug: string
  content: string
  authorName?: string
}, _userId?: string) {
  return { success: false, error: 'Use /api/fundraisers/[slug]/messages instead' }
}

export async function getMonthlyChampionship(_month?: number, _year?: number) {
  return { championship: null, leaders: [] as any[] }
}
