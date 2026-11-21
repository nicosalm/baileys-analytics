import '@/styles/newsreader.css'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Footer } from '@/components/Footer'
import { LogoCube } from '@/components/LogoCube'
import { BRAND } from '@/constants'
import { cn } from '@/lib/utils'

const SECTIONS = [
  {
    label: 'Guides',
    pages: [
      { path: '/help', label: 'Help and FAQ' },
      { path: '/docs/ownerrez-data', label: 'OwnerRez data' },
    ],
  },
  {
    label: 'Legal',
    pages: [
      { path: '/terms', label: 'Terms of service' },
      { path: '/privacy', label: 'Privacy policy' },
    ],
  },
]

export const DocsLayout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoCube className="w-6 h-6" />
            <span className="font-semibold text-foreground">{BRAND.name}</span>
          </Link>
          <Link to="/dashboard/overview" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 grid gap-8 md:grid-cols-[11rem_1fr] md:gap-12">
        <nav
          aria-label="Documentation"
          className="flex gap-6 overflow-x-auto md:overflow-visible md:flex-col md:gap-6 md:sticky md:top-24 md:self-start text-sm"
        >
          {SECTIONS.map((section) => (
            <div key={section.label} className="shrink-0">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{section.label}</p>
              <ul className="flex gap-4 md:flex-col md:gap-1">
                {section.pages.map(({ path, label }) => (
                  <li key={path}>
                    <Link
                      to={path}
                      aria-current={pathname === path ? 'page' : undefined}
                      className={cn(
                        'block whitespace-nowrap md:-ml-2 md:px-2 md:py-1 rounded-md transition-colors',
                        pathname === path ? 'text-foreground font-medium md:bg-muted' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="min-w-0 max-w-2xl">{children}</main>
      </div>

      <Footer />
    </div>
  )
}
