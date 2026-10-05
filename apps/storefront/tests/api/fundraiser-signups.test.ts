import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/fundraiser-signups/route'

// Mock dependencies
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/engagements', () => ({
  logEngagementRequest: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('@/lib/email/automation', () => ({
  sendFundraiserFollowupEmail: vi.fn(),
}))

vi.mock('@/lib/email/sender', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/customers/ensure-account', () => ({
  ensureCustomerAccount: vi.fn().mockResolvedValue('customer-1'),
  splitName: (name: string) => {
    const [firstName = null, ...rest] = name.split(' ')
    return { firstName, lastName: rest.join(' ') || null }
  },
}))

describe('Fundraiser Signups API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/fundraiser-signups', () => {
    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid fundraiser signup data.')
    })

    it('should require valid contact name', async () => {
      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'A', // Too short
          organizationName: 'Test Org',
          email: 'test@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid fundraiser signup data.')
    })

    it('should require valid organization name', async () => {
      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'X', // Too short
          email: 'test@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid fundraiser signup data.')
    })

    it('should require valid email address', async () => {
      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'invalid-email',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid fundraiser signup data.')
    })

    it('should normalize email to lowercase', async () => {
      const { logEngagementRequest } = await import('@/lib/engagements')

      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'TEST@EXAMPLE.COM',
        }),
      })

      await POST(request)

      expect(logEngagementRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        })
      )
    })

    it('should accept optional fields', async () => {
      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'test@example.com',
          phone: '555-1234',
          fundraisingGoal: '$10,000',
          message: 'We would like to partner for our fundraiser.',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should log engagement request with correct data', async () => {
      const { logEngagementRequest } = await import('@/lib/engagements')

      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'test@example.com',
          phone: '555-1234',
          fundraisingGoal: '$10,000',
          message: 'Test message',
        }),
      })

      await POST(request)

      expect(logEngagementRequest).toHaveBeenCalledWith({
        type: 'FUNDRAISER',
        email: 'test@example.com',
        name: 'John Doe',
        source: 'site:fundraising',
        metadata: {
          organization: 'Test Organization',
          phone: '555-1234',
          fundraisingGoal: '$10,000',
          message: 'Test message',
        },
      })
    })

    it('should send followup email to contact', async () => {
      const { sendFundraiserFollowupEmail } = await import('@/lib/email/automation')

      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'test@example.com',
          fundraisingGoal: '$10,000',
        }),
      })

      await POST(request)

      expect(sendFundraiserFollowupEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        contactName: 'John Doe',
        organizationName: 'Test Organization',
        goal: '$10,000',
      })
    })

    it('should send notification email to fundraising inbox', async () => {
      const { sendEmail } = await import('@/lib/email/sender')

      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'test@example.com',
          phone: '555-1234',
          fundraisingGoal: '$10,000',
          message: 'Test message',
        }),
      })

      await POST(request)

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'mike@josemadridsalsa.com',
          subject: expect.stringContaining('Test Organization'),
        })
      )
    })

    it('should log audit trail for signup', async () => {
      const { logAudit } = await import('@/lib/audit')

      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'test@example.com',
          phone: '555-1234',
          fundraisingGoal: '$10,000',
          message: 'Test message',
        }),
      })

      await POST(request)

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entityType: 'FundraiserSignup',
          entityId: 'test@example.com',
          changes: expect.objectContaining({
            contactName: 'John Doe',
            organizationName: 'Test Organization',
            email: 'test@example.com',
          }),
        })
      )
    })

    it('should track authenticated user in audit log', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { logAudit } = await import('@/lib/audit')

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
      })

      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'test@example.com',
        }),
      })

      await POST(request)

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          changes: expect.objectContaining({
            isAuthenticated: true,
          }),
        })
      )
    })

    it('should handle unauthenticated submissions', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { logAudit } = await import('@/lib/audit')

      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'test@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          changes: expect.objectContaining({
            isAuthenticated: false,
          }),
        })
      )
    })

    it('should return 500 on unexpected error', async () => {
      const { logEngagementRequest } = await import('@/lib/engagements')

      vi.mocked(logEngagementRequest).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/fundraiser-signups', {
        method: 'POST',
        body: JSON.stringify({
          contactName: 'John Doe',
          organizationName: 'Test Organization',
          email: 'test@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Unable to submit')
    })
  })
})
