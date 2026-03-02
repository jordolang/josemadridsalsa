'use client'

/**
 * Project Status Dashboard - Main component
 * José Madrid Salsa E-commerce Platform
 */

import { useState } from 'react'
import type { ProjectAnalysis } from '@/lib/project-analyzer/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  TrendingUp,
  Database,
  Code2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
} from 'lucide-react'

interface Props {
  analysis: ProjectAnalysis
}

export function ProjectStatusDashboard({ analysis }: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetch('/api/admin/project-status', { method: 'POST' })
      // Reload after a delay to allow analysis to complete
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (error) {
      console.error('Failed to trigger analysis:', error)
      setIsRefreshing(false)
    }
  }

  const exportReport = () => {
    const markdown = generateMarkdownReport(analysis)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-status-${analysis.runNumber}.md`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Project Status Dashboard</h1>
          <p className="text-gray-600 mt-1">
            José Madrid Salsa E-commerce Platform
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Run #{analysis.runNumber} • {new Date(analysis.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Analyzing...' : 'Refresh Analysis'}
          </Button>
          <Button onClick={exportReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Overall Completion"
          value={`${analysis.overallCompletion}%`}
          icon={<Activity className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          title="Frontend"
          value={`${analysis.metrics.frontend.completion}%`}
          subtitle={`${analysis.metrics.frontend.pagesComplete}/${analysis.metrics.frontend.pagesTotal} pages`}
          icon={<Code2 className="h-5 w-5" />}
          color="purple"
        />
        <StatsCard
          title="Backend"
          value={`${analysis.metrics.backend.completion}%`}
          subtitle={`${analysis.metrics.backend.apiRoutesComplete}/${analysis.metrics.backend.apiRoutesTotal} routes`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <StatsCard
          title="Database"
          value={`${analysis.metrics.database.completion}%`}
          subtitle={`${analysis.metrics.database.modelsCount} models`}
          icon={<Database className="h-5 w-5" />}
          color="orange"
        />
      </div>

      {/* Work Session - Most Important */}
      {analysis.workSession && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Claude Code Work Session #{analysis.workSession.sessionNumber}
              </h2>
              <p className="text-lg font-semibold text-blue-900 mt-1">
                {analysis.workSession.focus}
              </p>
            </div>
            <Badge
              variant={
                analysis.workSession.priority === 'critical'
                  ? 'destructive'
                  : 'default'
              }
              className="text-sm"
            >
              {analysis.workSession.priority}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {analysis.workSession.estimatedHours} hours
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              {analysis.workSession.tasks.length} tasks
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              → {analysis.workSession.estimatedCompletion.projectedCompletion}% completion
            </div>
          </div>

          <div className="space-y-4">
            {analysis.workSession.tasks.map((task) => (
              <div
                key={task.taskNumber}
                className="bg-white rounded-lg border-2 border-blue-300 border-l-4 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono">
                        Task {task.taskNumber}
                      </Badge>
                      <Badge
                        variant={
                          task.priority === 'critical' ? 'destructive' : 'secondary'
                        }
                      >
                        {task.priority}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {task.estimatedHours}h
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      {task.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">{task.description}</p>

                    {task.files.length > 0 && (
                      <div className="text-xs text-gray-500 mb-3">
                        <strong>Files:</strong> {task.files.join(', ')}
                      </div>
                    )}

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-blue-700 hover:text-blue-900">
                        View Instructions
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
                        {task.instructions}
                      </pre>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              onClick={() => {
                const text = JSON.stringify(analysis.workSession, null, 2)
                navigator.clipboard.writeText(text)
              }}
              size="sm"
            >
              Copy Session JSON
            </Button>
            <Button
              onClick={() => {
                const text = analysis.workSession!.tasks
                  .map((t) => t.instructions)
                  .join('\n\n---\n\n')
                navigator.clipboard.writeText(text)
              }}
              variant="outline"
              size="sm"
            >
              Copy All Instructions
            </Button>
          </div>
        </Card>
      )}

      {/* Technical Debt */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <h2 className="text-xl font-bold text-gray-800">Technical Debt</h2>
          <Badge
            variant={analysis.technicalDebt.totalScore > 50 ? 'destructive' : 'secondary'}
          >
            Score: {analysis.technicalDebt.totalScore}/100
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <DebtStat label="TODOs" count={analysis.technicalDebt.todos.length} />
          <DebtStat
            label="Console.logs"
            count={analysis.technicalDebt.consoleLogs.length}
          />
          <DebtStat label="Any Types" count={analysis.technicalDebt.anyTypes.length} />
          <DebtStat
            label="Secrets"
            count={analysis.technicalDebt.hardcodedSecrets.length}
            critical
          />
          <DebtStat
            label="Commented Code"
            count={analysis.technicalDebt.commentedCode.length}
          />
        </div>
      </Card>

      {/* Feature Suggestions */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Feature Suggestions</h2>

        <div className="space-y-4">
          {analysis.suggestions.critical.length > 0 && (
            <FeatureSection
              title="Critical"
              features={analysis.suggestions.critical}
              color="red"
            />
          )}
          {analysis.suggestions.recommended.length > 0 && (
            <FeatureSection
              title="Recommended"
              features={analysis.suggestions.recommended}
              color="yellow"
            />
          )}
          {analysis.suggestions.niceToHave.length > 0 && (
            <FeatureSection
              title="Nice-to-Have"
              features={analysis.suggestions.niceToHave}
              color="green"
            />
          )}
        </div>
      </Card>

      {/* Progress Breakdown */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Progress Breakdown</h2>

        <div className="space-y-4">
          <ProgressBar
            label="Frontend Pages"
            current={analysis.metrics.frontend.pagesComplete}
            total={analysis.metrics.frontend.pagesTotal}
            percentage={analysis.metrics.frontend.completion}
          />
          <ProgressBar
            label="Backend API Routes"
            current={analysis.metrics.backend.apiRoutesComplete}
            total={analysis.metrics.backend.apiRoutesTotal}
            percentage={analysis.metrics.backend.completion}
          />
          <ProgressBar
            label="Database Models"
            current={analysis.metrics.database.modelsCount}
            total={analysis.metrics.database.modelsCount}
            percentage={analysis.metrics.database.completion}
          />
        </div>
      </Card>
    </div>
  )
}

// Helper Components

interface StatsCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  color: 'blue' | 'purple' | 'green' | 'orange'
}

function StatsCard({ title, value, subtitle, icon, color }: StatsCardProps) {
  const colors: Record<StatsCardProps['color'], string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  }

  return (
    <Card className={`p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{title}</div>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {subtitle && <div className="text-xs mt-1 opacity-75">{subtitle}</div>}
    </Card>
  )
}

interface DebtStatProps {
  label: string
  count: number
  critical?: boolean
}

function DebtStat({ label, count, critical }: DebtStatProps) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${critical ? 'text-red-600' : 'text-gray-700'}`}>
        {count}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

interface FeatureSectionProps {
  title: string
  features: any[]
  color: 'red' | 'yellow' | 'green'
}

function FeatureSection({ title, features, color }: FeatureSectionProps) {
  const colors: Record<FeatureSectionProps['color'], string> = {
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    green: 'bg-green-50 border-green-200',
  }

  return (
    <div>
      <h3 className="font-semibold text-gray-700 mb-2">
        {title} ({features.length})
      </h3>
      <div className="space-y-2">
        {features.map((feature: any, i: number) => (
          <div key={i} className={`p-3 rounded border ${colors[color]}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{feature.title}</div>
                <div className="text-sm text-gray-600 mt-1">{feature.description}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {feature.category} • {feature.estimatedHours}h • {feature.businessImpact} impact
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ProgressBarProps {
  label: string
  current: number
  total: number
  percentage: number
}

function ProgressBar({ label, current, total, percentage }: ProgressBarProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          {current}/{total} ({percentage}%)
        </span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function generateMarkdownReport(analysis: ProjectAnalysis): string {
  return `# José Madrid Salsa - Project Status Report

**Generated:** ${new Date(analysis.timestamp).toLocaleString()}
**Run Number:** ${analysis.runNumber}
**Overall Completion:** ${analysis.overallCompletion}%

## Metrics

- Frontend: ${analysis.metrics.frontend.completion}% (${analysis.metrics.frontend.pagesComplete}/${analysis.metrics.frontend.pagesTotal} pages)
- Backend: ${analysis.metrics.backend.completion}% (${analysis.metrics.backend.apiRoutesComplete}/${analysis.metrics.backend.apiRoutesTotal} routes)
- Database: ${analysis.metrics.database.completion}% (${analysis.metrics.database.modelsCount} models)

## Technical Debt

Score: ${analysis.technicalDebt.totalScore}/100

- TODOs: ${analysis.technicalDebt.todos.length}
- Console.logs: ${analysis.technicalDebt.consoleLogs.length}
- Any types: ${analysis.technicalDebt.anyTypes.length}
- Hardcoded secrets: ${analysis.technicalDebt.hardcodedSecrets.length}

## Work Session #${analysis.workSession?.sessionNumber || 'N/A'}

${analysis.workSession ? `
**Focus:** ${analysis.workSession.focus}
**Priority:** ${analysis.workSession.priority}
**Estimated:** ${analysis.workSession.estimatedHours} hours
**Tasks:** ${analysis.workSession.tasks.length}

${analysis.workSession.tasks.map((t) => `
### Task ${t.taskNumber}: ${t.title}
- Priority: ${t.priority}
- Time: ${t.estimatedHours}h
- Files: ${t.files.join(', ')}

${t.instructions}
`).join('\n')}
` : 'No tasks - project complete!'}

Generated with José Madrid Salsa Project Analyzer
`
}
