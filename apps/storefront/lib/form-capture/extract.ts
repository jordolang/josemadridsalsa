import Anthropic from '@anthropic-ai/sdk'
import { formCaptureAgent, trackedAnthropic } from '@/lib/analytics/agent-analytics'
import { z } from 'zod'
import type { CaptureFormType } from '@prisma/client'
import { FORM_SPECS, classifyLabel, isTotalLabel } from './form-specs'
import { parseFormDate, parseMoneyToCents, parseQuantity } from './parse'
import type { ClassifiedLine, ExtractionResult } from './types'
import { logger } from '@/lib/logger'

/**
 * Handwriting on a decade-old carbon form is the hardest input this codebase reads, and a
 * misread digit becomes a wrong figure in QuickBooks. Use the most capable model available.
 */
export const EXTRACTION_MODEL = 'claude-opus-5'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024

/** Media types the vision API accepts. Anything else is rejected before we spend a call. */
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

/**
 * The shape the model must return. Confidence is per line and mandatory: a form where the model
 * cannot say how sure it is has to reach a person.
 */
const extractionToolSchema = {
  type: 'object' as const,
  properties: {
    documentDate: {
      type: ['string', 'null'] as const,
      description: 'The date written on the form, exactly as written (e.g. "4/13/26"). Null if absent.',
    },
    subject: {
      type: ['string', 'null'] as const,
      description:
        'The show name, market location, organisation or vendor this form is about. Null if absent.',
    },
    statedTotal: {
      type: ['string', 'null'] as const,
      description:
        'The total written on the form, exactly as written. Null if the form states no total. ' +
        'Do not compute it yourself — only report a total the form actually shows.',
    },
    lines: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          label: { type: 'string' as const, description: 'The row label as written on the form.' },
          value: {
            type: 'string' as const,
            description: 'The figure for that row, exactly as written, including any $ or comma.',
          },
          isQuantity: {
            type: 'boolean' as const,
            description: 'True when the figure counts units (jars, miles) rather than money.',
          },
          confidence: {
            type: 'number' as const,
            description:
              'How certain you are that you read this row correctly, 0 to 1. Be strict: use ' +
              'below 0.9 whenever a digit is ambiguous, smudged, overwritten or cut off.',
          },
        },
        required: ['label', 'value', 'isQuantity', 'confidence'],
      },
    },
  },
  required: ['documentDate', 'subject', 'statedTotal', 'lines'],
}

const modelOutputSchema = z.object({
  documentDate: z.string().nullable(),
  subject: z.string().nullable(),
  statedTotal: z.string().nullable(),
  lines: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      isQuantity: z.boolean(),
      confidence: z.number().min(0).max(1),
    })
  ),
})

function buildPrompt(formType: CaptureFormType): string {
  const spec = FORM_SPECS[formType] ?? FORM_SPECS.OTHER
  return [
    `You are reading a photographed business form for a salsa company: a ${spec.title}.`,
    '',
    spec.description,
    '',
    'Fields that typically appear on this form:',
    ...spec.expectedFields.map((field) => `  - ${field}`),
    '',
    'Rules:',
    '1. Transcribe what is on the page. Never infer, complete or correct a figure.',
    '2. Report every labelled figure as its own line, in the order it appears.',
    '3. Report a total ONLY if the form writes one. Never add the rows up yourself.',
    '4. If a figure is crossed out and rewritten, report the final value and lower your confidence.',
    '5. If you cannot read a row at all, omit it rather than guessing.',
    '6. Confidence is per row and must be honest. Handwriting you are inferring from context is',
    '   below 0.9, not above it. A person reviews anything under 0.9, which is the correct outcome.',
  ].join('\n')
}

export class ExtractionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'ExtractionError'
  }
}

/**
 * Fetch the stored form image and return it as base64 for the vision call.
 * Kept separate so tests can exercise the parsing path without network access.
 */
export async function fetchImageAsBase64(
  fileUrl: string
): Promise<{ data: string; mediaType: (typeof SUPPORTED_IMAGE_TYPES)[number] }> {
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new ExtractionError(`Could not fetch form image (HTTP ${response.status})`)
  }

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!SUPPORTED_IMAGE_TYPES.includes(contentType as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
    throw new ExtractionError(
      `Unsupported image type "${contentType || 'unknown'}". Upload a JPEG, PNG, GIF or WebP photo.`
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new ExtractionError('Form image is larger than 12MB. Retake the photo at a lower resolution.')
  }

  return {
    data: buffer.toString('base64'),
    mediaType: contentType as (typeof SUPPORTED_IMAGE_TYPES)[number],
  }
}

/**
 * Turn the model's transcription into classified ledger lines.
 *
 * Pure, and therefore the part worth testing hardest: this is where a misclassified label would
 * silently move money to the wrong side of the books.
 */
export function classifyExtraction(
  output: z.infer<typeof modelOutputSchema>,
  formType: CaptureFormType,
  now = new Date()
): Pick<ExtractionResult, 'capturedOn' | 'subject' | 'statedTotalCents' | 'lines'> & {
  classified: ClassifiedLine[]
} {
  const classified: ClassifiedLine[] = []

  for (const line of output.lines) {
    // A "Total" row summarises the rows above it. Posting it as well would double the day.
    if (isTotalLabel(line.label)) continue

    const classification = classifyLabel(line.label, formType)
    const isQuantity = line.isQuantity || classification.isQuantity

    const amountCents = isQuantity ? 0 : parseMoneyToCents(line.value)
    const quantity = isQuantity ? parseQuantity(line.value) : null

    // An unreadable money figure must not become a zero-dollar line; drop it and let the
    // reconciliation gap flag the form for review.
    if (!isQuantity && amountCents === null) continue
    if (isQuantity && quantity === null) continue

    classified.push({
      label: line.label.trim(),
      amountCents: Math.abs(amountCents ?? 0),
      quantity,
      confidence: line.confidence,
      rawValue: line.value,
      direction: classification.direction,
      category: classification.category,
    })
  }

  return {
    capturedOn: parseFormDate(output.documentDate, now),
    subject: output.subject?.trim() || null,
    statedTotalCents: parseMoneyToCents(output.statedTotal),
    lines: classified,
    classified,
  }
}

/**
 * Read a photographed form.
 *
 * Makes a real vision call — there is no offline or stubbed mode. If `ANTHROPIC_API_KEY` is not
 * configured this throws rather than returning empty output, because a capture that silently
 * produced no lines would look like an empty form instead of a broken pipeline.
 */
export async function extractForm(input: {
  fileUrl: string
  formType: CaptureFormType
  client?: Anthropic
  now?: Date
  /** The capture's id; one Agent Analytics session per form. */
  sessionId?: string
}): Promise<ExtractionResult & { classified: ClassifiedLine[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey && !input.client) {
    throw new ExtractionError('ANTHROPIC_API_KEY is not configured; form extraction is unavailable.')
  }

  // An injected client (tests) is used as-is; otherwise the call reports to Agent Analytics,
  // metadata only, since the image is a customer's filled-in order form.
  const create = (params: Anthropic.MessageCreateParamsNonStreaming) =>
    input.client
      ? input.client.messages.create(params)
      : formCaptureAgent
          .session({ sessionId: input.sessionId })
          .run(() => trackedAnthropic(apiKey, { metadataOnly: true }).createMessage(params))
  const image = await fetchImageAsBase64(input.fileUrl)

  let message
  try {
    message = await create({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      tools: [
        {
          name: 'record_form',
          description: 'Record every labelled figure transcribed from the form.',
          input_schema: extractionToolSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'record_form' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.data },
            },
            { type: 'text', text: buildPrompt(input.formType) },
          ],
        },
      ],
    })
  } catch (error) {
    logger.error('form-capture: vision call failed', { error })
    throw new ExtractionError('The extraction service could not read this form.', error)
  }

  const toolUse = message.content.find(
    (block): block is Extract<(typeof message.content)[number], { type: 'tool_use' }> =>
      block.type === 'tool_use'
  )
  if (!toolUse) {
    throw new ExtractionError('Extraction returned no structured result for this form.')
  }

  const parsed = modelOutputSchema.safeParse(toolUse.input)
  if (!parsed.success) {
    throw new ExtractionError(`Extraction output did not match the expected shape: ${parsed.error.message}`)
  }

  const classified = classifyExtraction(parsed.data, input.formType, input.now)

  return {
    formType: input.formType,
    capturedOn: classified.capturedOn,
    subject: classified.subject,
    statedTotalCents: classified.statedTotalCents,
    lines: classified.lines,
    classified: classified.classified,
    model: EXTRACTION_MODEL,
    raw: toolUse.input,
  }
}
