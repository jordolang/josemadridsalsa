import { beforeEach, describe, expect, it, vi } from 'vitest'

const auditLogCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { create: auditLogCreate } },
  default: { auditLog: { create: auditLogCreate } },
}))

const { getRequestMetadata, logAudit, logAuditWithRequest, createChangeSnapshot } = await import(
  '@/lib/audit'
)

const requestWith = (headers: Record<string, string>) =>
  new Request('https://example.com/api/admin/refunds', { headers })

describe('getRequestMetadata', () => {
  it('reads the client IP and user agent', () => {
    expect(
      getRequestMetadata(requestWith({ 'x-forwarded-for': '1.2.3.4', 'user-agent': 'jest' }))
    ).toEqual({ ipAddress: '1.2.3.4', userAgent: 'jest' })
  })

  it('takes the first hop of a forwarded chain', () => {
    expect(getRequestMetadata(requestWith({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })).ipAddress).toBe(
      '1.2.3.4'
    )
  })

  it('falls back to x-real-ip', () => {
    expect(getRequestMetadata(requestWith({ 'x-real-ip': '9.9.9.9' })).ipAddress).toBe('9.9.9.9')
  })

  it('returns nulls when there is no request at all', () => {
    expect(getRequestMetadata()).toEqual({ ipAddress: null, userAgent: null })
  })

  it('returns nulls rather than throwing on a request with no usable headers', () => {
    // Audit logging runs after the operation it records has already happened, so a
    // malformed request must cost us the IP address, never the operation.
    expect(getRequestMetadata({} as never)).toEqual({ ipAddress: null, userAgent: null })
    expect(getRequestMetadata({ headers: undefined } as never)).toEqual({
      ipAddress: null,
      userAgent: null,
    })
  })
})

describe('logAudit', () => {
  beforeEach(() => {
    auditLogCreate.mockReset()
    auditLogCreate.mockResolvedValue({})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('writes the entry', async () => {
    await logAudit({
      userId: 'user_1',
      action: 'refund',
      entityType: 'payment',
      entityId: 'pay_1',
      changes: { amount: 500 },
    })

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        action: 'refund',
        entityType: 'payment',
        entityId: 'pay_1',
        changes: { amount: 500 },
        ipAddress: null,
        userAgent: null,
      },
    })
  })

  it('never throws when the write fails', async () => {
    auditLogCreate.mockRejectedValue(new Error('db down'))

    await expect(logAudit({ action: 'refund' })).resolves.toBeUndefined()
  })
})

describe('logAuditWithRequest', () => {
  beforeEach(() => {
    auditLogCreate.mockReset()
    auditLogCreate.mockResolvedValue({})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('attaches request metadata to the entry', async () => {
    await logAuditWithRequest(
      { userId: 'user_1', action: 'refund', entityType: 'payment', entityId: 'pay_1' },
      requestWith({ 'x-forwarded-for': '1.2.3.4', 'user-agent': 'jest' })
    )

    expect(auditLogCreate.mock.calls[0][0].data).toMatchObject({
      ipAddress: '1.2.3.4',
      userAgent: 'jest',
    })
  })

  it('never throws on a malformed request', async () => {
    // Regression: getRequestMetadata used to run outside any try/catch, so a request
    // object without headers turned a completed refund into a 500 for the caller.
    await expect(
      logAuditWithRequest({ action: 'refund', entityType: 'payment' }, {} as never)
    ).resolves.toBeUndefined()

    expect(auditLogCreate).toHaveBeenCalledTimes(1)
  })

  it('never throws when the write itself fails', async () => {
    auditLogCreate.mockRejectedValue(new Error('db down'))

    await expect(
      logAuditWithRequest({ action: 'refund' }, requestWith({ 'user-agent': 'jest' }))
    ).resolves.toBeUndefined()
  })
})

describe('createChangeSnapshot', () => {
  it('records a creation when there is no prior state', () => {
    expect(createChangeSnapshot(null, { name: 'Mild' })).toEqual({
      type: 'create',
      after: { name: 'Mild' },
    })
  })

  it('records only the fields that changed', () => {
    expect(createChangeSnapshot({ name: 'Mild', price: 5 }, { name: 'Hot', price: 5 })).toEqual({
      type: 'update',
      changes: { name: { from: 'Mild', to: 'Hot' } },
    })
  })

  it('notices fields that were added or removed', () => {
    expect(createChangeSnapshot({ name: 'Mild' }, { name: 'Mild', sku: 'JMS-1' })).toEqual({
      type: 'update',
      changes: { sku: { from: undefined, to: 'JMS-1' } },
    })
  })
})
