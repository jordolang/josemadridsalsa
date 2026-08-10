import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The automation CRUD behind the admin builder.
 *
 * The step order is the part worth protecting: the engine walks `steps[currentStep]` by index, so
 * the `order` written here is what decides which email a customer gets second. It is derived from
 * array position rather than trusted from the client, and nothing else in the system would notice
 * if that silently stopped being true — the series would simply send in the wrong sequence.
 */

const getCurrentUser = vi.fn()
const hasPermission = vi.fn()
const automationCreate = vi.fn()
const automationFindMany = vi.fn()
const logAuditWithRequest = vi.fn()

vi.mock('@/lib/rbac', () => ({ getCurrentUser, hasPermission }))
vi.mock('@/lib/audit', () => ({ logAuditWithRequest }))

vi.mock('@/lib/prisma', () => {
  const client = {
    emailAutomation: { create: automationCreate, findMany: automationFindMany },
  }
  return { prisma: client, default: client }
})

const { GET, POST } = await import('@/app/api/admin/automations/route')

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/admin/automations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validAutomation = {
  name: 'Post-purchase series',
  trigger: 'ORDER_PLACED',
  steps: [
    { templateId: 'tmpl_thanks', delayHours: 0 },
    { templateId: 'tmpl_recipes', delayHours: 72 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUser.mockResolvedValue({ id: 'admin_1' })
  hasPermission.mockResolvedValue(true)
  automationFindMany.mockResolvedValue([])
  automationCreate.mockResolvedValue({
    id: 'auto_1',
    name: 'Post-purchase series',
    trigger: 'ORDER_PLACED',
    steps: [],
  })
  logAuditWithRequest.mockResolvedValue(undefined)
})

describe('GET /api/admin/automations', () => {
  it('refuses a caller without read permission', async () => {
    hasPermission.mockResolvedValue(false)

    const response = await GET(
      new NextRequest('http://localhost:3000/api/admin/automations')
    )

    expect(response.status).toBe(401)
    expect(automationFindMany).not.toHaveBeenCalled()
  })

  it('returns automations with their steps in running order', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/admin/automations')
    )

    expect(response.status).toBe(200)
    expect(automationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          steps: { orderBy: { order: 'asc' } },
        }),
      })
    )
  })
})

describe('POST /api/admin/automations', () => {
  it('numbers the steps by their position in the builder', async () => {
    await POST(createRequest(validAutomation))

    const created = automationCreate.mock.calls[0][0].data
    expect(created.steps.create).toEqual([
      { order: 0, templateId: 'tmpl_thanks', delayHours: 0, subject: null, previewText: null },
      { order: 1, templateId: 'tmpl_recipes', delayHours: 72, subject: null, previewText: null },
    ])
  })

  it('defaults a step with no delay to sending immediately', async () => {
    await POST(
      createRequest({ ...validAutomation, steps: [{ templateId: 'tmpl_thanks' }] })
    )

    expect(automationCreate.mock.calls[0][0].data.steps.create[0].delayHours).toBe(0)
  })

  it('creates an automation with no steps yet, so a draft can be saved', async () => {
    await POST(createRequest({ name: 'Draft', trigger: 'USER_REGISTERED' }))

    expect(automationCreate.mock.calls[0][0].data.steps).toBeUndefined()
  })

  it('records who created it', async () => {
    await POST(createRequest(validAutomation))

    expect(automationCreate.mock.calls[0][0].data.createdById).toBe('admin_1')
    expect(logAuditWithRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        entityType: 'email_automation',
        entityId: 'auto_1',
      }),
      expect.anything()
    )
  })

  it('rejects an automation with no trigger, which could never fire', async () => {
    const response = await POST(createRequest({ name: 'Nameless trigger' }))

    expect(response.status).toBe(400)
    expect(automationCreate).not.toHaveBeenCalled()
  })

  it('rejects an automation with no name', async () => {
    const response = await POST(createRequest({ trigger: 'ORDER_PLACED' }))

    expect(response.status).toBe(400)
    expect(automationCreate).not.toHaveBeenCalled()
  })

  it('refuses a caller without write permission', async () => {
    hasPermission.mockResolvedValue(false)

    const response = await POST(createRequest(validAutomation))

    expect(response.status).toBe(401)
    expect(automationCreate).not.toHaveBeenCalled()
  })
})
