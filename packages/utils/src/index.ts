// Utility functions for Baileys Analytics
// e.g., import { calculatePercentage, safeDivide } from '@baileys/utils';

export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ')
}
// Math & Safety
export const ensureNumber = (value: unknown, defaultValue = 0): number => {
  const num = Number(value);
  return isFinite(num) ? num : defaultValue;
};

export const safeDivide = (numerator: number, denominator: number, defaultValue = 0): number => {
  if (denominator === 0 || !isFinite(denominator)) return defaultValue;
  const result = numerator / denominator;
  return isFinite(result) ? result : defaultValue;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

// Percentages & Rates
export const calculatePercentage = (value: number, total: number, decimals = 1): number => {
  const percentage = safeDivide(value, total, 0) * 100;
  return Math.round(percentage * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

export const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return calculatePercentage(current - previous, previous);
};

export const calculateOccupancyRate = (bookedNights: number, availableNights: number): number => {
  const rate = safeDivide(bookedNights, availableNights, 0);
  return Math.min(1, Math.max(0, rate));
};

// Statistics
export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return safeDivide(sum, values.length, 0);
};

export const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

export const calculateVariance = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = calculateAverage(values);
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
  return calculateAverage(squaredDiffs);
};

export const calculateStandardDeviation = (values: number[]): number => {
  return Math.sqrt(calculateVariance(values));
};

// Financial Metrics
export const calculateTax = (amount: number, taxRate: number): number => {
  return Math.round(amount * taxRate * 100) / 100;
};

export const calculateCompoundTax = (
  amount: number,
  taxRates: Array<{ rate: number; compound?: boolean }>
): number => {
  let taxableAmount = amount;
  let totalTax = 0;

  for (const { rate, compound = false } of taxRates) {
    const tax = Math.round(taxableAmount * rate * 100) / 100;
    totalTax += tax;
    if (compound) {
      taxableAmount += tax;
    }
  }

  return totalTax;
};

// Property Metrics
export const calculateBreakEvenOccupancy = (
  fixedCosts: number,
  avgNightlyRate: number,
  variableCostPerNight: number
): number => {
  const contributionMargin = avgNightlyRate - variableCostPerNight;
  return safeDivide(fixedCosts, contributionMargin, 0);
};

export const calculateSeasonalityIndex = (monthlyOccupancies: number[]): number => {
  if (monthlyOccupancies.length === 0) return 0;
  const avg = calculateAverage(monthlyOccupancies);
  const variance = calculateVariance(monthlyOccupancies);
  return safeDivide(Math.sqrt(variance), avg, 0);
};

// Re-export date utilities from dates module
export * from './dates';

// Currency formatting - re-export from currency module for international support
export { 
  formatCurrency, 
  formatCompactCurrency, 
  setCurrencyPreferences, 
  getAvailableCurrencies 
} from './currency';

export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatGrowth = (rate: number): string => {
  const formatted = formatPercentage(rate * 100);
  return rate >= 0 ? `+${formatted}` : formatted;
};


// Collections
export const sumBy = <T>(items: T[], selector: (item: T) => number): number => {
  return items.reduce((sum, item) => sum + ensureNumber(selector(item)), 0);
};

export const groupBy = <T, K extends string | number>(
  items: T[],
  keySelector: (item: T) => K
): Record<K, T[]> => {
  return items.reduce((groups, item) => {
    const key = keySelector(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
};

export const maxBy = <T>(items: T[], selector: (item: T) => number): T | undefined => {
  if (items.length === 0) return undefined;
  return items.reduce((max, item) =>
    selector(item) > selector(max) ? item : max
  );
};

export const minBy = <T>(items: T[], selector: (item: T) => number): T | undefined => {
  if (items.length === 0) return undefined;
  return items.reduce((min, item) =>
    selector(item) < selector(min) ? item : min
  );
};

export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const unique = <T>(array: T[], key?: (item: T) => string | number): T[] => {
  if (!key) {
    return [...new Set(array)];
  }
  const seen = new Set<string | number>();
  return array.filter(item => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// Validation

export const isPositive = (value: number): boolean => {
  return isFinite(value) && value > 0;
};

export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

export const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
};
