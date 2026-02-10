export function buildYearMonthFilter(fromYear: number, fromMonth: number, toYear: number, toMonth: number): string {
  if (fromYear === toYear) {
    return `and(year.eq.${fromYear},month.gte.${fromMonth},month.lte.${toMonth})`
  }
  return `and(year.eq.${fromYear},month.gte.${fromMonth}),and(year.eq.${toYear},month.lte.${toMonth}),and(year.gt.${fromYear},year.lt.${toYear})`
}
