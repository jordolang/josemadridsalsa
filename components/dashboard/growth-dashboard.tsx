"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'
import {
  TrendingUp, DollarSign, Users, Store,
  Target, Rocket, CheckCircle2, Clock, AlertCircle,
  Calendar, BarChart3,
  Zap, Trophy
} from 'lucide-react'
import type { WeekData, Milestone } from './growth-dashboard-types'

// Growth Timeline Data
const growthTimeline: WeekData[] = [
  // Q1 - Foundation & Launch
  { week: 1, phase: 'Launch', revenue: 500, traffic: 650, conversions: 15, retailers: 0, subscribers: 100, socialFollowers: 200, teamSize: 1, status: 'completed', milestones: ['Website Launch', 'Analytics Setup'], developmentHours: 22, marketingHours: 17 },
  { week: 2, phase: 'Launch', revenue: 720, traffic: 1000, conversions: 24, retailers: 0, subscribers: 180, socialFollowers: 350, teamSize: 1, status: 'completed', milestones: ['Email Automation', 'Social Accounts'], developmentHours: 22, marketingHours: 17 },
  { week: 4, phase: 'Optimization', revenue: 1080, traffic: 1500, conversions: 36, retailers: 0, subscribers: 300, socialFollowers: 600, teamSize: 1, status: 'current', milestones: ['Reviews System', 'Live Chat'], developmentHours: 22, marketingHours: 17 },
  { week: 8, phase: 'Content Foundation', revenue: 4375, traffic: 3000, conversions: 140, retailers: 2, subscribers: 650, socialFollowers: 1500, teamSize: 1, status: 'upcoming', milestones: ['Blog Platform', 'Recipe Database', 'Google Ads'], developmentHours: 45, marketingHours: 34 },
  { week: 13, phase: 'Influencer Push', revenue: 10050, traffic: 6000, conversions: 335, retailers: 5, subscribers: 1500, socialFollowers: 2750, teamSize: 1, status: 'upcoming', milestones: ['Influencer Program', 'Sample Jar Launch', 'TikTok Campaign'], developmentHours: 56, marketingHours: 42 },

  // Q2 - Scale & Expand
  { week: 17, phase: 'QR Direct Fulfillment', revenue: 12500, traffic: 9000, conversions: 500, retailers: 8, subscribers: 2200, socialFollowers: 4500, teamSize: 2, status: 'upcoming', milestones: ['QR System Live', 'Local Delivery', 'Event Strategy'], developmentHours: 56, marketingHours: 42 },
  { week: 21, phase: 'B2B Expansion', revenue: 18000, traffic: 11000, conversions: 650, retailers: 15, subscribers: 3500, socialFollowers: 7000, teamSize: 2, status: 'upcoming', milestones: ['Wholesale Portal', '5 Supermarkets', 'Broker Partnership'], developmentHours: 56, marketingHours: 42 },
  { week: 26, phase: 'Automation', revenue: 25000, traffic: 13500, conversions: 850, retailers: 25, subscribers: 5000, socialFollowers: 10000, teamSize: 3, status: 'upcoming', milestones: ['Subscription Program', 'Automated Marketing', 'Chatbot'], developmentHours: 70, marketingHours: 28 },

  // Q3 - Regional Expansion
  { week: 30, phase: 'Regional Planning', revenue: 30000, traffic: 18000, conversions: 1100, retailers: 40, subscribers: 7000, socialFollowers: 15000, teamSize: 5, status: 'upcoming', milestones: ['Multi-Location System', 'Co-Packing Research'], developmentHours: 56, marketingHours: 42 },
  { week: 34, phase: 'Market Research', revenue: 42500, traffic: 23000, conversions: 1500, retailers: 65, subscribers: 10000, socialFollowers: 22000, teamSize: 8, status: 'upcoming', milestones: ['Trade Shows', 'Regional PR', 'Broker Network'], developmentHours: 45, marketingHours: 56 },
  { week: 39, phase: 'Tech-Driven Growth', revenue: 72500, traffic: 30000, conversions: 2100, retailers: 100, subscribers: 12500, socialFollowers: 25000, teamSize: 12, status: 'upcoming', milestones: ['Mobile App', 'AI Forecasting', 'National Campaign'], developmentHours: 70, marketingHours: 28 },

  // Q4 - National Presence
  { week: 43, phase: 'Second Facility', revenue: 102500, traffic: 38000, conversions: 2800, retailers: 175, subscribers: 17000, socialFollowers: 35000, teamSize: 18, status: 'upcoming', milestones: ['Columbus Facility', 'Production Team', '10K Jars/Week'], developmentHours: 56, marketingHours: 42 },
  { week: 47, phase: 'National Retail', revenue: 150000, traffic: 48000, conversions: 3600, retailers: 325, subscribers: 22000, socialFollowers: 55000, teamSize: 25, status: 'upcoming', milestones: ['Whole Foods', 'Kroger Expansion', 'EDI Integration'], developmentHours: 45, marketingHours: 56 },
  { week: 52, phase: 'Optimization', revenue: 215000, traffic: 50000, conversions: 4500, retailers: 500, subscribers: 25000, socialFollowers: 62500, teamSize: 30, status: 'upcoming', milestones: ['Year 2 Planning', 'International Research', '$2M Revenue'], developmentHours: 56, marketingHours: 42 },
]

const milestones: Milestone[] = [
  { week: 1, title: 'Website Launch', description: 'New Next.js website goes live', completed: true, category: 'tech' },
  { week: 1, title: 'Analytics Setup', description: 'GA4 and Hotjar implementation', completed: true, category: 'tech' },
  { week: 2, title: 'Email Automation', description: 'Klaviyo flows configured', completed: true, category: 'marketing' },
  { week: 4, title: 'Review System', description: 'Customer reviews platform live', completed: false, category: 'tech' },
  { week: 4, title: 'Live Chat', description: 'Intercom support integration', completed: false, category: 'tech' },
  { week: 8, title: 'Blog Platform', description: '12-16 SEO-optimized posts', completed: false, category: 'marketing' },
  { week: 8, title: 'Google Ads Launch', description: '$500/month campaign', completed: false, category: 'marketing' },
  { week: 13, title: 'Sample Jar Program', description: '24x4oz case product launch', completed: false, category: 'business' },
  { week: 13, title: 'Influencer Network', description: '10-15 active partnerships', completed: false, category: 'marketing' },
  { week: 17, title: 'QR Code System', description: 'Direct fulfillment platform', completed: false, category: 'tech' },
  { week: 21, title: 'Wholesale Portal', description: 'B2B ordering system', completed: false, category: 'tech' },
  { week: 21, title: 'First Supermarkets', description: '5 retail locations secured', completed: false, category: 'business' },
  { week: 26, title: 'Subscription Launch', description: 'Monthly salsa club program', completed: false, category: 'business' },
  { week: 30, title: 'Regional Planning', description: 'Multi-location strategy', completed: false, category: 'operations' },
  { week: 39, title: 'Mobile App Launch', description: 'iOS/Android availability', completed: false, category: 'tech' },
  { week: 43, title: 'Second Production Facility', description: 'Columbus/Cleveland location', completed: false, category: 'operations' },
  { week: 47, title: 'National Retail Presence', description: '250+ stores nationwide', completed: false, category: 'business' },
  { week: 52, title: '$2M Annual Revenue', description: 'Year 1 target achieved', completed: false, category: 'business' },
]

const COLORS = {
  primary: '#22c55e',
  secondary: '#3b82f6',
  accent: '#f59e0b',
  danger: '#ef4444',
  purple: '#a855f7',
  teal: '#14b8a6',
}

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6']

// Dynamic current week based on launch date
const LAUNCH_DATE = new Date('2025-01-27')
function getCurrentWeek(): number {
  return Math.min(52, Math.max(1,
    Math.floor((new Date().getTime() - LAUNCH_DATE.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  ))
}

export default function GrowthDashboard() {
  const [selectedWeek, setSelectedWeek] = useState(4)
  const [activeTab, setActiveTab] = useState('overview')

  const currentWeek = getCurrentWeek()
  const weekData = growthTimeline.find(w => w.week === selectedWeek) || growthTimeline[0]
  const currentData = growthTimeline.find(w => w.week === currentWeek) || growthTimeline[0]

  // Calculate progress percentages
  const yearProgress = (currentWeek / 52) * 100
  const revenueProgress = (currentData.revenue / 215000) * 100
  const retailerProgress = (currentData.retailers / 500) * 100
  const subscriberProgress = (currentData.subscribers / 25000) * 100

  // Quarterly data
  const quarterlyData = [
    { quarter: 'Q1', revenue: 45000, profit: 18000, retailers: 5, team: 1, target: 50000 },
    { quarter: 'Q2', revenue: 165000, profit: 66000, retailers: 25, team: 3, target: 180000 },
    { quarter: 'Q3', revenue: 475000, profit: 190000, retailers: 100, team: 12, target: 500000 },
    { quarter: 'Q4', revenue: 975000, profit: 390000, retailers: 500, team: 30, target: 1000000 },
  ]

  // Category breakdown
  const revenueBreakdown = [
    { name: 'DTC/E-commerce', value: 45, amount: 96750 },
    { name: 'Retail/Wholesale', value: 47.5, amount: 102125 },
    { name: 'Subscriptions', value: 7.5, amount: 16125 },
  ]

  // Time allocation
  const timeAllocation = [
    { category: 'Development', hours: 11.2, percentage: 40 },
    { category: 'Marketing', hours: 8.4, percentage: 30 },
    { category: 'Operations', hours: 5.6, percentage: 20 },
    { category: 'Strategy', hours: 2.8, percentage: 10 },
  ]

  // Upcoming milestones
  const upcomingMilestones = milestones
    .filter(m => !m.completed && m.week >= currentWeek)
    .slice(0, 5)

  // Completed milestones count
  const completedMilestones = milestones.filter(m => m.completed).length
  const totalMilestones = milestones.length

  return (
    <div className="w-full space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Growth Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            52-Week Journey to National Presence
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="px-4 py-2 text-lg">
            Week {currentWeek} of 52
          </Badge>
          <Badge className="px-4 py-2 text-lg bg-green-600">
            {weekData.phase} Phase
          </Badge>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ${currentData.revenue.toLocaleString()}
            </div>
            <Progress value={revenueProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {revenueProgress.toFixed(1)}% to $215K goal
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Email Subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {currentData.subscribers.toLocaleString()}
            </div>
            <Progress value={subscriberProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {subscriberProgress.toFixed(1)}% to 25K goal
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" />
              Retail Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {currentData.retailers}
            </div>
            <Progress value={retailerProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {retailerProgress.toFixed(1)}% to 500 stores
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {completedMilestones}/{totalMilestones}
            </div>
            <Progress value={(completedMilestones / totalMilestones) * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {((completedMilestones / totalMilestones) * 100).toFixed(0)}% complete
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="projections">Projections</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue Growth Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Growth Trajectory</CardTitle>
                <CardDescription>52-week revenue projection</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={growthTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={COLORS.primary}
                      fill={COLORS.primary}
                      fillOpacity={0.6}
                      name="Revenue ($)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Traffic & Conversions */}
            <Card>
              <CardHeader>
                <CardTitle>Website Performance</CardTitle>
                <CardDescription>Traffic and conversion trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="traffic"
                      stroke={COLORS.secondary}
                      strokeWidth={2}
                      name="Traffic"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="conversions"
                      stroke={COLORS.accent}
                      strokeWidth={2}
                      name="Conversions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quarterly Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Quarterly Performance</CardTitle>
                <CardDescription>Revenue, profit, and growth metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={quarterlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="revenue" fill={COLORS.primary} name="Revenue" />
                    <Bar dataKey="profit" fill={COLORS.secondary} name="Profit" />
                    <Bar dataKey="target" fill={COLORS.accent} name="Target" opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
                <CardDescription>Year-end revenue by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={revenueBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueBreakdown.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(_value, _name, props) => [`$${props.payload.amount.toLocaleString()}`, props.payload.name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {revenueBreakdown.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">${item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Allocation */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Time Allocation</CardTitle>
              <CardDescription>28 hours/week across 4 focus areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {timeAllocation.map((item) => (
                  <div key={item.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.category}</span>
                      <span className="text-sm text-muted-foreground">{item.hours}h</span>
                    </div>
                    <Progress value={item.percentage} />
                    <span className="text-xs text-muted-foreground">{item.percentage}% of time</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interactive Timeline</CardTitle>
              <CardDescription>Click any week to see detailed breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-7 lg:grid-cols-14 gap-2 mb-8">
                {growthTimeline.map((week) => (
                  <Button
                    key={week.week}
                    variant={week.week === selectedWeek ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedWeek(week.week)}
                    className={`
                      ${week.status === 'completed' ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30' : ''}
                      ${week.status === 'current' ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30' : ''}
                      ${week.status === 'upcoming' ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/30' : ''}
                    `}
                  >
                    {week.week}
                  </Button>
                ))}
              </div>

              {/* Selected Week Details */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">Week {weekData.week}</h3>
                    <p className="text-muted-foreground">{weekData.phase} Phase</p>
                  </div>
                  <Badge
                    variant={weekData.status === 'completed' ? 'default' : 'secondary'}
                    className="text-lg px-4 py-2"
                  >
                    {weekData.status === 'completed' ? <CheckCircle2 className="w-4 h-4 mr-2" /> :
                     weekData.status === 'current' ? <Clock className="w-4 h-4 mr-2" /> :
                     <Calendar className="w-4 h-4 mr-2" />}
                    {weekData.status.charAt(0).toUpperCase() + weekData.status.slice(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${weekData.revenue.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Traffic</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{weekData.traffic.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Retailers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{weekData.retailers}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Team Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{weekData.teamSize}</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Week {weekData.week} Milestones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {weekData.milestones.map((milestone, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>{milestone}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Time Investment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Development</span>
                          <span className="text-sm font-semibold">{weekData.developmentHours}h</span>
                        </div>
                        <Progress value={(weekData.developmentHours / 28) * 100} />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Marketing</span>
                          <span className="text-sm font-semibold">{weekData.marketingHours}h</span>
                        </div>
                        <Progress value={(weekData.marketingHours / 28) * 100} />
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between">
                          <span className="font-semibold">Total Weekly Hours</span>
                          <span className="font-bold text-green-600">
                            {weekData.developmentHours + weekData.marketingHours}h
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Growth Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Subscribers</span>
                        <span className="font-bold">{weekData.subscribers.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Social Followers</span>
                        <span className="font-bold">{weekData.socialFollowers.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Conversions</span>
                        <span className="font-bold">{weekData.conversions}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm">Conversion Rate</span>
                        <span className="font-bold text-green-600">
                          {((weekData.conversions / weekData.traffic) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Growth Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Multi-Metric Growth</CardTitle>
                <CardDescription>Comparing key growth indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={[
                    { metric: 'Revenue', current: (currentData.revenue / 215000) * 100, target: 100 },
                    { metric: 'Traffic', current: (currentData.traffic / 50000) * 100, target: 100 },
                    { metric: 'Retailers', current: (currentData.retailers / 500) * 100, target: 100 },
                    { metric: 'Subscribers', current: (currentData.subscribers / 25000) * 100, target: 100 },
                    { metric: 'Social', current: (currentData.socialFollowers / 62500) * 100, target: 100 },
                    { metric: 'Team', current: (currentData.teamSize / 30) * 100, target: 100 },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Current" dataKey="current" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.6} />
                    <Radar name="Target" dataKey="target" stroke={COLORS.accent} fill={COLORS.accent} fillOpacity={0.3} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Team Growth */}
            <Card>
              <CardHeader>
                <CardTitle>Team Expansion</CardTitle>
                <CardDescription>Headcount growth over 52 weeks</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={growthTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="stepAfter"
                      dataKey="teamSize"
                      stroke={COLORS.purple}
                      fill={COLORS.purple}
                      fillOpacity={0.6}
                      name="Team Members"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Retail Expansion */}
            <Card>
              <CardHeader>
                <CardTitle>Retail Distribution Growth</CardTitle>
                <CardDescription>Store locations over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={growthTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="retailers"
                      stroke={COLORS.teal}
                      fill={COLORS.teal}
                      fillOpacity={0.6}
                      name="Retail Locations"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Social Growth */}
            <Card>
              <CardHeader>
                <CardTitle>Social Media Following</CardTitle>
                <CardDescription>Combined Instagram + TikTok followers</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={growthTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="socialFollowers"
                      stroke={COLORS.accent}
                      fill={COLORS.accent}
                      fillOpacity={0.6}
                      name="Followers"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Upcoming Milestones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-blue-600" />
                  Upcoming Milestones
                </CardTitle>
                <CardDescription>Next 5 major objectives</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingMilestones.map((milestone) => (
                    <div key={`${milestone.week}-${milestone.title}`} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold">{milestone.title}</h4>
                        <Badge variant="outline">Week {milestone.week}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{milestone.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {milestone.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {milestone.week - currentWeek} weeks away
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Completed Milestones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Completed Milestones
                </CardTitle>
                <CardDescription>Achievements so far</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {milestones
                    .filter(m => m.completed)
                    .map((milestone) => (
                      <div key={`${milestone.week}-${milestone.title}`} className="border-l-4 border-green-500 pl-4 py-2 opacity-75">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold">{milestone.title}</h4>
                          <Badge className="bg-green-600">Week {milestone.week}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{milestone.description}</p>
                        <Badge variant="secondary" className="text-xs mt-2">
                          {milestone.category}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Milestone Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Complete Milestone Roadmap</CardTitle>
              <CardDescription>All 18 major milestones across 52 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {milestones.map((milestone, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-4 p-3 rounded-lg ${
                      milestone.completed
                        ? 'bg-green-50 dark:bg-green-950/20'
                        : milestone.week <= currentWeek
                        ? 'bg-blue-50 dark:bg-blue-950/20'
                        : 'bg-slate-50 dark:bg-slate-950/20'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      milestone.completed
                        ? 'bg-green-600 text-white'
                        : milestone.week <= currentWeek
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-300 text-slate-600'
                    }`}>
                      {milestone.completed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <span className="text-xs font-bold">{milestone.week}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{milestone.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {milestone.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{milestone.description}</p>
                    </div>
                    <Badge variant="secondary">W{milestone.week}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projections Tab */}
        <TabsContent value="projections" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Year End Projection */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  Year-End Targets (Week 52)
                </CardTitle>
                <CardDescription>Projected vs. Current Performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Annual Revenue</div>
                    <div className="text-3xl font-bold text-green-600">$1.5M-$2.0M</div>
                    <div className="text-xs text-muted-foreground">
                      Currently: ${(currentData.revenue * 12).toLocaleString()}/year
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Retail Stores</div>
                    <div className="text-3xl font-bold text-purple-600">400-600</div>
                    <div className="text-xs text-muted-foreground">
                      Currently: {currentData.retailers} stores
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Team Members</div>
                    <div className="text-3xl font-bold text-blue-600">25-35</div>
                    <div className="text-xs text-muted-foreground">
                      Currently: {currentData.teamSize} people
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Email List</div>
                    <div className="text-3xl font-bold text-amber-600">25K</div>
                    <div className="text-xs text-muted-foreground">
                      Currently: {currentData.subscribers.toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Investment Requirements */}
            <Card>
              <CardHeader>
                <CardTitle>Investment Needed</CardTitle>
                <CardDescription>Capital requirements by phase</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Q1-Q2 Bootstrap</span>
                      <span className="font-semibold">$10K-$25K</span>
                    </div>
                    <Progress value={100} className="bg-green-200" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Q3 Growth</span>
                      <span className="font-semibold">$50K-$100K</span>
                    </div>
                    <Progress value={0} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Q4 Expansion</span>
                      <span className="font-semibold">$150K-$300K</span>
                    </div>
                    <Progress value={0} />
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between">
                      <span className="font-bold">Total Year 1</span>
                      <span className="font-bold text-green-600">$210K-$425K</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profit Projections */}
            <Card>
              <CardHeader>
                <CardTitle>Profit Margins</CardTitle>
                <CardDescription>By revenue channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">DTC/E-commerce</span>
                      <span className="font-semibold text-green-600">40-45%</span>
                    </div>
                    <Progress value={42.5} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Retail/Wholesale</span>
                      <span className="font-semibold text-blue-600">25-30%</span>
                    </div>
                    <Progress value={27.5} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Subscriptions</span>
                      <span className="font-semibold text-purple-600">35-40%</span>
                    </div>
                    <Progress value={37.5} />
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between">
                      <span className="font-bold">Blended Margin</span>
                      <span className="font-bold text-green-600">35-40%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* States & Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Geographic Expansion</CardTitle>
                <CardDescription>Distribution footprint</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">States with Distribution</span>
                      <span className="font-semibold">8-15</span>
                    </div>
                    <Progress value={20} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Production Facilities</span>
                      <span className="font-semibold">2-3</span>
                    </div>
                    <Progress value={33} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Weekly Production Capacity</span>
                      <span className="font-semibold">10K+ jars</span>
                    </div>
                    <Progress value={15} />
                  </div>
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground mb-2">Key Markets</div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Ohio</Badge>
                      <Badge variant="outline">Pennsylvania</Badge>
                      <Badge variant="outline">Michigan</Badge>
                      <Badge variant="outline">Indiana</Badge>
                      <Badge variant="outline">Kentucky</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Risk Mitigation Strategy
              </CardTitle>
              <CardDescription>Key risks and mitigation plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    risk: 'Production Capacity Constraints',
                    probability: 'High',
                    mitigation: 'Early co-packing partnerships, flexible manufacturing',
                    status: 'monitoring'
                  },
                  {
                    risk: 'Cash Flow Crunch',
                    probability: 'High',
                    mitigation: 'Line of credit, invoice factoring, raise capital',
                    status: 'monitoring'
                  },
                  {
                    risk: 'Retail Execution Failures',
                    probability: 'Medium',
                    mitigation: 'Strong broker relationships, demo programs',
                    status: 'planned'
                  },
                  {
                    risk: 'Supply Chain Disruptions',
                    probability: 'Medium',
                    mitigation: 'Multiple suppliers, safety stock inventory',
                    status: 'planned'
                  },
                ].map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{item.risk}</h4>
                      <Badge
                        variant={item.probability === 'High' ? 'destructive' : 'secondary'}
                      >
                        {item.probability}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.mitigation}</p>
                    <Badge variant="outline" className="text-xs">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions Footer */}
      <Card className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Stay on Track</h3>
              <p className="text-green-50">
                {52 - currentWeek} weeks remaining &bull; {completedMilestones} of {totalMilestones} milestones completed
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="lg">
                <BarChart3 className="mr-2 h-4 w-4" />
                Export Report
              </Button>
              <Button variant="secondary" size="lg">
                <Zap className="mr-2 h-4 w-4" />
                Update Progress
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
