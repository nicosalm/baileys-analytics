import {
  formatCurrency as formatCurrencyBase,
  formatCompactCurrency as formatCompactBase,
  formatPercentage as formatPercentageBase,
} from '@baileys/utils'

export { formatCurrencyBase as formatCurrency, formatCompactBase as formatCompactCurrency }

export const formatPercentage = formatPercentageBase

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value)
}
