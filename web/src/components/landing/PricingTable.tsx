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
        <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-landing-fg">Pricing</h2>
        <p className="mt-3 text-landing-caption leading-relaxed">
          Every feature on every plan. Connect OwnerRez first and we'll match you to the plan for your active properties.
        </p>
        <ul className="mt-8 space-y-3">
          {TIERS[0].features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-landing-body">
              <Check className="mt-0.5 w-4 h-4 shrink-0 text-landing-caption" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-landing-fg/10 bg-landing-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-landing-fg/10">
          <span className="text-sm text-landing-caption">Billing</span>
          <div className="flex rounded-lg bg-landing-fg/5 p-0.5" role="radiogroup" aria-label="Billing cycle">
            {CYCLES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={cycle === key}
                onClick={() => setCycle(key)}
                className={cn(
                  'px-3.5 py-1 text-sm rounded-md transition-colors cursor-pointer',
                  cycle === key ? 'bg-landing-fg/15 text-landing-fg' : 'text-landing-caption hover:text-landing-fg/80',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul>
          {tiers.map((tier) => (
            <li key={tier.slug} className="flex items-center justify-between gap-4 px-5 py-4 border-b border-landing-fg/5">
              <div>
                <p className="font-medium text-landing-fg">{tier.name}</p>
                <p className="text-sm text-landing-caption">{tier.tagline}</p>
              </div>
              <div className="text-right">
                <p className="text-landing-fg">
                  <span className="landing-serif text-2xl font-semibold tabular-nums">${getTierMonthlyDollars(tier, yearly)}</span>
                  <span className="text-sm text-landing-caption"> /mo</span>
                </p>
                <p className="text-xs text-landing-caption">{yearly ? `$${getTierYearlyDollars(tier)} billed yearly` : 'Billed monthly'}</p>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-medium text-landing-fg">20 or more properties</p>
              <p className="text-sm text-landing-caption">Custom pricing and onboarding</p>
            </div>
            <a
              href="mailto:support@baileysanalytics.com?subject=Pricing%20for%2020%2B%20properties"
              className="text-sm font-medium text-landing-fg/80 hover:text-landing-fg underline underline-offset-4 decoration-landing-fg/30"
            >
              Contact us
            </a>
          </li>
        </ul>

        <div className="p-5 border-t border-landing-fg/10">
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
