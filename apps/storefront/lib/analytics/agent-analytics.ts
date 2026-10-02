import AnthropicSDK from '@anthropic-ai/sdk'
import { AIConfig, AmplitudeAI, Anthropic as TrackedAnthropic, PrivacyConfig } from '@amplitude/ai'
import { createInstance } from '@amplitude/analytics-node'

/**
 * Amplitude Agent Analytics for the site's Claude calls.
 *
 * Shares the browser SDK's project key. Without one the SDK still constructs but every
 * session is a silent no-op, so the missing key is announced once here.
 */
const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY
if (!apiKey) console.warn('Amplitude API key missing — Agent Analytics disabled')

// Passed in pre-initialized: under Next's bundler the SDK cannot `require` analytics-node itself.
const amplitudeNode = createInstance()
if (apiKey) amplitudeNode.init(apiKey)

export const ai = new AmplitudeAI({
  amplitude: amplitudeNode,
  // Full text, with emails, phones, cards and IPs scrubbed before they leave the server.
  config: new AIConfig({ contentMode: 'full', redactPii: true }),
})

/** Customer-facing chat: prompt and reply text are captured (redacted). */
export const storefrontChatAgent = ai.agent('storefront-chat', {
  description: 'Picante, the storefront assistant answering customer questions from site content',
})

/** Inbound email triage: whole customer emails, so metadata only. */
export const inboxTriageAgent = ai.agent('inbox-triage', {
  description: 'Classifies inbound customer email and drafts a reply',
})

/** Photographed order-form transcription: metadata only. */
export const formCaptureAgent = ai.agent('form-capture', {
  description: 'Transcribes photographed fundraiser order forms into ledger lines',
})

const METADATA_ONLY = new PrivacyConfig({ contentMode: 'metadata_only' })

/**
 * An Anthropic client whose calls report to Agent Analytics when made inside an agent
 * session's `run()`. Pass `metadataOnly` for prompts that carry customer data.
 */
export function trackedAnthropic(apiKeyForAnthropic: string | undefined, { metadataOnly = false } = {}) {
  const wrapped = new TrackedAnthropic({
    amplitude: ai,
    apiKey: apiKeyForAnthropic,
    privacyConfig: metadataOnly ? METADATA_ONLY : null,
    // The bundler has no `require`, so the SDK cannot find @anthropic-ai/sdk on its own.
    anthropicModule: AnthropicSDK,
  })
  return {
    // The wrapper returns the SDK's own response object for non-streaming calls and rethrows
    // its errors unchanged; only its declared return type is wider (it also covers streams).
    createMessage: (
      params: AnthropicSDK.MessageCreateParamsNonStreaming,
      opts?: { trackInputMessages?: boolean }
    ) =>
      wrapped.messages.create(params as unknown as Record<string, unknown>, opts) as unknown as Promise<AnthropicSDK.Message>,
  }
}
