declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
    }
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export async function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined

  // wait for turnstile script to load (up to 5s)
  for (let i = 0; i < 50 && !window.turnstile; i++) {
    await new Promise(r => setTimeout(r, 100))
  }

  if (!window.turnstile) {
    console.warn('Turnstile script not loaded')
    return undefined
  }

  const turnstile = window.turnstile

  return new Promise((resolve, reject) => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    let widgetId: string | undefined

    const cleanup = () => {
      if (widgetId) {
        try { turnstile.remove(widgetId) } catch {}
      }
      container.remove()
    }

    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Captcha timed out'))
    }, 10000)

    widgetId = turnstile.render(container, {
      sitekey: SITE_KEY,
      size: 'invisible',
      callback: (token: string) => {
        clearTimeout(timeout)
        cleanup()
        resolve(token)
      },
      'error-callback': () => {
        clearTimeout(timeout)
        cleanup()
        reject(new Error('Captcha verification failed'))
      },
    })
  })
}
