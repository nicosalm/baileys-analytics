/**
 * Utility functions for chart data formatting and processing
 */

export type DateGranularity = 'Daily' | 'Weekly' | 'Monthly';

/**
 * Detects the granularity of date data based on the format
 * @param data Array of data with a date field
 * @param dateField The field containing the date string
 * @returns The detected granularity
 */
export function detectGranularity(data: any[], dateField = 'month'): DateGranularity {
  if (!data || data.length === 0) return 'Monthly';
  
  const firstDate = data[0][dateField];
  if (!firstDate) return 'Monthly';
  
  // Check if it's a daily format (YYYY-MM-DD or MM/DD)
  if (firstDate.match(/^\d{4}-\d{2}-\d{2}$/) || firstDate.match(/^\d{2}\/\d{2}$/)) {
    return 'Daily';
  }
  
  // Check if it's a weekly format (contains "Week of")
  if (firstDate.includes('Week of')) {
    return 'Weekly';
  }
  
  // Check if it's a monthly format (YYYY-MM)
  if (firstDate.match(/^\d{4}-\d{2}$/)) {
    return 'Monthly';
  }
  
  // If we have at least 2 data points, check the interval
  if (data.length >= 2 && firstDate.match(/^\d{2}\/\d{2}$/)) {
    // If both are MM/DD format, we need to look at the actual interval
    // This is a heuristic: if the second date is 7 days after the first, it's weekly
    // For now, let's assume MM/DD without year is daily unless proven otherwise
    return 'Daily';
  }
  
  // Default to monthly
  return 'Monthly';
}

/**
 * Formats date strings for chart display based on their format
 * @param dateStr The date string to format
 * @returns Formatted date string for display
 */
export function formatChartDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  
  // Check if it's a daily format (YYYY-MM-DD)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  // Check if it's a monthly format (YYYY-MM)
  if (dateStr.match(/^\d{4}-\d{2}$/)) {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  
  // Return as-is if already formatted or unrecognized
  return dateStr;
}

/**
 * Transforms chart data to format dates appropriately
 * @param data Array of data points with date fields
 * @param dateField The field containing the date
 * @returns Transformed data with formatted dates
 */
export function formatChartData<T extends Record<string, any>>(
  data: T[],
  dateField = 'month'
): T[] {
  return data.map(item => ({
    ...item,
    [dateField]: formatChartDate(item[dateField])
  }));
}