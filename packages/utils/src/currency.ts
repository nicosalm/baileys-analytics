// Currency formatting utilities with international support

// Get currency settings from environment or localStorage
const getCurrencySettings = () => {
  // Check localStorage first for user preferences (browser only)
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    const saved = globalThis.localStorage.getItem('currencySettings')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Invalid JSON, continue to defaults
      }
    }
  }
  
  // Default to browser locale or fallback
  const browserLocale = (typeof globalThis !== 'undefined' && (globalThis as any).navigator)
    ? (globalThis as any).navigator.language 
    : 'en-US'
  
  // Common locale to currency mappings
  const localeCurrencyMap: Record<string, string> = {
    'en-US': 'USD',
    'en-GB': 'GBP',
    'en-CA': 'CAD',
    'en-AU': 'AUD',
    'en-NZ': 'NZD',
    'fr-FR': 'EUR',
    'de-DE': 'EUR',
    'es-ES': 'EUR',
    'it-IT': 'EUR',
    'ja-JP': 'JPY',
    'zh-CN': 'CNY',
    'ko-KR': 'KRW',
    'pt-BR': 'BRL',
    'mx-MX': 'MXN',
    'in-IN': 'INR'
  }
  
  const currency = localeCurrencyMap[browserLocale] || 'USD'
  
  return {
    locale: browserLocale,
    currency: currency
  }
}

export const formatCurrency = (amount: number, currency?: string, locale?: string): string => {
  const settings = getCurrencySettings()
  
  return new Intl.NumberFormat(locale || settings.locale, {
    style: 'currency',
    currency: currency || settings.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
}

export const formatCompactCurrency = (amount: number, currency?: string, locale?: string): string => {
  const settings = getCurrencySettings()
  const currencySymbol = new Intl.NumberFormat(locale || settings.locale, {
    style: 'currency',
    currency: currency || settings.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(0).replace(/\d/g, '').trim()
  
  if (amount >= 1000000) {
    return `${currencySymbol}${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${currencySymbol}${(amount / 1000).toFixed(1)}k`
  }
  return formatCurrency(amount, currency, locale)
}

// Set currency preferences
export const setCurrencyPreferences = (currency: string, locale?: string) => {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    const settings = {
      currency,
      locale: locale || ((globalThis as any).navigator?.language || 'en-US')
    }
    globalThis.localStorage.setItem('currencySettings', JSON.stringify(settings))
  }
}

// Get available currencies
export const getAvailableCurrencies = () => [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'KRW', name: 'Korean Won', symbol: '₩' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' }
]