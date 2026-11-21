import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { TIERS, getTierMonthlyDollars, getTierYearlyDollars } from '@baileys/constants'
import { cn } from '@/lib/utils'

const CYCLES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
] as const

export function PricingTable() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly')
  const yearly = cycle === 'yearly'
  const tiers = TIERS.filter((t) => !t.contactSales)

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 grid gap-10 md:grid-cols-[1fr_1.15fr] md:gap-16 items-start">
      <div>
        <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white">Pricing</h2>
        <p className="mt-3 text-white/55 leading-relaxed">
          Every feature on every plan. The price depends on how many properties you sync.
        </p>
        <ul className="mt-8 space-y-3">
          {TIERS[0].features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-[var(--landing-body)]">
              <Check className="mt-0.5 w-4 h-4 shrink-0 text-white/40" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[var(--landing-card)] overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10">
          <span className="text-sm text-white/55">Billing</span>
          <div className="flex rounded-lg bg-white/5 p-0.5" role="radiogroup" aria-label="Billing cycle">
            {CYCLES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={cycle === key}
                onClick={() => setCycle(key)}
                className={cn(
                  'px-3.5 py-1 text-sm rounded-md transition-colors cursor-pointer',
                  cycle === key ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul>
          {tiers.map((tier) => (
            <li key={tier.slug} className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
              <div>
                <p className="font-medium text-white">{tier.name}</p>
                <p className="text-sm text-white/45">{tier.tagline}</p>
              </div>
              <div className="text-right">
                <p className="text-white">
                  <span className="landing-serif text-2xl font-semibold tabular-nums">${getTierMonthlyDollars(tier, yearly)}</span>
                  <span className="text-sm text-white/45"> /mo</span>
                </p>
                <p className="text-xs text-white/40">{yearly ? `$${getTierYearlyDollars(tier)} billed yearly` : 'Billed monthly'}</p>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-medium text-white">20 or more properties</p>
              <p className="text-sm text-white/45">Custom pricing and onboarding</p>
            </div>
            <a
              href="mailto:support@baileysanalytics.com?subject=Pricing%20for%2020%2B%20properties"
              className="text-sm font-medium text-white/80 hover:text-white underline underline-offset-4 decoration-white/30"
            >
              Contact us
            </a>
          </li>
        </ul>

        <div className="p-5 border-t border-white/10">
          <Link
            to="/signup"
            className="block h-11 leading-[2.75rem] text-center rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  )
}
