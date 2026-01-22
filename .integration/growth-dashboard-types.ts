// Growth Dashboard Types
export interface WeekData {
  week: number
  phase: string
  revenue: number
  traffic: number
  conversions: number
  retailers: number
  subscribers: number
  socialFollowers: number
  teamSize: number
  status: 'completed' | 'current' | 'upcoming'
  milestones: string[]
  developmentHours: number
  marketingHours: number
}

export interface Milestone {
  week: number
  title: string
  description: string
  completed: boolean
  category: 'tech' | 'marketing' | 'business' | 'operations'
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

export interface QuarterlyData {
  quarter: string
  revenue: number
  profit: number
  retailers: number
  team: number
  target: number
  actualSpend?: number
  projectedSpend?: number
}

export interface RevenueBreakdown {
  name: string
  value: number
  amount: number
  color?: string
}

export interface TimeAllocation {
  category: string
  hours: number
  percentage: number
  description?: string
}

export interface RiskAssessment {
  risk: string
  probability: 'Low' | 'Medium' | 'High'
  impact: 'Low' | 'Medium' | 'High'
  mitigation: string
  status: 'monitoring' | 'planned' | 'active' | 'mitigated'
  owner?: string
}

export interface InvestmentPhase {
  phase: string
  quarters: string[]
  minInvestment: number
  maxInvestment: number
  allocations: {
    category: string
    percentage: number
    amount: number
  }[]
}

export interface GrowthMetrics {
  currentWeek: number
  totalWeeks: number
  yearProgress: number
  revenueProgress: number
  milestoneProgress: number
  onTrack: boolean
}

export interface GeographicExpansion {
  states: string[]
  facilities: {
    location: string
    capacity: number
    status: 'planned' | 'building' | 'active'
    openDate?: Date
  }[]
  distributionPartners: {
    name: string
    coverage: string[]
    status: 'negotiating' | 'active'
  }[]
}

export type DashboardView = 'overview' | 'timeline' | 'analytics' | 'milestones' | 'projections'

export type MetricTrend = 'up' | 'down' | 'stable'

export interface ComparisonMetric {
  name: string
  current: number
  target: number
  unit: 'currency' | 'number' | 'percentage'
  trend: MetricTrend
}
