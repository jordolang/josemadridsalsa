// Mon-Fri 9am-5pm America/New_York. Move to admin settings later if needed.

const BUSINESS_TIMEZONE = 'America/New_York'
const BUSINESS_DAYS = new Set([1, 2, 3, 4, 5]) // Mon..Fri (Sun=0)
const BUSINESS_OPEN_HOUR = 9
const BUSINESS_CLOSE_HOUR = 17

export function isBusinessHours(date: Date = new Date()): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const weekdayPart = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0'
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const weekday = weekdayMap[weekdayPart]
  const hour = Number(hourPart) % 24
  if (!BUSINESS_DAYS.has(weekday)) return false
  return hour >= BUSINESS_OPEN_HOUR && hour < BUSINESS_CLOSE_HOUR
}

export const businessHoursLabel = 'Monday – Friday, 9:00 AM – 5:00 PM ET'
