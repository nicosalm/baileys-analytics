import '@/styles/newsreader.css'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import {
  ArrowRight, Check,
  Shield, Zap, Lock, Building2, Calendar, DollarSign, Menu
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import {
  Sheet, SheetTrigger, SheetContent, SheetTitle
} from '@/components/ui/sheet'
import { useNavigate, useLocation } from 'react-router-dom'
import { BRAND } from '@/constants'
import { useInView } from '@/hooks'
import { usePageTitle } from '@/hooks/use-page-title'
import { Switch } from '@/components/ui/switch'
import { LogoCube } from '@/components/LogoCube'

export const Landing = () => {
  usePageTitle()
  const { state, logout, signInAsDemo } = useAuth()
  const isAuthenticated = state.status === 'authenticated'
  const navigate = useNavigate()
  const [yearlyBilling, setYearlyBilling] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const feature1 = useInView()
  const feature2 = useInView()
  const feature3 = useInView()
  const howItWorks = useInView()
  const quote = useInView()
  const pricing = useInView()
  const bottomCta = useInView()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const location = useLocation()

  const handleLogoClick = useCallback(() => {
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [location.pathname])

  const handleLogout = useCallback(() => logout(), [logout])
  const handleToggleBilling = useCallback(() => setYearlyBilling(prev => !prev), [])
  const handleTryDemo = useCallback(async () => {
    setDemoLoading(true)
    const success = await signInAsDemo()
    if (success) {
      navigate('/dashboard/overview')
    }
    setDemoLoading(false)
  }, [signInAsDemo, navigate])

  return (
    <div className="dark min-h-screen flex flex-col bg-[var(--landing-bg)]">
      {/* fixed header: banner + nav stacked */}
      <div className="fixed top-0 left-0 right-0 z-50">
        {/* announcement banner */}
        <a
          href="/updates/2026-04-09-launch.html"
          className="block w-full"
          style={{ background: 'oklch(0.18 0.09 300)', borderBottom: '1px solid oklch(0.28 0.10 300 / 0.5)' }}
        >
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-2.5 text-center text-xs font-medium text-white/60 hover:text-white/80 transition-colors flex items-center justify-center gap-2">
            <span>Baileys Analytics is now available — read the announcement</span>
            <span className="text-white/35">→</span>
          </div>
        </a>

        {/* nav — light text on dark hero */}
        <nav className={`transition-all duration-300 ${scrolled
          ? 'bg-[var(--landing-bg)/0.85] backdrop-blur-md shadow-sm border-b border-white/5'
          : 'bg-transparent'
          }`}>
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center" onClick={handleLogoClick}>
                  <LogoCube />
                  <span className="text-xl font-semibold text-white ml-3">
                    <span className="sm:hidden">Baileys</span>
                    <span className="hidden sm:inline">{BRAND.name}</span>
                  </span>
                </Link>
                <div className="hidden md:flex items-center gap-5">
                  <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer">Features</a>
                  <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer">Pricing</a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isAuthenticated ? (
                  <>
                    <button
                      onClick={handleLogout}
                      className="hidden sm:block px-4 py-2 text-white/70 hover:text-white font-medium transition-colors text-sm cursor-pointer"
                    >
                      Logout
                    </button>
                    <Link to="/dashboard/overview" className="whitespace-nowrap px-4 py-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity font-medium text-sm">
                      Dashboard
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="hidden md:inline-flex whitespace-nowrap px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors">
                      Log in
                    </Link>
                    <Link to="/signup" className="hidden md:inline-flex whitespace-nowrap px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity">
                      Get Started
                    </Link>
                  </>
                )}

                {/* mobile hamburger */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <button className="md:hidden p-2 text-white/70 hover:text-white transition-colors cursor-pointer" aria-label="Open menu">
                      <Menu className="w-6 h-6" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="dark bg-[var(--landing-bg)] border-white/10 w-64">
                    <SheetTitle className="text-white sr-only">Navigation</SheetTitle>
                    <nav className="flex flex-col gap-1 mt-4">
                      <a href="#features" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Features</a>
                      <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Pricing</a>
                      <div className="h-px bg-white/10 my-2" />
                      {isAuthenticated ? (
                        <>
                          <Link to="/dashboard/overview" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm font-medium text-white hover:bg-white/5 rounded-lg transition-colors">Dashboard</Link>
                          <button onClick={() => { handleLogout(); setMobileMenuOpen(false) }} className="px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left cursor-pointer">Logout</button>
                        </>
                      ) : (
                        <>
                          <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Log in</Link>
                          <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="mx-4 mt-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity font-medium text-sm text-center">Get Started</Link>
                        </>
                      )}
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* hero — dark atmospheric gradient */}
      <section className="landing-hero relative min-h-screen flex items-center justify-center pt-[7rem]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-24 md:py-32 text-center relative z-10">
          <div className="flex items-center justify-center gap-1.5 mb-6 hero-stagger" style={{ '--hero-index': 0 } as React.CSSProperties}>
            <span className="text-sm font-medium text-white/60">Built for</span>
            <picture>
              <source srcSet="/logos/ownerrez-wide.avif" type="image/avif" />
              <img src="/logos/ownerrez-wide.png" alt="OwnerRez" className="h-5 brightness-0 invert opacity-70" />
            </picture>
            <span className="text-sm font-medium text-white/60">users</span>
          </div>

          <p className="text-sm text-white/50 mb-4 hero-stagger" style={{ '--hero-index': 1 } as React.CSSProperties}>For OwnerRez hosts managing 2+ properties</p>

          <h1 className="landing-serif text-5xl sm:text-6xl md:text-7xl font-semibold text-white mb-6 tracking-tight leading-[1.1] hero-stagger" style={{ '--hero-index': 2 } as React.CSSProperties}>
            Know your real numbers.
          </h1>

          <p className="text-lg md:text-xl font-light text-[var(--landing-body-bright)] mb-10 max-w-2xl mx-auto leading-relaxed hero-stagger" style={{ '--hero-index': 3 } as React.CSSProperties}>
            Pull in booking data from OwnerRez. See revenue, occupancy, and profit breakdowns in minutes.
          </p>

          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 hero-stagger" style={{ '--hero-index': 4 } as React.CSSProperties}>
              <Link to="/signup" className="whitespace-nowrap px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity flex items-center">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <button
                onClick={handleTryDemo}
                disabled={demoLoading}
                className="whitespace-nowrap px-6 py-3 border border-white/20 text-white/80 rounded-full font-medium hover:bg-white/5 hover:border-white/30 transition-all text-sm disabled:opacity-50 cursor-pointer"
              >
                {demoLoading ? 'Loading...' : 'Try the Demo'}
              </button>
            </div>
          )}

          <p className="text-sm text-white/40 hero-stagger" style={{ '--hero-index': 5 } as React.CSSProperties}>
            $20/month or $192/year. Cancel anytime.
          </p>

          {/* hero image */}
          <div className="mt-16 md:mt-24 hero-stagger" style={{ '--hero-index': 6 } as React.CSSProperties}>
            <div className="relative max-w-4xl mx-auto">
              <div className="absolute -inset-6 bg-[var(--landing-glow-hero)] rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
                <picture>
                  <source srcSet="/demo/demo1.avif" type="image/avif" />
                  <img src="/demo/demo1.jpeg" alt="Baileys Analytics dashboard overview" className="w-full" />
                </picture>
              </div>
            </div>

            {/* trust strip */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 mt-10 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Secure OAuth</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>Data encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* feature 1 — revenue breakdown (secondary bg) */}
      <section id="features" className="landing-section-secondary py-28 md:py-36">
        <div
          ref={feature1.ref}
          className={`max-w-6xl mx-auto px-4 md:px-6 transition-all duration-700 ${feature1.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div>
              <div className="w-10 h-10 bg-[var(--landing-icon-bg)] rounded-xl flex items-center justify-center mb-5">
                <DollarSign className="w-5 h-5 text-[var(--landing-icon-fg)]" />
              </div>
              <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
                See where your money actually goes
              </h2>
              <p className="font-light text-[var(--landing-body)] leading-relaxed text-lg">
                Track platform fees, cleaning costs, and taxes by property. Know your real margins, not just gross revenue.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-[var(--landing-glow)] rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl ring-1 ring-white/10 overflow-hidden">
                <picture>
                  <source srcSet="/demo/demo2.avif" type="image/avif" />
                  <img src="/demo/demo2.jpeg" alt="Financial breakdown dashboard" className="w-full" loading="lazy" />
                </picture>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* feature 2 — property comparison (primary bg) */}
      <section className="landing-section-primary py-28 md:py-36">
        <div
          ref={feature2.ref}
          className={`max-w-6xl mx-auto px-4 md:px-6 transition-all duration-700 ${feature2.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="relative md:order-1">
              <div className="absolute -inset-4 bg-[var(--landing-glow)] rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl ring-1 ring-white/10 overflow-hidden">
                <picture>
                  <source srcSet="/demo/demo3.avif" type="image/avif" />
                  <img src="/demo/demo3.jpeg" alt="Property comparison dashboard" className="w-full" loading="lazy" />
                </picture>
              </div>
            </div>
            <div className="md:order-2">
              <div className="w-10 h-10 bg-[var(--landing-icon-bg)] rounded-xl flex items-center justify-center mb-5">
                <Building2 className="w-5 h-5 text-[var(--landing-icon-fg)]" />
              </div>
              <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
                Find your best and worst performers
              </h2>
              <p className="font-light text-[var(--landing-body)] leading-relaxed text-lg">
                Sort by occupancy, revenue, or profit. Compare properties side by side and know which ones are pulling their weight.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* feature 3 — occupancy heatmap (secondary bg) */}
      <section className="landing-section-secondary py-28 md:py-36">
        <div
          ref={feature3.ref}
          className={`max-w-6xl mx-auto px-4 md:px-6 transition-all duration-700 ${feature3.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div>
              <div className="w-10 h-10 bg-[var(--landing-icon-bg)] rounded-xl flex items-center justify-center mb-5">
                <Calendar className="w-5 h-5 text-[var(--landing-icon-fg)]" />
              </div>
              <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
                Spot gaps before they cost you
              </h2>
              <p className="font-light text-[var(--landing-body)] leading-relaxed text-lg">
                Visualize booked vs. available nights. See seasonal patterns and year-over-year trends at a glance.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-[var(--landing-glow)] rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl ring-1 ring-white/10 overflow-hidden">
                <picture>
                  <source srcSet="/demo/demo4.avif" type="image/avif" />
                  <img src="/demo/demo4.jpeg" alt="Occupancy heatmap dashboard" className="w-full" loading="lazy" />
                </picture>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* how it works (primary bg) */}
      <section id="how-it-works" className="landing-section-primary py-28 md:py-36">
        <div
          ref={howItWorks.ref}
          className={`max-w-4xl mx-auto px-4 md:px-6 transition-all duration-700 ${howItWorks.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          <div className="text-center mb-14">
            <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white mb-3">Up and running in 5 minutes</h2>
            <p className="text-sm uppercase tracking-[0.15em] text-white/40">No spreadsheets. No manual entry. Just connect and go.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
            {/* connector line (desktop) */}
            <div className="hidden md:block absolute top-5 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-white/10 via-white/20 to-white/10" />

            <div className={`text-center transition-all duration-700 ${howItWorks.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}>
              <div className="w-10 h-10 border border-white/25 bg-[var(--landing-bg)] text-white/70 rounded-full flex items-center justify-center text-sm font-medium mx-auto mb-4 relative z-10">1</div>
              <h3 className="font-semibold text-white mb-1">Connect OwnerRez</h3>
              <p className="text-sm text-[var(--landing-caption)]">Click, authorize, done. We use OAuth so we never see your password.</p>
            </div>

            <div className={`text-center transition-all duration-700 ${howItWorks.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} style={{ transitionDelay: howItWorks.isInView ? '100ms' : '0ms' }}>
              <div className="w-10 h-10 border border-white/25 bg-[var(--landing-bg)] text-white/70 rounded-full flex items-center justify-center text-sm font-medium mx-auto mb-4 relative z-10">2</div>
              <h3 className="font-semibold text-white mb-1">Data syncs automatically</h3>
              <p className="text-sm text-[var(--landing-caption)]">We pull 4 years of bookings, properties, and guests. Takes about 2 minutes.</p>
            </div>

            <div className={`text-center transition-all duration-700 ${howItWorks.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} style={{ transitionDelay: howItWorks.isInView ? '200ms' : '0ms' }}>
              <div className="w-10 h-10 border border-white/25 bg-[var(--landing-bg)] text-white/70 rounded-full flex items-center justify-center text-sm font-medium mx-auto mb-4 relative z-10">3</div>
              <h3 className="font-semibold text-white mb-1">Start exploring</h3>
              <p className="text-sm text-[var(--landing-caption)]">Your dashboards are ready. Filter by date, property, or tag.</p>
            </div>
          </div>
        </div>
      </section>

      {/* jerry's quote (secondary bg) */}
      <section className="landing-section-secondary py-20 md:py-28">
        <div
          ref={quote.ref}
          className={`max-w-3xl mx-auto px-4 md:px-6 text-center transition-all duration-700 ${quote.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          <blockquote className="landing-serif text-xl md:text-2xl text-white/80 leading-relaxed font-normal italic">
            "OwnerRez is great at managing my properties and bookings. I just needed a deeper analytics layer on top of it. So we built one. Now I check my numbers every morning."
          </blockquote>
          <p className="mt-6 text-sm text-white/40">
            — Jerry, co-founder & property manager
          </p>
        </div>
      </section>

      {/* pricing (primary bg) */}
      <section id="pricing" className="landing-section-primary py-28 md:py-36">
        <div
          ref={pricing.ref}
          className={`max-w-5xl mx-auto px-4 md:px-6 transition-all duration-700 ${pricing.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          <div className="text-center mb-10">
            <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white mb-3">One plan, one price</h2>
            <p className="text-sm uppercase tracking-[0.15em] text-white/40">Everything you need. No tiers, no upsells.</p>
          </div>

          {/* billing toggle */}
          <div className="flex justify-center items-center gap-3 mb-8">
            <span className={`text-sm transition-colors ${!yearlyBilling ? 'text-white font-medium' : 'text-white/40'}`}>Monthly</span>
            <Switch
              checked={yearlyBilling}
              onCheckedChange={handleToggleBilling}
              aria-label="Toggle billing cycle"
            />
            <span className={`text-sm transition-colors ${yearlyBilling ? 'text-white font-medium' : 'text-white/40'}`}>Yearly</span>
          </div>

          <div className="max-w-sm mx-auto">
            <div className="relative group">
              {/* gradient border glow */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-primary via-[oklch(0.60_0.10_272)] to-[oklch(0.45_0.12_280)] opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative bg-[var(--landing-card)] rounded-2xl px-8 py-10 md:px-10 flex flex-col min-h-[480px]">
                {/* plan label */}
                <div className="text-center mb-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-6">
                    Standard
                  </p>

                  {/* price */}
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="landing-serif text-5xl font-semibold tracking-tight text-white">
                      ${yearlyBilling ? '16' : '20'}
                    </span>
                    <span className="text-base text-white/40 font-normal">/mo</span>
                  </div>

                  {/* billing context */}
                  <div className="mt-2 h-5">
                    {yearlyBilling
                      ? <p className="text-sm text-success font-medium">$192/year — save $48</p>
                      : <p className="text-sm text-white/40">Billed monthly</p>
                    }
                  </div>
                </div>

                {/* divider */}
                <div className="h-px bg-white/10 mb-8" />

                {/* features */}
                <div className="space-y-3.5 mb-auto">
                  {[
                    'Full OwnerRez sync (4 years of data)',
                    '5 dashboards with filtering',
                    'Comparison mode & seasonal filters',
                    'Real-time webhook updates',
                    'Cancel anytime',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-3">
                      <div className="mt-0.5 w-4.5 h-4.5 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-success" strokeWidth={2.5} />
                      </div>
                      <span className="text-sm text-[var(--landing-body)] leading-snug">{item}</span>
                    </div>
                  ))}
                </div>

                {/* cta */}
                <div className="mt-10">
                  <Link to="/signup" className="block w-full h-11 leading-[2.75rem] text-center bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity text-sm font-semibold">
                    Subscribe
                  </Link>

                  <p className="text-center text-xs text-white/30 mt-3">
                    {yearlyBilling ? '$192/year' : '$20/month'}. Cancel anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* bottom cta (secondary bg) */}
      <section className="landing-section-secondary py-20 md:py-28">
        <div
          ref={bottomCta.ref}
          className={`max-w-3xl mx-auto px-4 md:px-6 text-center transition-all duration-700 ${bottomCta.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white">Ready to see your real numbers?</h2>
          {!isAuthenticated && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <Link to="/signup" className="whitespace-nowrap inline-flex items-center px-8 py-4 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity text-lg">
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <p className="text-sm text-white/30">Try the demo first. Subscribe when you're ready.</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
