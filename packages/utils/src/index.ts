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

export const calculatePercentage = (value: number, total: number): number => {
  return safeDivide(value, total, 0) * 100;
};

export const calculateOccupancyRate = (bookedNights: number, availableNights: number): number => {
  const rate = safeDivide(bookedNights, availableNights, 0);
  return Math.min(1, Math.max(0, rate));
};

export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return safeDivide(sum, values.length, 0);
};

export const calculateVariance = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = calculateAverage(values);
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
  return calculateAverage(squaredDiffs);
};

export * from './dates';

export { formatCurrency, formatCompactCurrency } from './currency';

export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

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

export const isPositive = (value: number): boolean => {
  return isFinite(value) && value > 0;
};

export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};
