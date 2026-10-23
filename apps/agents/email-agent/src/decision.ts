import { z } from 'zod';

export const ClaudeDecisionSchema = z.object({
  disposition: z.enum(['routine-draft', 'needs-owner', 'ignore']),
  summary: z.string().min(1).max(1_000),
  draftReply: z.string().min(1).max(5_000).nullable(),
  ownerQuestion: z.string().min(1).max(2_000).nullable(),
  confidence: z.number().min(0).max(1),
});

export type ClaudeDecision = z.infer<typeof ClaudeDecisionSchema>;

export function parseClaudeDecision(value: string): ClaudeDecision {
  const withoutFence = value
    .trim()
    .replace(/^```(?:json)?\s*/u, '')
    .replace(/\s*```$/u, '');

  return ClaudeDecisionSchema.parse(JSON.parse(withoutFence));
}
