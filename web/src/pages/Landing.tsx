import '@/styles/newsreader.css'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import { ProductTour } from '@/components/landing/ProductTour'
import { PricingTable } from '@/components/landing/PricingTable'
import { ArrowRight, Menu } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useNavigate, useLocation } from 'react-router-dom'
import { BRAND } from '@/constants'
import { usePageTitle } from '@/hooks/use-page-title'
import { LogoCube } from '@/components/LogoCube'

const STATS = [
  { value: '$17M+', label: 'booking revenue analyzed' },
  { value: '26K+', label: 'reservations' },
  { value: '53K+', label: 'nights' },
  { value: '85', label: 'properties' },
]

const STEPS = [
  { title: 'Connect OwnerRez', body: 'Authorize Baileys from OwnerRez. Your OwnerRez password is never shared with us.' },
  {
    title: 'Import your history',
    body: 'Four years of bookings, properties, and guests import in a few minutes. Webhooks keep everything current after that.',
  },
  { title: 'Read your numbers', body: 'Filter every dashboard by date range, property, group, or tag, and compare any two periods.' },
]

export const Landing = () => {
  usePageTitle()
  const { state, logout, signInAsDemo } = useAuth()
  const isAuthenticated = state.status === 'authenticated'
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      <div className="fixed top-0 left-0 right-0 z-50">
        <nav
          className={`transition-all duration-300 ${
            scrolled ? 'bg-[var(--landing-bg)/0.85] backdrop-blur-md shadow-sm border-b border-white/5' : 'bg-transparent'
          }`}
        >
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
                  <a href="#tour" className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer">
                    Product
                  </a>
                  <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer">
                    Pricing
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="hidden sm:block px-4 py-2 text-white/70 hover:text-white font-medium transition-colors text-sm cursor-pointer"
                    >
                      Logout
                    </button>
                    <Link
                      to="/dashboard/overview"
                      className="whitespace-nowrap px-4 py-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity font-medium text-sm"
                    >
                      Dashboard
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="hidden md:inline-flex whitespace-nowrap px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
                    >
                      Log in
                    </Link>
                    <Link
                      to="/signup"
                      className="hidden md:inline-flex whitespace-nowrap px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
                    >
                      Get started
                    </Link>
                  </>
                )}

                {/* mobile hamburger */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="md:hidden p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
                      aria-label="Open menu"
                    >
                      <Menu className="w-6 h-6" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="dark bg-[var(--landing-bg)] border-white/10 w-64">
                    <SheetTitle className="text-white sr-only">Navigation</SheetTitle>
                    <nav className="flex flex-col gap-1 mt-4">
                      <a
                        href="#tour"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        Product
                      </a>
                      <a
                        href="#pricing"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        Pricing
                      </a>
                      <div className="h-px bg-white/10 my-2" />
                      {isAuthenticated ? (
                        <>
                          <Link
                            to="/dashboard/overview"
                            onClick={() => setMobileMenuOpen(false)}
                            className="px-4 py-3 text-sm font-medium text-white hover:bg-white/5 rounded-lg transition-colors"
                          >
                            Dashboard
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              handleLogout()
                              setMobileMenuOpen(false)
                            }}
                            className="px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left cursor-pointer"
                          >
                            Logout
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            to="/login"
                            onClick={() => setMobileMenuOpen(false)}
                            className="px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                          >
                            Log in
                          </Link>
                          <Link
                            to="/signup"
                            onClick={() => setMobileMenuOpen(false)}
                            className="mx-4 mt-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity font-medium text-sm text-center"
                          >
                            Get started
                          </Link>
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
      <section className="landing-hero relative flex items-center justify-center pt-[4.5rem]">
        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pt-16 pb-20 md:pt-24 md:pb-24 text-center relative z-10">
          <div className="flex items-center justify-center gap-1.5 mb-6 hero-stagger" style={{ '--hero-index': 0 } as React.CSSProperties}>
            <span className="text-sm font-medium text-white/60">Built for</span>
            <picture>
              <source srcSet="/logos/ownerrez-wide.avif" type="image/avif" />
              <img src="/logos/ownerrez-wide.png" alt="OwnerRez" className="h-5 brightness-0 invert opacity-70" />
            </picture>
            <span className="text-sm font-medium text-white/60">hosts</span>
          </div>

          <h1
            className="landing-serif text-5xl sm:text-6xl md:text-7xl font-semibold text-white mb-6 tracking-tight leading-[1.1] hero-stagger"
            style={{ '--hero-index': 1 } as React.CSSProperties}
          >
            Know your real numbers.
          </h1>

          <p
            className="text-lg md:text-xl font-light text-[var(--landing-body-bright)] mb-10 max-w-2xl mx-auto leading-relaxed hero-stagger"
            style={{ '--hero-index': 2 } as React.CSSProperties}
          >
            Revenue, profit, occupancy, and booking pace for every property, built from your OwnerRez data.
          </p>

          {!isAuthenticated && (
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 hero-stagger"
              style={{ '--hero-index': 3 } as React.CSSProperties}
            >
              <Link
                to="/signup"
                className="whitespace-nowrap px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity flex items-center"
              >
                Get started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <button
                type="button"
                onClick={handleTryDemo}
                disabled={demoLoading}
                className="whitespace-nowrap px-6 py-3 border border-white/20 text-white/80 rounded-full font-medium hover:bg-white/5 hover:border-white/30 transition-all text-sm disabled:opacity-50 cursor-pointer"
              >
                {demoLoading ? 'Opening demo' : 'Try the demo'}
              </button>
            </div>
          )}

          <p className="text-sm text-white/40 hero-stagger" style={{ '--hero-index': 4 } as React.CSSProperties}>
            From $17/month, billed yearly. Cancel anytime.
          </p>

          <div
            id="tour"
            className="mt-14 md:mt-20 max-w-5xl mx-auto hero-stagger scroll-mt-20"
            style={{ '--hero-index': 5 } as React.CSSProperties}
          >
            <ProductTour />
          </div>
        </div>
      </section>

      <section className="landing-section-primary border-y border-white/5">
        <dl className="max-w-5xl mx-auto px-4 md:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-y-8 md:divide-x md:divide-white/10">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center px-4">
              <dt className="sr-only">{label}</dt>
              <dd className="landing-serif text-3xl md:text-4xl font-semibold text-white tabular-nums">{value}</dd>
              <dd className="mt-1 text-sm text-white/45">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="how-it-works" className="landing-section-primary py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-4 md:px-6 grid gap-10 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white">Set up in a few minutes</h2>
          <ol className="space-y-6">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="grid grid-cols-[2rem_1fr] gap-x-3">
                <span className="text-sm font-medium text-white/35 tabular-nums pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--landing-caption)]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section-secondary py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <blockquote className="landing-serif text-xl md:text-2xl text-white/80 leading-relaxed font-normal italic">
            “OwnerRez is great at managing my properties and bookings. I needed a deeper analytics layer on top of it, so we built one. Now
            I check my numbers every morning.”
          </blockquote>
          <p className="mt-6 text-sm text-white/40">Jerry, co-founder and Door County host</p>
        </div>
      </section>

      <section id="pricing" className="landing-section-primary py-20 md:py-24 scroll-mt-16">
        <PricingTable />
      </section>

      <section className="landing-section-secondary py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <h2 className="landing-serif text-3xl md:text-4xl font-semibold text-white">See your own numbers</h2>
          <p className="mt-3 text-white/50">Connect OwnerRez and your dashboards are ready after the first sync.</p>
          {!isAuthenticated && (
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/signup"
                className="whitespace-nowrap inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity"
              >
                Get started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <button
                type="button"
                onClick={handleTryDemo}
                disabled={demoLoading}
                className="whitespace-nowrap px-6 py-3 border border-white/20 text-white/80 rounded-full font-medium hover:bg-white/5 hover:border-white/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {demoLoading ? 'Opening demo' : 'Try the demo'}
              </button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
