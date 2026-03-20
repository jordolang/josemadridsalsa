'use client'

import dynamic from 'next/dynamic'

const GoogleScheduleMap = dynamic(
  () => import('./google-schedule-map').then(mod => ({ default: mod.GoogleScheduleMap })),
  {
    loading: () => <div className="h-[520px] animate-pulse bg-muted rounded-3xl" />,
    ssr: false,
  }
)

export function ScheduleMapWrapper() {
  return <GoogleScheduleMap />
}
