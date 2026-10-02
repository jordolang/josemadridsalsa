import { describe, expect, it, vi } from 'vitest'

const { providerOptions } = vi.hoisted(() => ({ providerOptions: [] as Array<Record<string, unknown>> }))

vi.mock('@amplitude/analytics-node', () => ({ createInstance: () => ({ init: vi.fn() }) }))
vi.mock('@amplitude/ai', () => ({
  AIConfig: class {
    constructor(readonly options: unknown) {}
  },
  PrivacyConfig: class {
    constructor(readonly options: { contentMode?: string }) {}
  },
  AmplitudeAI: class {
    agent = (id: string) => ({ id })
  },
  Anthropic: class {
    messages = { create: vi.fn() }
    constructor(options: Record<string, unknown>) {
      providerOptions.push(options)
    }
  },
}))

const { trackedAnthropic } = await import('@/lib/analytics/agent-analytics')

describe('trackedAnthropic', () => {
  it('captures metadata only for calls that carry customer data', () => {
    trackedAnthropic('k', { metadataOnly: true })
    trackedAnthropic('k')

    const [metadata, full] = providerOptions
    expect((metadata.privacyConfig as { options: { contentMode: string } }).options.contentMode).toBe('metadata_only')
    // null inherits the SDK-wide setting: full text with PII redaction.
    expect(full.privacyConfig).toBeNull()
  })
})
