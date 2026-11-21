// booking amounts from OwnerRez are stored without a currency; every tenant today bills in USD
const whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// cents only matter below a thousand dollars; larger figures read cleaner rounded
export const formatCurrency = (amount: number): string => (Math.abs(amount) >= 1000 ? whole : cents).format(amount)

export const formatCompactCurrency = (amount: number): string => {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`
  return whole.format(amount)
}
