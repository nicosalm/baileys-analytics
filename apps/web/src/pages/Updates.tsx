import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '@/components/Footer'
import { LogoCube } from '@/components/LogoCube'
import { BRAND } from '@/constants'
import { useStatus } from '@/hooks'
import { ArrowLeft } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  body: string
  author: string
  created_at: string
}

const StatusBadge = () => {
  const status = useStatus()

  const config = {
    operational: { color: 'bg-success', ring: 'ring-success/20', text: 'All systems operational' },
    issues: { color: 'bg-danger', ring: 'ring-danger/20', text: 'System issues detected' },
    unavailable: { color: 'bg-muted-foreground', ring: 'ring-muted-foreground/20', text: 'Status unavailable' },
  }[status]

  return (
    <a
      href="https://status.baileysanalytics.com"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full border border-border hover:border-border/80"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.color} ring-2 ${config.ring}`} />
      {config.text}
    </a>
  )
}

// supports [text](url) markdown links and auto-links bare URLs
const LINK_REGEX = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(https?:\/\/[^\s<]+)/g

const Linkify = ({ text }: { text: string }) => {
  const elements: React.ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(LINK_REGEX)) {
    const idx = match.index!
    if (idx > lastIndex) {
      elements.push(<span key={lastIndex}>{text.slice(lastIndex, idx)}</span>)
    }

    if (match[1]) {
      // [text](url)
      elements.push(
        <a key={idx} href={match[3]} target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline underline-offset-2">{match[2]}</a>
      )
    } else {
      // bare URL
      elements.push(
        <a key={idx} href={match[0]} target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline underline-offset-2">{match[0]}</a>
      )
    }

    lastIndex = idx + match[0].length
  }

  if (lastIndex < text.length) {
    elements.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>)
  }

  return <>{elements}</>
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export const Updates = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/announcements?limit=30')
      .then(r => r.json())
      .then(data => setAnnouncements(data.announcements || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* header */}
      <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <LogoCube />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-foreground">{BRAND.name}</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">Updates</p>
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

      <div className="flex-1 max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 w-full">
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {/* main content */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold text-foreground mb-8">Announcements</h2>

            {loading ? (
              <div className="space-y-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse pl-5 border-l-2 border-muted">
                    <div className="h-3 w-28 bg-muted rounded mb-2" />
                    <div className="h-5 w-2/3 bg-muted rounded mb-3" />
                    <div className="h-4 w-full bg-muted rounded mb-1.5" />
                    <div className="h-4 w-4/5 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-xl border">
                <p className="text-muted-foreground">No announcements yet. Check back soon.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {announcements.map((a, i) => (
                  <article
                    key={a.id}
                    className={`relative pl-5 py-6 border-l-2 ${
                      i === 0 ? 'border-primary' : 'border-border'
                    } ${i === 0 ? 'pt-0' : ''}`}
                  >
                    {/* timeline dot */}
                    <div className={`absolute -left-[5px] ${i === 0 ? 'top-0.5' : 'top-7'} w-2 h-2 rounded-full ${
                      i === 0 ? 'bg-primary ring-4 ring-primary/10' : 'bg-border'
                    }`} />

                    <div className="flex items-center gap-2 mb-1.5">
                      <time className="text-xs text-muted-foreground font-medium">
                        {formatDate(a.created_at)}
                      </time>
                      <span className="text-xs text-muted-foreground/40">&middot;</span>
                      <span className="text-xs text-muted-foreground">{a.author}</span>
                    </div>
                    <h3 className={`font-semibold text-foreground mb-2 ${i === 0 ? 'text-xl' : 'text-lg'}`}>
                      {a.title}
                    </h3>
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      <Linkify text={a.body} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* sidebar */}
          <aside className="md:col-span-1 space-y-4">
            <div className="bg-card rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">System Status</h3>
              <StatusBadge />
            </div>

            <div className="bg-card rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">Contact</h3>
              <a
                href="mailto:support@baileysanalytics.com"
                className="text-sm text-primary hover:underline underline-offset-2"
              >
                support@baileysanalytics.com
              </a>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  )
}
