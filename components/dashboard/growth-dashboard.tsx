'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  DollarSign, Users, ShoppingCart, Package, MapPin, Star,
  TrendingUp, TrendingDown, BarChart3,
} from 'lucide-react'

/* ── Types ── */
interface GrowthData {
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>
  monthlyCustomers: Array<{ month: string; newCustomers: number; totalCustomers: number }>
  totals: { orders: number; revenue: number; customers: number; products: number; locations: number; reviews: number; avgRating: number }
  topProducts: Array<{ name: string; unitsSold: number; revenue: number }>
  ordersByMonth: Array<{ month: string; count: number }>
}
type TabKey = 'revenue' | 'customers' | 'products'
/* ── Main Component ── */
export function GrowthDashboardView({ data }: { data: GrowthData }) {
  const [activeTab, setActiveTab] = useState<TabKey>('revenue')
  const tabs: Array<{ key: TabKey; label: string }> = [{ key: 'revenue', label: 'Revenue' }, { key: 'customers', label: 'Customers' }, { key: 'products', label: 'Products' }]
  const rev = data.monthlyRevenue
  const curRev = rev[rev.length - 1]?.revenue ?? 0
  const prevRev = rev[rev.length - 2]?.revenue ?? 0
  const revGrowth = prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : 0
  const cust = data.monthlyCustomers
  const curCust = cust[cust.length - 1]?.newCustomers ?? 0
  const prevCust = cust[cust.length - 2]?.newCustomers ?? 0
  const custGrowth = prevCust > 0 ? ((curCust - prevCust) / prevCust) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Total Revenue" value={`$${data.totals.revenue.toLocaleString()}`} icon={DollarSign} change={revGrowth} sub="vs prev month" />
        <Kpi title="Total Orders" value={data.totals.orders.toLocaleString()} icon={ShoppingCart} sub={`${rev[rev.length - 1]?.orders ?? 0} this month`} />
        <Kpi title="Total Customers" value={data.totals.customers.toLocaleString()} icon={Users} change={custGrowth} sub="vs prev month" />
        <Kpi title="Avg Rating" value={data.totals.avgRating > 0 ? data.totals.avgRating.toFixed(1) : 'N/A'} icon={Star} sub={`${data.totals.reviews} reviews`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><div className="flex items-center gap-3"><Package className="h-8 w-8 text-orange-600" /><div><p className="text-sm text-muted-foreground">Active Products</p><p className="text-2xl font-bold">{data.totals.products}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><MapPin className="h-8 w-8 text-red-600" /><div><p className="text-sm text-muted-foreground">Store Locations</p><p className="text-2xl font-bold">{data.totals.locations}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-green-600" /><div><p className="text-sm text-muted-foreground">Avg Order Value</p><p className="text-2xl font-bold">{data.totals.orders > 0 ? `$${(data.totals.revenue / data.totals.orders).toFixed(2)}` : '$0'}</p></div></div></Card>
      </div>
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (<button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t.label}</button>))}
      </div>
      {activeTab === 'revenue' && <div className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2"><RevChart data={data.monthlyRevenue} /></div><div><OrderTrend data={data.ordersByMonth} /></div></div>}
      {activeTab === 'customers' && <div className="grid gap-6 lg:grid-cols-2"><CustGrowth data={data.monthlyCustomers} /><NewCust data={data.monthlyCustomers} /></div>}
      {activeTab === 'products' && <TopProds products={data.topProducts} />}
    </div>
  )
}

function Kpi({ title, value, icon: Icon, change, sub }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; change?: number; sub?: string }) {
  return (<Card className="p-4"><div className="flex items-center justify-between mb-2"><p className="text-sm font-medium text-muted-foreground">{title}</p><Icon className="h-5 w-5 text-muted-foreground" /></div><p className="text-2xl font-bold">{value}</p><div className="flex items-center gap-2 mt-1">{change !== undefined && change !== 0 && <span className={`flex items-center text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{change >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>}{sub && <span className="text-xs text-muted-foreground">{sub}</span>}</div></Card>)
}

function RevChart({ data }: { data: GrowthData['monthlyRevenue'] }) {
  if (data.length === 0) return <Card className="p-6"><h3 className="text-lg font-semibold mb-4">Monthly Revenue</h3><div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><BarChart3 className="h-12 w-12 mb-3 opacity-30" /><p className="text-sm">No revenue data yet</p></div></Card>
  const mx = Math.max(...data.map((d) => d.revenue))
  return (<Card className="p-6"><h3 className="text-lg font-semibold mb-4">Monthly Revenue</h3><div className="flex items-end gap-2 h-64">{data.map((item) => { const h = mx > 0 ? (item.revenue / mx) * 100 : 0; const sm = item.month.split(' ')[0]; return (<div key={item.month} className="flex-1 flex flex-col items-center gap-2"><div className="w-full flex items-end justify-center h-full"><div className="w-full max-w-[48px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg hover:from-blue-700 hover:to-blue-500 transition-all cursor-pointer group relative" style={{ height: `${Math.max(h, 2)}%` }}><div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"><div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg"><div className="font-medium">${item.revenue.toLocaleString()}</div><div className="text-slate-300">{item.orders} orders</div></div></div></div></div><span className="text-xs text-muted-foreground">{sm}</span></div>) })}</div></Card>)
}

function OrderTrend({ data }: { data: GrowthData['ordersByMonth'] }) {
  if (data.length === 0) return <Card className="p-6 h-full"><h3 className="text-lg font-semibold mb-4">Orders per Month</h3><div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><p className="text-sm">No order data yet</p></div></Card>
  const tot = data.reduce((s, d) => s + d.count, 0)
  return (<Card className="p-6 h-full"><h3 className="text-lg font-semibold mb-2">Orders per Month</h3><p className="text-sm text-muted-foreground mb-4">{tot} total orders</p><div className="space-y-2">{data.map((item) => { const mx = Math.max(...data.map((d) => d.count)); const w = mx > 0 ? (item.count / mx) * 100 : 0; const sm = item.month.split(' ')[0]; return (<div key={item.month} className="flex items-center gap-2"><span className="text-xs text-muted-foreground w-8">{sm}</span><div className="flex-1 h-4 rounded bg-muted"><div className="h-4 rounded bg-emerald-500 transition-all" style={{ width: `${w}%` }} /></div><span className="text-xs font-medium w-8 text-right">{item.count}</span></div>) })}</div></Card>)
}

function CustGrowth({ data }: { data: GrowthData['monthlyCustomers'] }) {
  if (data.length === 0) return <Card className="p-6"><h3 className="text-lg font-semibold mb-4">Total Customers Over Time</h3><div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Users className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm">No customer data yet</p></div></Card>
  const mx = Math.max(...data.map((d) => d.totalCustomers)); const W = 500; const H = 160; const P = 8
  const pts = data.map((d, i) => ({ x: P + (i / Math.max(data.length - 1, 1)) * (W - 2 * P), y: mx > 0 ? H - P - ((d.totalCustomers / mx) * (H - 2 * P)) : H - P }))
  const lp = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const ap = `${lp} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`
  return (<Card className="p-6"><h3 className="text-lg font-semibold mb-4">Total Customers Over Time</h3><svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" preserveAspectRatio="none"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" /></linearGradient></defs><path d={ap} fill="url(#gg)" /><path d={lp} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke="#8b5cf6" strokeWidth="2" />)}</svg><div className="flex justify-between mt-2 px-1">{data.map((d) => <span key={d.month} className="text-xs text-muted-foreground">{d.month.split(' ')[0]}</span>)}</div></Card>)
}

function NewCust({ data }: { data: GrowthData['monthlyCustomers'] }) {
  if (data.length === 0) return <Card className="p-6"><h3 className="text-lg font-semibold mb-4">New Customers per Month</h3><div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><p className="text-sm">No data yet</p></div></Card>
  const mx = Math.max(...data.map((d) => d.newCustomers)); const tot = data.reduce((s, d) => s + d.newCustomers, 0)
  return (<Card className="p-6"><h3 className="text-lg font-semibold mb-2">New Customers per Month</h3><p className="text-sm text-muted-foreground mb-4">{tot} new customers in this period</p><div className="flex items-end gap-2 h-40">{data.map((item) => { const h = mx > 0 ? (item.newCustomers / mx) * 100 : 0; const sm = item.month.split(' ')[0]; return (<div key={item.month} className="flex-1 flex flex-col items-center gap-1"><span className="text-xs font-medium text-muted-foreground">{item.newCustomers}</span><div className="w-full flex items-end justify-center h-full"><div className="w-full max-w-[40px] bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-lg" style={{ height: `${Math.max(h, 4)}%` }} /></div><span className="text-xs text-muted-foreground">{sm}</span></div>) })}</div></Card>)
}

function TopProds({ products }: { products: GrowthData['topProducts'] }) {
  if (products.length === 0) return <Card className="p-6"><h3 className="text-lg font-semibold mb-4">Top Selling Products</h3><div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Package className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm">No sales data yet</p></div></Card>
  const mx = Math.max(...products.map((p) => p.unitsSold)); const totRev = products.reduce((s, p) => s + p.revenue, 0)
  return (<Card className="p-6"><div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold">Top Selling Products</h3><span className="text-sm text-muted-foreground">${totRev.toLocaleString()} total revenue</span></div><div className="space-y-4">{products.map((p, i) => (<div key={p.name} className="flex items-center gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">{i + 1}</span><div className="flex-1 min-w-0"><div className="flex items-center justify-between mb-1"><p className="text-sm font-medium text-foreground truncate">{p.name}</p><div className="text-right shrink-0 ml-4"><p className="text-sm font-semibold">${p.revenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">{p.unitsSold} units</p></div></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${mx > 0 ? (p.unitsSold / mx) * 100 : 0}%` }} /></div></div></div>))}</div></Card>)
}


export default GrowthDashboardView
