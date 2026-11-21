import { Link } from 'react-router-dom'
import { BRAND } from '@/constants'
import { LogoCube } from '@/components/LogoCube'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { Footer } from '@/components/Footer'
import { DollarSign, TrendingUp, Users, Calendar, ArrowLeft, BarChart3, Info } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { resolveToken } from '@/lib/theme'
import {
  PieChart,
  Pie,
  Cell,
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

const LOGO_FILLS = [
  { hex: '#dbeafe', label: 'Sky', token: 'blue-100' },
  { hex: '#60a5fa', label: 'Azure', token: 'blue-400' },
  { hex: '#3b82f6', label: 'Royal', token: 'blue-500' },
  { hex: '#1e3a8a', label: 'Navy', token: 'blue-900' },
]

const THEME_COLORS = [
  { label: 'Primary', light: 'oklch(0.45 0.085 265)', dark: 'oklch(0.78 0.08 265)', css: '--primary' },
  { label: 'Success', light: 'oklch(0.696 0.167 162.5)', dark: 'oklch(0.72 0.17 162.5)', css: '--success' },
  { label: 'Warning', light: 'oklch(0.795 0.184 78.0)', dark: 'oklch(0.79 0.18 78.0)', css: '--warning' },
  { label: 'Danger', light: 'oklch(0.637 0.237 25.3)', dark: 'oklch(0.65 0.22 25.3)', css: '--danger' },
  { label: 'Info', light: 'oklch(0.588 0.19 240)', dark: 'oklch(0.65 0.19 240)', css: '--info' },
]

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-16">
    <h2 className="text-2xl font-bold text-foreground mb-6 pb-3 border-b border-border">{title}</h2>
    {children}
  </section>
)

const StaggerDemo = () => {
  const [key, setKey] = useState(0)
  return (
    <div>
      <button type="button" onClick={() => setKey((k) => k + 1)} className="text-sm text-primary hover:underline mb-4 cursor-pointer">
        Replay animation
      </button>
      <div key={key} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-card rounded-lg border p-4 text-center stagger-fade-in"
            style={{ '--stagger-index': i } as React.CSSProperties}
          >
            <p className="text-lg font-bold">{i + 1}</p>
            <p className="text-xs text-muted-foreground mt-1">{i * 60}ms delay</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const DONUT_DATA = [
  { name: 'Airbnb', value: 18200 },
  { name: 'VRBO', value: 9800 },
  { name: 'Direct', value: 4100 },
]
const DONUT_COLORS = ['#FF5A5F', '#0061A7', '#22C55E']

const DonutDemo = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const cardBg = useResolvedToken('--card')
  const total = DONUT_DATA.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center mb-4">
        <BarChart3 className="w-5 h-5 mr-2 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Revenue by Platform</h3>
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={DONUT_DATA}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              dataKey="value"
              stroke={cardBg}
              strokeWidth={2}
              animationBegin={0}
              animationDuration={500}
              animationEasing="ease-out"
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {DONUT_DATA.map((_, i) => (
                <Cell
                  key={i}
                  fill={DONUT_COLORS[i]}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.3}
                  style={{ transition: 'opacity 0.2s ease' }}
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  const { cx, cy } = viewBox as { cx: number; cy: number }
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={cx} y={cy - 8} className="fill-foreground text-lg font-bold">
                        ${(total / 1000).toFixed(1)}k
                      </tspan>
                      <tspan x={cx} y={cy + 12} className="fill-muted-foreground text-xs">
                        Total
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 justify-center text-xs mt-2">
        {DONUT_DATA.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: DONUT_COLORS[i] }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const BAR_DATA = [
  { name: 'Lakeview Lodge', revenue: 8200 },
  { name: 'Pine Ridge Cabin', revenue: 6800 },
  { name: 'Harbor House', revenue: 5400 },
  { name: 'Sunset Cottage', revenue: 4100 },
  { name: 'Cedar Point', revenue: 3200 },
]

const BarDemo = () => {
  const gridColor = useResolvedToken('--border')
  const axisColor = useResolvedToken('--muted-foreground')
  const revenueColor = useResolvedToken('--metric-revenue')
  const goalColor = useResolvedToken('--chart-goal')
  const cursorColor = useResolvedToken('--muted')

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center mb-4">
        <BarChart3 className="w-5 h-5 mr-2 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Revenue by Property</h3>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={BAR_DATA} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              stroke={axisColor}
              tick={{ fill: axisColor }}
            />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
            <RechartsTooltip
              isAnimationActive={false}
              cursor={{ fill: cursorColor, opacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                return (
                  <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
                    <p className="font-semibold text-sm mb-1">{payload[0].payload.name}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: revenueColor }} />
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">${(payload[0].value as number).toLocaleString()}</span>
                    </div>
                  </div>
                )
              }}
            />
            <ReferenceLine
              x={6000}
              stroke={goalColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{ value: 'Goal: $6k', position: 'insideTopLeft', fill: goalColor, fontSize: 12, fontWeight: 600, offset: 4 }}
            />
            <Bar
              dataKey="revenue"
              fill={revenueColor}
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function useResolvedToken(varName: string) {
  const [value, setValue] = useState('')
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    setValue(resolveToken(varName))
    return () => {
      mounted.current = false
    }
  }, [varName])
  return value
}

export const Branding = () => {
  const [darkPreview, setDarkPreview] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <LogoCube />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-foreground">{BRAND.name}</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">Brand Guide</p>
              </div>
            </Link>
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 px-3 py-1.5 hover:bg-muted rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 md:px-6 py-12 w-full">
        {/* Logo */}
        <Section title="Logo">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card rounded-xl border p-8 flex flex-col items-center justify-center gap-4">
              <LogoCube className="w-20 h-20" />
              <span className="text-lg font-semibold">{BRAND.name}</span>
              <p className="text-xs text-muted-foreground">Hover the logo to see the shuffle animation</p>
            </div>
            <div className="bg-[oklch(0.12_0.02_265)] rounded-xl border border-white/10 p-8 flex flex-col items-center justify-center gap-4">
              <LogoCube className="w-20 h-20" />
              <span className="text-lg font-semibold text-white">{BRAND.name}</span>
              <p className="text-xs text-white/40">On dark background</p>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Logo Quadrants</h3>
            <div className="flex gap-4 flex-wrap">
              {LOGO_FILLS.map(({ hex, label, token }) => (
                <div key={hex} className="flex items-center gap-3 bg-card rounded-lg border px-4 py-3">
                  <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: hex }} />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {hex} / {token}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <div className="bg-card rounded-xl border p-8 space-y-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Font Family</p>
              <p className="text-3xl font-bold">DM Sans</p>
              <p className="text-sm text-muted-foreground mt-1">Weights: 400 Regular, 500 Medium, 600 SemiBold, 700 Bold</p>
            </div>
            <div className="space-y-3 border-t border-border pt-6">
              <div className="flex items-baseline gap-4">
                <span className="text-xs text-muted-foreground w-24 shrink-0">7xl / Bold</span>
                <span className="text-7xl font-bold leading-tight">Aa</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-xs text-muted-foreground w-24 shrink-0">4xl / Semi</span>
                <span className="text-4xl font-semibold">Know your real numbers.</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-xs text-muted-foreground w-24 shrink-0">2xl / Semi</span>
                <span className="text-2xl font-semibold">Section Heading</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-xs text-muted-foreground w-24 shrink-0">xl / Semi</span>
                <span className="text-xl font-semibold">Card Title</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-xs text-muted-foreground w-24 shrink-0">base / Reg</span>
                <span className="text-base">Body text for descriptions and content.</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-xs text-muted-foreground w-24 shrink-0">sm / Med</span>
                <span className="text-sm font-medium">Label or navigation text</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-xs text-muted-foreground w-24 shrink-0">xs / Reg</span>
                <span className="text-xs text-muted-foreground">Caption, subtitle, helper text</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Colors */}
        <Section title="Color System">
          <p className="text-sm text-muted-foreground mb-6">
            All colors use the OKLCh color space for perceptual uniformity. Each token has a light and dark mode value.
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Semantic Tokens</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {THEME_COLORS.map(({ label, css }) => (
                  <div key={css} className="bg-card rounded-lg border p-4 text-center">
                    <div className="w-full h-12 rounded-lg mb-3" style={{ backgroundColor: `var(${css})` }} />
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{css}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Surface Palette</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Background', css: '--background' },
                  { label: 'Card', css: '--card' },
                  { label: 'Muted', css: '--muted' },
                  { label: 'Border', css: '--border' },
                ].map(({ label, css }) => (
                  <div key={css} className="bg-card rounded-lg border p-4 text-center">
                    <div className="w-full h-12 rounded-lg mb-3 border" style={{ backgroundColor: `var(${css})` }} />
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{css}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Chart Series</h3>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="text-center">
                    <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: `var(--chart-series-${i + 1})` }} />
                    <p className="text-xs text-muted-foreground mt-1">{i + 1}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Metric Cards */}
        <Section title="Metric Cards">
          <p className="text-sm text-muted-foreground mb-6">Values animate with a count-up effect when they change. Try toggling:</p>
          <button
            type="button"
            onClick={() => setDarkPreview((p) => !p)}
            className="text-sm text-primary hover:underline mb-6 cursor-pointer"
          >
            Click to swap values and see the count-up animation
          </button>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={DollarSign}
              label="Revenue"
              value={darkPreview ? 48250 : 32100}
              format="currency"
              color="blue"
              staggerIndex={0}
              trend={{ value: darkPreview ? 12.3 : -4.2, period: 'vs prev' }}
            />
            <MetricCard
              icon={TrendingUp}
              label="Occupancy"
              value={darkPreview ? 78.5 : 62.1}
              format="percent"
              color="green"
              staggerIndex={1}
              trend={{ value: darkPreview ? 5.1 : 8.7, period: 'vs prev' }}
            />
            <MetricCard icon={Calendar} label="Bookings" value={darkPreview ? 47 : 31} format="number" color="purple" staggerIndex={2} />
            <MetricCard icon={Users} label="Guests" value={darkPreview ? 126 : 84} format="number" color="orange" staggerIndex={3} />
          </div>
        </Section>

        {/* Motion & Animation */}
        <Section title="Motion & Animation">
          <p className="text-sm text-muted-foreground mb-6">
            All motion uses a consistent timing language. The base duration is 200ms for micro-interactions, scaling up to 500-600ms for
            entrance animations. Easing is <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ease-out</code> for entrances and{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ease</code> for hover/toggle transitions.
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Timing Constants</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Micro', duration: '200ms', easing: 'ease', usage: 'Hover, toggle, theme switch' },
                  { label: 'Stagger fade-in', duration: '400ms', easing: 'ease-out', usage: 'Card entrances, stagger = index \u00d7 60ms' },
                  { label: 'Chart draw', duration: '500ms', easing: 'ease-out', usage: 'Recharts bars, donuts, lines' },
                  { label: 'Count-up', duration: '600ms', easing: 'cubic (1-(1-t)\u00b3)', usage: 'Metric card numbers' },
                ].map(({ label, duration, easing, usage }) => (
                  <div key={label} className="bg-card rounded-lg border p-4">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-lg font-bold font-mono mt-1">{duration}</p>
                    <p className="text-xs text-muted-foreground mt-1">{easing}</p>
                    <p className="text-xs text-muted-foreground/70 mt-2">{usage}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Stagger Fade-In</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Cards animate in sequence with a 60ms offset per item. Uses{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">translateY(8px)</code> + opacity. Applied via the{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">stagger-fade-in</code> CSS class with{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">--stagger-index</code> custom property.
              </p>
              <StaggerDemo />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Hover Patterns</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-card rounded-lg border p-6 text-center transition-all duration-200 hover:shadow-md hover:scale-[1.01] hover:bg-muted/30 cursor-pointer">
                  <p className="text-sm font-medium">Card Hover</p>
                  <p className="text-xs text-muted-foreground mt-1">shadow-md + scale(1.01) + bg-muted/30</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">200ms ease</p>
                </div>
                <div className="bg-card rounded-lg border p-6 text-center hover-lift cursor-pointer">
                  <p className="text-sm font-medium">Hover Lift</p>
                  <p className="text-xs text-muted-foreground mt-1">translateY(-4px) + shadow</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">200ms ease</p>
                </div>
                <div className="bg-card rounded-lg border p-6 text-center transition-colors duration-200 hover:bg-muted cursor-pointer">
                  <p className="text-sm font-medium">Surface Hover</p>
                  <p className="text-xs text-muted-foreground mt-1">bg-muted on hover</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">200ms ease</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Theme Transitions</h3>
              <p className="text-sm text-muted-foreground">
                Background, text, and border colors transition at 200ms ease on theme switch. Applied globally to{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">body</code>,{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.bg-card</code>,{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.bg-background</code>, and{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.bg-muted</code> surfaces.
              </p>
            </div>
          </div>
        </Section>

        {/* Chart Styling */}
        <Section title="Chart Styling">
          <p className="text-sm text-muted-foreground mb-6">
            All charts use Recharts, wrapped in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ChartWrapper</code> for consistent
            card framing, loading/error/empty states, and optional info banners. Colors resolve from CSS custom properties at render time
            via <code className="text-xs bg-muted px-1.5 py-0.5 rounded">resolveToken()</code> so charts stay in sync with the theme.
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Metric Colors</h3>
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'Revenue', css: '--metric-revenue' },
                  { label: 'Occupancy', css: '--metric-occupancy' },
                  { label: 'Bookings', css: '--metric-bookings' },
                  { label: 'Tax', css: '--metric-tax' },
                  { label: 'Expenses', css: '--metric-expenses' },
                  { label: 'Profit', css: '--metric-profit' },
                ].map(({ label, css }) => (
                  <div key={css} className="flex items-center gap-3 bg-card rounded-lg border px-4 py-3">
                    <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: `var(${css})` }} />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{css}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Infrastructure Colors</h3>
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'Grid', css: '--border' },
                  { label: 'Axis', css: '--muted-foreground' },
                  { label: 'Reference', css: '--chart-reference' },
                  { label: 'Goal', css: '--chart-goal' },
                  { label: 'Comparison', css: '--chart-comparison' },
                ].map(({ label, css }) => (
                  <div key={css} className="flex items-center gap-3 bg-card rounded-lg border px-4 py-3">
                    <div className="w-10 h-6 rounded border" style={{ backgroundColor: `var(${css})` }} />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{css}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Donut Chart</h3>
              <p className="text-sm text-muted-foreground mb-4">
                innerRadius 55%, outerRadius 80%. Segments separated by{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">stroke=card-bg</code> + strokeWidth 2. Sorted largest-first. Center
                label: large metric + caption. Hover dims inactive segments to 0.3 opacity at 200ms.
              </p>
              <DonutDemo />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Bar Chart</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Grid: dashed 3 3 using <code className="text-xs bg-muted px-1.5 py-0.5 rounded">--border</code>. Axis stroke/tick:{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">--muted-foreground</code>. Bars: radius [0,4,4,0], maxBarSize 28,
                500ms ease-out entrance. Cursor hover: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">var(--muted)</code> at 0.3
                opacity. Reference lines: dashed "6 4" with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">--chart-goal</code>.
              </p>
              <BarDemo />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Tooltip</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Custom tooltips on all charts. Animation disabled (
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">isAnimationActive=false</code>) for instant display. Color swatches
                inside tooltips use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">w-3 h-3 rounded-sm</code>.
              </p>
              <div className="flex gap-4 flex-wrap">
                <div className="bg-card p-3 rounded-lg shadow-lg border border-border inline-block">
                  <p className="font-semibold text-sm mb-2">Jan 2026</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--metric-revenue)' }} />
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">$12,450</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--metric-expenses)' }} />
                      <span className="text-muted-foreground">Expenses:</span>
                      <span className="font-medium">$3,200</span>
                    </div>
                  </div>
                </div>
                <div className="bg-card rounded-lg border p-4 flex-1 min-w-[200px]">
                  <p className="text-xs text-muted-foreground font-mono mb-2">Tooltip anatomy</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Container: <code className="bg-muted px-1 rounded">bg-card p-3 rounded-lg shadow-lg border</code>
                    </p>
                    <p>
                      Title: <code className="bg-muted px-1 rounded">font-semibold text-sm mb-2</code>
                    </p>
                    <p>
                      Swatches: <code className="bg-muted px-1 rounded">w-3 h-3 rounded-sm</code>
                    </p>
                    <p>Animation: disabled (instant)</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Legend</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Unified bottom legends across all charts. No Recharts default legend — custom rendered.
              </p>
              <div className="bg-card rounded-lg border p-6">
                <div className="flex flex-wrap gap-3 justify-center text-xs">
                  {['Revenue', 'Occupancy', 'Bookings', 'Tax', 'Expenses', 'Profit'].map((name) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: `var(--metric-${name.toLowerCase()})` }} />
                      <span className="text-muted-foreground">{name}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground font-mono text-center">
                  Swatch: w-3 h-2.5 rounded-sm &middot; Gap: gap-1.5 &middot; Text: text-muted-foreground
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Chart Wrapper States</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <ChartWrapper title="Loading State" icon={BarChart3} loading height={160}>
                  <span />
                </ChartWrapper>
                <ChartWrapper title="Error State" icon={BarChart3} error="Connection timeout" height={160}>
                  <span />
                </ChartWrapper>
                <ChartWrapper title="Empty State" icon={BarChart3} noData noDataMessage="No bookings in period" height={160}>
                  <span />
                </ChartWrapper>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Info Banner</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Optional contextual info banner inside chart cards. Uses{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">bg-info-subtle border-info/30</code>.
              </p>
              <div className="bg-info-subtle border border-info/30 rounded-lg p-3">
                <div className="flex items-start">
                  <Info className="w-4 h-4 text-info mr-2 mt-0.5" />
                  <div className="text-sm text-info-fg">
                    Platform fees shown are estimates based on standard OTA rates. Actual fees may vary by listing agreement.
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Platform Colors</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Booking platforms use fixed brand colors (not theme tokens) for instant recognition.
              </p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'Airbnb', color: '#FF5A5F' },
                  { label: 'VRBO', color: '#0061A7' },
                  { label: 'Booking.com', color: '#003580' },
                  { label: 'Google', color: '#4285F4' },
                  { label: 'Direct', color: '#22C55E' },
                  { label: 'Other', color: '#6B7280' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-2 bg-card rounded-lg border px-3 py-2">
                    <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground font-mono">{color}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Empty States */}
        <Section title="Empty States">
          <p className="text-sm text-muted-foreground mb-6">
            The logo quadrant motif at reduced opacity serves as the branded empty-state icon across charts, tables, and data views.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl border p-8 flex flex-col items-center justify-center text-center">
              <EmptyQuadrants className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No data available</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your filters</p>
            </div>
            <div className="bg-card rounded-xl border p-8 flex flex-col items-center justify-center text-center">
              <EmptyQuadrants className="w-16 h-16 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No bookings found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Data will appear after your first sync</p>
            </div>
            <div className="bg-card rounded-xl border p-8 flex flex-col items-center justify-center text-center">
              <EmptyQuadrants className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No chart data</p>
            </div>
          </div>
        </Section>

        {/* Interactive Elements */}
        <Section title="Interactive Elements">
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Buttons</h3>
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  type="button"
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity text-sm"
                >
                  Primary CTA
                </button>
                <button
                  type="button"
                  className="px-6 py-3 border border-border text-foreground rounded-full font-medium hover:bg-muted transition-colors text-sm"
                >
                  Outline
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
                >
                  Action
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all text-sm"
                >
                  Ghost
                </button>
                <button type="button" className="px-4 py-2 text-primary hover:underline text-sm">
                  Link
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Header Pattern</h3>
              <p className="text-sm text-muted-foreground mb-3">
                All page headers use sticky positioning with{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">backdrop-blur-sm</code> and a bottom border. The logo links home
                and animates on hover.
              </p>
              <div className="bg-background/80 backdrop-blur-sm border rounded-xl p-4 flex items-center gap-3">
                <LogoCube className="w-9 h-9" />
                <div>
                  <p className="text-xl font-semibold">{BRAND.name}</p>
                  <p className="text-xs text-muted-foreground -mt-0.5">Subtitle</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Spacing & Radius */}
        <Section title="Spacing & Radius">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Border Radius</h3>
              <div className="flex flex-wrap items-end gap-4">
                {[
                  { label: 'sm', cls: 'rounded-sm' },
                  { label: 'md', cls: 'rounded-md' },
                  { label: 'lg', cls: 'rounded-lg' },
                  { label: 'xl', cls: 'rounded-xl' },
                  { label: 'full', cls: 'rounded-full' },
                ].map(({ label, cls }) => (
                  <div key={label} className="text-center">
                    <div className={`w-14 h-14 bg-primary/20 border-2 border-primary/40 ${cls}`} />
                    <p className="text-xs text-muted-foreground mt-2">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Elevation</h3>
              <div className="flex flex-wrap items-end gap-4">
                {[
                  { label: 'flat', cls: 'border' },
                  { label: 'sm', cls: 'shadow-sm border' },
                  { label: 'md', cls: 'shadow-md' },
                  { label: 'lg', cls: 'shadow-lg' },
                  { label: '2xl', cls: 'shadow-2xl' },
                ].map(({ label, cls }) => (
                  <div key={label} className="text-center">
                    <div className={`w-14 h-14 bg-card rounded-lg ${cls}`} />
                    <p className="text-xs text-muted-foreground mt-2">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  )
}
