import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const BASE = 'Baileys Analytics'

export function usePageTitle(title?: string) {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = title ? `${title} | ${BASE}` : BASE

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = `https://baileysanalytics.com${pathname}`

    return () => { document.title = BASE }
  }, [title, pathname])
}
