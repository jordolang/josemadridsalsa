import { beforeEach, describe, expect, it, vi } from 'vitest'

const runReport = vi.fn()

vi.mock('@google-analytics/data', () => ({
  BetaAnalyticsDataClient: class {
    runReport = runReport
  },
}))
vi.mock('google-auth-library', () => ({
  UserRefreshClient: class {},
}))
vi.mock('@/lib/google-analytics-config', () => ({
  getGoogleAnalyticsSettings: vi.fn().mockResolvedValue({ propertyId: '123456789', chartDefinitions: [] }),
}))
vi.mock('@/lib/service-keys', () => ({
  hasActiveServiceKey: vi.fn().mockResolvedValue(true),
  getDecryptedServiceKeyValue: vi.fn().mockResolvedValue(
    JSON.stringify({ type: 'authorized_user', client_id: 'id', client_secret: 'secret', refresh_token: 'token' }),
  ),
}))

import { describeGoogleAnalyticsError, getGoogleAnalyticsDashboard } from '@/lib/google-analytics-reports'

const INVALID_RAPT =
  '400 undefined: Getting metadata from plugin failed with error: {"error":"invalid_grant","error_description":"reauth related error (invalid_rapt)"}'

describe('describeGoogleAnalyticsError', () => {
  it('tells the admin to replace the credential when Google rejects it', () => {
    expect(describeGoogleAnalyticsError(new Error(INVALID_RAPT))).toMatch(/expired or been revoked/)
  })

  it('falls back to the generic message for other failures', () => {
    expect(describeGoogleAnalyticsError(new Error('PERMISSION_DENIED'))).toBe(
      'Failed to load Google Analytics data. Check logs for details.',
    )
  })
})

describe('getGoogleAnalyticsDashboard', () => {
  beforeEach(() => {
    runReport.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('surfaces an expired credential instead of an empty dashboard', async () => {
    runReport.mockRejectedValue(new Error(INVALID_RAPT))

    const dashboard = await getGoogleAnalyticsDashboard('30d')

    expect(dashboard.status).toBe('error')
    expect(dashboard.summaryCards).toEqual([])
    expect(dashboard.message).toMatch(/google_analytics \/ service_account/)
  })
})
