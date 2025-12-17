import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getDecryptedServiceKeyValue } from '@/lib/service-keys'

export async function syncGoogleCalendar(): Promise<{
  created: number
  updated: number
  deleted: number
  errors: string[]
}> {
  const result = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [] as string[],
  }

  try {
    const accessToken = await getDecryptedServiceKeyValue('google_calendar', 'access_token')
    const refreshToken = await getDecryptedServiceKeyValue('google_calendar', 'refresh_token')

    if (!accessToken) {
      throw new Error('Google Calendar not connected')
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    const calendar = google.calendar({ version: 'v3', auth })

    const now = new Date()
    const oneYearFromNow = new Date()
    oneYearFromNow.setFullYear(now.getFullYear() + 1)

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: oneYearFromNow.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items || []

    for (const event of events) {
      if (!event.id) continue

      try {
        const existing = await prisma.featuredEvent.findUnique({
          where: { googleEventId: event.id },
        })

        const eventData = {
          title: event.summary || 'Untitled Event',
          description: event.description,
          location: event.location,
          startDate: new Date(event.start?.dateTime || event.start?.date || ''),
          endDate: event.end ? new Date(event.end.dateTime || event.end.date || '') : null,
          featuredFrom: new Date(event.start?.dateTime || event.start?.date || ''),
          featuredTo: event.end ? new Date(event.end.dateTime || event.end.date || '') : null,
        }

        if (existing) {
          await prisma.featuredEvent.update({
            where: { id: existing.id },
            data: eventData,
          })
          result.updated++
        } else {
          await prisma.featuredEvent.create({
            data: {
              ...eventData,
              googleEventId: event.id,
            },
          })
          result.created++
        }
      } catch (error) {
        result.errors.push(`Event ${event.id}: ${error}`)
      }
    }

    const eventIds = events.map((e) => e.id).filter(Boolean) as string[]
    const deletedCount = await prisma.featuredEvent.deleteMany({
      where: {
        googleEventId: {
          not: null,
          notIn: eventIds,
        },
      },
    })
    result.deleted = deletedCount.count

  } catch (error) {
    result.errors.push(`Sync error: ${error}`)
  }

  return result
}
