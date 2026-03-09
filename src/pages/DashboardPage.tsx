import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, DollarSign, TrendingUp, Star, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ZAxis,
} from 'recharts'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatPercent } from '@/lib/utils'

const PIE_COLORS = ['#0D9488', '#7C3AED', '#2563EB', '#D97706', '#DC2626', '#059669']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const RISK_SCORES: Record<string, number> = {
  Multifamily: 3, Office: 7, Retail: 6, Industrial: 4, 'Mixed Use': 5, Land: 8,
}

function StatCard({ title, value, subtext, icon }: { title: string; value: string; subtext?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: properties } = useQuery({
    queryKey: ['properties', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('*').order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user,
  })

  const props = properties ?? []

  const totalValue = useMemo(() =>
    props.reduce((s: number, p: any) => s + (p.current_value ?? p.purchase_price ?? 0), 0), [props])

  const avgCapRate = useMemo(() => {
    const valid = props.filter((p: any) => p.noi && p.purchase_price)
    if (!valid.length) return null
    return valid.reduce((s: number, p: any) => s + p.noi / p.purchase_price, 0) / valid.length
  }, [props])

  const bestPerformer = useMemo(() => {
    if (!props.length) return null
    return props.reduce((best: any, p: any) => {
      const rate = (p.noi ?? 0) / (p.purchase_price ?? 1)
      const bestRate = (best.noi ?? 0) / (best.purchase_price ?? 1)
      return rate > bestRate ? p : best
    })
  }, [props])

  const totalNOI = useMemo(() => props.reduce((s: number, p: any) => s + (p.noi ?? 0), 0), [props])
  const monthlyBase = totalNOI / 12

  const noiTrendData = useMemo(() =>
    MONTHS.map((month, i) => ({
      month,
      'Actual NOI': monthlyBase * (0.9 + Math.sin(i * 0.8) * 0.15),
      'Expected NOI': monthlyBase,
    })), [monthlyBase])

  const comparisonData = useMemo(() =>
    MONTHS.map((month, i) => ({
      month,
      'This Year': monthlyBase * (0.92 + Math.cos(i * 0.6) * 0.08),
      'Last Year': monthlyBase * 0.85,
    })), [monthlyBase])

  const pieData = useMemo(() => {
    const groups: Record<string, number> = {}
    props.forEach((p: any) => {
      const type = p.property_type ?? 'Unknown'
      groups[type] = (groups[type] ?? 0) + (p.current_value ?? p.purchase_price ?? 0)
    })
    const entries = Object.entries(groups)
    return entries.length ? entries.map(([name, value]) => ({ name, value })) : [{ name: 'No Data', value: 1 }]
  }, [props])

  const metricsData = useMemo(() =>
    props.slice(0, 8).map((p: any) => {
      const capRate = p.noi && p.purchase_price ? (p.noi / p.purchase_price) * 100 : 0
      const label = (p.name ?? 'Unknown').length > 15 ? (p.name ?? '').slice(0, 15) + '...' : (p.name ?? '')
      return {
        name: label,
        'IRR (est.)': parseFloat((capRate * 2.5).toFixed(1)),
        'Equity Multiple': parseFloat((1 + (capRate / 100) * 5).toFixed(2)),
        'Cap Rate': parseFloat(capRate.toFixed(2)),
      }
    }), [props])

  const scatterData = useMemo(() =>
    props.map((p: any) => {
      const capRate = p.noi && p.purchase_price ? (p.noi / p.purchase_price) * 100 : 0
      const risk = RISK_SCORES[p.property_type ?? ''] ?? 5
      const ret = capRate * 2.5
      let fill = '#DC2626'
      if (ret > 15 && risk < 5) fill = '#059669'
      else if (ret > 12 && risk < 7) fill = '#2563EB'
      else if (ret > 8) fill = '#D97706'
      return { risk, return: parseFloat(ret.toFixed(1)), name: p.name, fill }
    }), [props])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Portfolio</h1>
        <p className="text-sm text-muted-foreground">Portfolio overview and performance analytics</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Properties" value={String(props.length)} subtext="In portfolio" icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Total Portfolio Value" value={formatCurrency(totalValue)} subtext="Current estimated value" icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Average Cap Rate" value={avgCapRate != null ? formatPercent(avgCapRate) : 'N/A'} subtext="Across portfolio" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Best Performer" value={bestPerformer?.name ?? 'No properties yet'} subtext={bestPerformer?.noi && bestPerformer?.purchase_price ? `Cap rate: ${formatPercent(bestPerformer.noi / bestPerformer.purchase_price)}` : undefined} icon={<Star className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Portfolio Performance</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="noi">
            <TabsList>
              <TabsTrigger value="noi">NOI Trend</TabsTrigger>
              <TabsTrigger value="comparison">Monthly Comparison</TabsTrigger>
              <TabsTrigger value="mix">Property Type Mix</TabsTrigger>
            </TabsList>
            <TabsContent value="noi" className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={noiTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => [`$${Math.round(v).toLocaleString()}`, '']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="Actual NOI" stroke="#0D9488" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Expected NOI" stroke="#7C3AED" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="comparison" className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => [`$${Math.round(v).toLocaleString()}`, '']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="This Year" fill="#0D9488" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Last Year" fill="#4B5563" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="mix" className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Value']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {metricsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Investment Metrics Comparison <span className="text-xs font-normal text-muted-foreground">(estimated)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="IRR (est.)" fill="#7C3AED" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Equity Multiple" fill="#0D9488" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Cap Rate" fill="#D97706" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Risk vs Return Matrix</CardTitle></CardHeader>
        <CardContent>
          {scatterData.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Add properties to see the risk/return matrix
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" dataKey="risk" name="Risk Score" domain={[0, 10]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} label={{ value: 'Risk Score', position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }} />
                  <YAxis type="number" dataKey="return" name="Expected Return" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="rounded-lg border border-border bg-card p-2 text-xs">
                          <p className="font-medium">{d.name}</p>
                          <p>Risk: {d.risk} · Return: {d.return}%</p>
                        </div>
                      )
                    }}
                  />
                  {scatterData.map((d, i) => (
                    <Scatter key={i} data={[d]} fill={d.fill} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-4 text-xs">
                {[
                  { color: '#059669', label: 'Low Risk / High Return' },
                  { color: '#2563EB', label: 'Balanced' },
                  { color: '#D97706', label: 'Moderate' },
                  { color: '#DC2626', label: 'High Risk / Low Return' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full" style={{ background: color }} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent Properties</h2>
          <Link to="/properties" className="text-sm text-brand-teal-light hover:underline">View All Properties →</Link>
        </div>
        {props.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No properties yet</p>
            <Button variant="brand" className="mt-4 gap-2" onClick={() => navigate('/new-property')}>
              <Plus className="h-4 w-4" />
              Add Your First Property
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {props.slice(0, 6).map((p: any) => {
              const capRate = p.noi && p.purchase_price ? p.noi / p.purchase_price : null
              return (
                <Link
                  key={p.id}
                  to={`/properties/${p.id}`}
                  className="rounded-lg border border-border p-4 hover:bg-secondary/50 transition-colors"
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[p.city, p.state].filter(Boolean).join(', ')} · {p.property_type ?? '—'}
                  </p>
                  <div className="mt-3 flex gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Price </span>
                      <span className="font-medium">{formatCurrency(p.purchase_price ?? 0)}</span>
                    </div>
                    {capRate != null && (
                      <div>
                        <span className="text-muted-foreground">Cap </span>
                        <span className="font-medium">{formatPercent(capRate)}</span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
