'use client'

import dynamic from 'next/dynamic'
import type { ScheduleEvent } from '@/lib/server/google-data'

const GoogleScheduleMap = dynamic(
  () => import('./google-schedule-map').then(mod => ({ default: mod.GoogleScheduleMap })),
  {
    loading: () => <div className="h-[520px] animate-pulse bg-muted rounded-3xl" />,
    ssr: false,
  }
)

type ScheduleMapWrapperProps = {
  initialEvents: ScheduleEvent[]
}

export function ScheduleMapWrapper({ initialEvents }: ScheduleMapWrapperProps) {
  return <GoogleScheduleMap initialEvents={initialEvents} />
}
