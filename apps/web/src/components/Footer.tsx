import { Link } from 'react-router-dom'

export const Footer = () => {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="bg-white border-t mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-bold text-gray-900 mb-1">Baileys Analytics</h3>
            <p className="text-sm text-gray-500">© {currentYear} Baileys Analytics. All rights reserved.</p>
            <p className="text-sm text-gray-500 mt-1">Made with 🧀 in Wisconsin</p>
          </div>
          
          <nav className="flex items-center space-x-6 text-sm">
            <a 
              href="https://status.baileysanalytics.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Status
            </a>
            <Link 
              to="/terms" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Terms
            </Link>
            <Link 
              to="/privacy" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}