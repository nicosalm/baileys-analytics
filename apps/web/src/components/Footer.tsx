import { Link } from 'react-router-dom'
import { BRAND } from '@/constants'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-background/80 backdrop-blur-sm border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-semibold text-foreground">{BRAND.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">© {currentYear} {BRAND.name}. All rights reserved.</p>
            <p className="text-sm text-muted-foreground mt-0.5">Made with 🧀 in Wisconsin</p>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <Link to="/help" className="text-muted-foreground hover:text-foreground transition-all font-medium">Docs</Link>
            <Link to="/help" className="text-muted-foreground hover:text-foreground transition-all font-medium">Help</Link>
            <a href="mailto:support@baileysanalytics.com" className="text-muted-foreground hover:text-foreground transition-all font-medium">Support</a>
            <a href="https://status.baileysanalytics.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-all font-medium">Status</a>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-all font-medium">Terms</Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-all font-medium">Privacy</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
