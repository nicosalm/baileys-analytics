import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Footer } from '@/components/Footer'
import { FileText, Shield, ArrowLeft, ChevronRight, HelpCircle, BookOpen, Code2 } from 'lucide-react'
import { BRAND } from '@/constants'
import { LogoCube } from '@/components/LogoCube'

interface DocsLayoutProps {
  children: ReactNode
}

// moved to module scope to avoid recreation on every render
const docPages = [
  { path: '/help', label: 'Help & FAQ', icon: HelpCircle },
  { path: '/docs/ownerrez-data', label: 'OwnerRez Data Guide', icon: BookOpen },
  { path: '/docs/api', label: 'Data API', icon: Code2 },
]

const legalPages = [
  { path: '/terms', label: 'Terms of Service', icon: FileText },
  { path: '/privacy', label: 'Privacy Policy', icon: Shield }
]

export const DocsLayout = ({ children }: DocsLayoutProps) => {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* header */}
      <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            {/* logo */}
            <Link to="/" className="flex items-center">
              <LogoCube />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-foreground">{BRAND.name}</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">Docs</p>
              </div>
            </Link>

            {/* back to home */}
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

      <div className="flex-1 max-w-6xl mx-auto px-4 py-4 md:px-6 md:py-6 w-full">
        <div className="grid md:grid-cols-4 gap-4 md:gap-8">
          {/* sidebar navigation */}
          <aside className="md:col-span-1">
            <nav className="space-y-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Documentation
              </h3>
              {docPages.map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`
                      flex items-center px-3 py-2 text-sm rounded-lg transition-all
                      ${isActive
                        ? 'bg-info-subtle text-info-fg font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    {label}
                  </Link>
                )
              })}

              <div className="pt-4 mt-4 md:pt-6 md:mt-6 border-t">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Legal
                </h3>
                {legalPages.map(({ path, label, icon: Icon }) => {
                  const isActive = location.pathname === path
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`
                        flex items-center px-3 py-2 text-sm rounded-lg transition-all
                        ${isActive
                          ? 'bg-info-subtle text-info-fg font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {label}
                    </Link>
                  )
                })}
              </div>

              <div className="pt-4 mt-4 md:pt-6 md:mt-6 border-t">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Resources
                </h3>
                <a
                  href="https://status.baileysanalytics.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-all"
                >
                  System Status
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </a>
                <a
                  href="mailto:support@baileysanalytics.com"
                  className="flex items-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-all"
                >
                  Contact Support
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </a>
              </div>
            </nav>
          </aside>

          {/* main content */}
          <main className="md:col-span-3">
            <div className="bg-card rounded-xl border p-6 md:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}
