import { Link } from 'react-router-dom'
import { BRAND } from '@/constants'
import { LogoCube } from '@/components/LogoCube'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { MetricCard } from '@/components/MetricCard'
import { Footer } from '@/components/Footer'
import { DollarSign, TrendingUp, Users, Calendar, ArrowLeft } from 'lucide-react'
import { useState } from 'react'

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
                    <p className="text-xs text-muted-foreground">{hex} / {token}</p>
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
                    <div
                      className="w-full h-12 rounded-lg mb-3"
                      style={{ backgroundColor: `var(${css})` }}
                    />
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
                    <div
                      className="w-full h-12 rounded-lg mb-3 border"
                      style={{ backgroundColor: `var(${css})` }}
                    />
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
                    <div
                      className="w-10 h-10 rounded-lg"
                      style={{ backgroundColor: `var(--chart-series-${i + 1})` }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{i + 1}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Metric Cards */}
        <Section title="Metric Cards">
          <p className="text-sm text-muted-foreground mb-6">
            Values animate with a count-up effect when they change. Try toggling:
          </p>
          <button
            onClick={() => setDarkPreview(p => !p)}
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
            <MetricCard
              icon={Calendar}
              label="Bookings"
              value={darkPreview ? 47 : 31}
              format="number"
              color="purple"
              staggerIndex={2}
            />
            <MetricCard
              icon={Users}
              label="Guests"
              value={darkPreview ? 126 : 84}
              format="number"
              color="orange"
              staggerIndex={3}
            />
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
                <button className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity text-sm">
                  Primary CTA
                </button>
                <button className="px-6 py-3 border border-border text-foreground rounded-full font-medium hover:bg-muted transition-colors text-sm">
                  Outline
                </button>
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm">
                  Action
                </button>
                <button className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all text-sm">
                  Ghost
                </button>
                <button className="px-4 py-2 text-primary hover:underline text-sm">
                  Link
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Header Pattern</h3>
              <p className="text-sm text-muted-foreground mb-3">
                All page headers use sticky positioning with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">backdrop-blur-sm</code> and a bottom border.
                The logo links home and animates on hover.
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
              <div className="flex gap-4 items-end">
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
              <div className="flex gap-4 items-end">
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
