import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BRAND } from '@/constants'
import { useStatus } from '@/hooks'
import { useCallback } from 'react'
import { LogoCube } from '@/components/LogoCube'

const StatusIndicator = () => {
  const status = useStatus()

  const config = {
    operational: { color: 'bg-success', text: 'All systems operational' },
    issues: { color: 'bg-danger', text: 'System issues detected' },
    unavailable: { color: 'bg-muted-foreground', text: 'Status unavailable' },
  }[status]

  return (
    <a
      href="https://status.baileysanalytics.com"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className={`w-2 h-2 rounded-full ${config.color} ${status === 'operational' ? 'status-pulse' : ''}`} />
      {config.text}
    </a>
  )
}

const SocialIcon = ({ href, label, children }: { href: string; label: string; children: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className="text-muted-foreground opacity-70 hover:opacity-100 transition-opacity"
  >
    {children}
  </a>
)

export const Footer = () => {
  const currentYear = new Date().getFullYear()
  const location = useLocation()
  const navigate = useNavigate()

  const linkClass = "text-muted-foreground hover:text-foreground transition-colors"

  // handles anchor links that need to work from any page
  const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    e.preventDefault()
    if (location.pathname === '/') {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/' + hash)
    }
  }, [location.pathname, navigate])

  // handles same-page Link clicks that need to scroll to top
  const handleSamePageClick = useCallback((path: string) => {
    if (location.pathname === path) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [location.pathname])

  return (
    <footer className="bg-background border-t border-border mt-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-10 md:gap-10">
          {/* brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" onClick={() => handleSamePageClick('/')} className="flex items-center gap-2 mb-3">
              <LogoCube className="w-7 h-7" />
              <span className="font-semibold text-foreground">{BRAND.name}</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">{BRAND.tagline}</p>
            <p className="text-sm text-muted-foreground">Made with 🧀 in Wisconsin</p>
          </div>

          {/* product */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/#features" onClick={(e) => handleAnchorClick(e, '#features')} className={linkClass}>Features</a></li>
              <li><a href="/#pricing" onClick={(e) => handleAnchorClick(e, '#pricing')} className={linkClass}>Pricing</a></li>
              <li><Link to="/updates" onClick={() => handleSamePageClick('/updates')} className={linkClass}>Updates</Link></li>
              <li><Link to="/dashboard/overview" className={linkClass}>Dashboard</Link></li>
            </ul>
          </div>

          {/* resources */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/help" onClick={() => handleSamePageClick('/help')} className={linkClass}>Help</Link></li>
              <li><Link to="/docs/ownerrez-data" onClick={() => handleSamePageClick('/docs/ownerrez-data')} className={linkClass}>Data Guide</Link></li>
              <li><a href="mailto:support@baileysanalytics.com" className={linkClass}>Support</a></li>
            </ul>
          </div>

          {/* developers */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3">Developers</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/docs/api" onClick={() => handleSamePageClick('/docs/api')} className={linkClass}>API</Link></li>
              <li><Link to="/branding" onClick={() => handleSamePageClick('/branding')} className={linkClass}>Brand</Link></li>
            </ul>
          </div>

          {/* legal */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" onClick={() => handleSamePageClick('/terms')} className={linkClass}>Terms</Link></li>
              <li><Link to="/privacy" onClick={() => handleSamePageClick('/privacy')} className={linkClass}>Privacy</Link></li>
            </ul>
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <StatusIndicator />

          <p className="text-sm text-muted-foreground order-3 sm:order-2">
            &copy; {currentYear} {BRAND.name}
          </p>

          <div className="flex items-center gap-4 order-2 sm:order-3">
            <SocialIcon href="https://x.com/baileysupdates" label="X (Twitter)">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </SocialIcon>
            <SocialIcon href="https://www.linkedin.com/company/baileysanalytics/" label="LinkedIn">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </SocialIcon>
            <SocialIcon href="https://github.com/baileysanalytics" label="GitHub">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            </SocialIcon>
          </div>
        </div>
      </div>
    </footer>
  )
}
