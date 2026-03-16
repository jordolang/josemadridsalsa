"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CampaignStatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  borderColor?: string
  progress?: number
  progressLabel?: string
  trend?: {
    value: number
    label: string
  }
}

export function CampaignStatsCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-slate-600',
  borderColor = 'border-l-slate-500',
  progress,
  progressLabel,
  trend,
}: CampaignStatsCardProps) {
  return (
    <Card className={cn('border-l-4', borderColor)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={cn('h-4 w-4', iconColor)} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>

        {progress !== undefined && (
          <>
            <Progress value={progress} className="mt-2" />
            {progressLabel && (
              <p className="text-xs text-muted-foreground mt-2">
                {progressLabel}
              </p>
            )}
          </>
        )}

        {trend && (
          <p className={cn(
            'text-xs mt-2',
            trend.value >= 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
