import { z } from 'zod'
import { parseBusinessDateTimeInput } from '@/lib/timeclock'

/** Longest shift a correction may set — catches a punch typed onto the wrong day. */
export const MAX_CORRECTED_SHIFT_MS = 24 * 60 * 60 * 1000

/**
 * An admin's correction to one punch. Times are business-local wall times
 * (`YYYY-MM-DDTHH:mm`) so they mean what the employee saw on the clock. A
 * reason is required: it is the only record of *why* paid hours changed.
 */
export const punchCorrectionSchema = z.object({
  clockInAt: z.string(),
  clockOutAt: z.string(),
  notes: z.string().trim().max(2000),
  reason: z.string().trim().min(3, 'Give a reason for the correction').max(500),
})

export type PunchCorrectionInput = z.infer<typeof punchCorrectionSchema>

export type ResolvedPunchCorrection =
  | { ok: true; clockInAt: Date; clockOutAt: Date; notes: string | null; reason: string }
  | { ok: false; error: string }

/** Turn validated input into the instants to store, rejecting impossible shifts. */
export function resolvePunchCorrection(
  input: PunchCorrectionInput,
  now: Date = new Date()
): ResolvedPunchCorrection {
  const clockInAt = parseBusinessDateTimeInput(input.clockInAt)
  const clockOutAt = parseBusinessDateTimeInput(input.clockOutAt)

  if (!clockInAt) return { ok: false, error: 'Clock-in is not a valid date and time' }
  if (!clockOutAt) return { ok: false, error: 'Clock-out is not a valid date and time' }
  if (clockOutAt <= clockInAt) return { ok: false, error: 'Clock-out must be after clock-in' }
  if (clockOutAt > now) return { ok: false, error: 'Clock-out cannot be in the future' }
  if (clockOutAt.getTime() - clockInAt.getTime() > MAX_CORRECTED_SHIFT_MS) {
    return { ok: false, error: 'A shift cannot be longer than 24 hours' }
  }

  return {
    ok: true,
    clockInAt,
    clockOutAt,
    notes: input.notes.length > 0 ? input.notes : null,
    reason: input.reason,
  }
}
