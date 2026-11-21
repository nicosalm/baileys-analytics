import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BRAND } from '@/constants'
import { useStatus } from '@/hooks/use-status'
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
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
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
    className="p-2 -m-2 text-muted-foreground opacity-70 hover:opacity-100 transition-opacity"
  >
    {children}
  </a>
)

export const Footer = () => {
  const currentYear = new Date().getFullYear()
  const location = useLocation()
  const navigate = useNavigate()

  const linkClass = 'text-muted-foreground hover:text-foreground transition-colors'

  // handles anchor links that need to work from any page
  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
      e.preventDefault()
      if (location.pathname === '/') {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
      } else {
        navigate(`/${hash}`)
      }
    },
    [location.pathname, navigate],
  )

  // handles same-page Link clicks that need to scroll to top
  const handleSamePageClick = useCallback(
    (path: string) => {
      if (location.pathname === path) {
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    },
    [location.pathname],
  )

  return (
    <footer className="bg-background border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex flex-col gap-5 py-6 md:flex-row md:items-center md:justify-between">
          <Link to="/" onClick={() => handleSamePageClick('/')} className="flex items-center gap-2.5 shrink-0">
            <LogoCube className="w-6 h-6" />
            <span className="font-semibold text-foreground">{BRAND.name}</span>
            <span className="hidden lg:inline text-sm text-muted-foreground">{BRAND.tagline}</span>
          </Link>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a href="/#tour" onClick={(e) => handleAnchorClick(e, '#tour')} className={linkClass}>
              Product
            </a>
            <a href="/#pricing" onClick={(e) => handleAnchorClick(e, '#pricing')} className={linkClass}>
              Pricing
            </a>
            <Link to="/dashboard/overview" className={linkClass}>
              Dashboard
            </Link>
            <Link to="/help" onClick={() => handleSamePageClick('/help')} className={linkClass}>
              Help
            </Link>
            <Link to="/docs/ownerrez-data" onClick={() => handleSamePageClick('/docs/ownerrez-data')} className={linkClass}>
              Data guide
            </Link>
            <a href="mailto:support@baileysanalytics.com" className={linkClass}>
              Support
            </a>
            <Link to="/terms" onClick={() => handleSamePageClick('/terms')} className={linkClass}>
              Terms
            </Link>
            <Link to="/privacy" onClick={() => handleSamePageClick('/privacy')} className={linkClass}>
              Privacy
            </Link>
          </nav>
        </div>

        <div className="flex flex-col-reverse gap-3 py-4 border-t border-border text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {currentYear} {BRAND.name}. Made with 🧀 in Wisconsin.
          </p>
          <div className="flex items-center gap-4">
            {__COMMIT_SHA__ && (
              <span className="font-mono opacity-60" title="Deployed version">
                {__COMMIT_SHA__.slice(0, 7)}
              </span>
            )}
            <StatusIndicator />
            <span className="h-3 w-px bg-border" aria-hidden />
            <SocialIcon href="https://x.com/baileysupdates" label="X (Twitter)">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </SocialIcon>
            <SocialIcon href="https://www.linkedin.com/company/baileysanalytics/" label="LinkedIn">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </SocialIcon>
            <SocialIcon href="https://github.com/baileysanalytics" label="GitHub">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </SocialIcon>
          </div>
        </div>
      </div>
    </footer>
  )
}
