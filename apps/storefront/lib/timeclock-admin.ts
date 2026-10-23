import { z } from 'zod'
import { parseBusinessDateTimeInput } from '@/lib/timeclock'

/** Longest shift a correction may set — catches a punch typed onto the wrong day. */
export const MAX_CORRECTED_SHIFT_MS = 24 * 60 * 60 * 1000

/**
 * An admin's correction to one punch. Times are business-local wall times
 * (`YYYY-MM-DDTHH:mm`) so they mean what the employee saw on the clock; a time
 * the admin did not change is omitted, so the stored instant (with its
 * seconds) is kept exactly. A reason is required: it is the only record of
 * *why* paid hours changed.
 */
export const punchCorrectionSchema = z.object({
  clockInAt: z.string().optional(),
  clockOutAt: z.string().optional(),
  notes: z.string().trim().max(2000),
  reason: z.string().trim().min(3, 'Give a reason for the correction').max(500),
})

export type PunchCorrectionInput = z.infer<typeof punchCorrectionSchema>

export type ResolvedPunchCorrection =
  | { ok: true; clockInAt: Date; clockOutAt: Date; notes: string | null; reason: string }
  | { ok: false; error: string }

const UNPARSEABLE_TIME =
  'is not a valid Zanesville time — it may fall in a daylight-saving change'

/**
 * Turn validated input into the instants to store, rejecting impossible
 * shifts. Times the input omits come from the punch as stored.
 */
export function resolvePunchCorrection(
  input: PunchCorrectionInput,
  existing: { clockInAt: Date; clockOutAt: Date | null },
  now: Date = new Date()
): ResolvedPunchCorrection {
  const clockInAt =
    input.clockInAt === undefined ? existing.clockInAt : parseBusinessDateTimeInput(input.clockInAt)
  const clockOutAt =
    input.clockOutAt === undefined ? existing.clockOutAt : parseBusinessDateTimeInput(input.clockOutAt)

  if (!clockInAt) return { ok: false, error: `Clock-in ${UNPARSEABLE_TIME}` }
  if (input.clockOutAt === undefined && !clockOutAt) {
    return { ok: false, error: 'Set a clock-out time' }
  }
  if (!clockOutAt) return { ok: false, error: `Clock-out ${UNPARSEABLE_TIME}` }
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
