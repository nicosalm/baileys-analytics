export function buildYearMonthFilter(fromYear: number, fromMonth: number, toYear: number, toMonth: number): string {
	if (fromYear === toYear) {
		return `and(year.eq.${fromYear},month.gte.${fromMonth},month.lte.${toMonth})`;
	}
	return `and(year.eq.${fromYear},month.gte.${fromMonth}),and(year.eq.${toYear},month.lte.${toMonth}),and(year.gt.${fromYear},year.lt.${toYear})`;
}

// subtract one year from a YYYY-MM-DD date, clamping feb 29 to feb 28 of the
// prior year so the result is always a real date. a naive string replace of
// the year component turns 2024-02-29 into 2023-02-29 which doesn't exist and
// causes downstream queries to silently miss a day, so we do real date math.
export function subtractOneYear(dateStr: string): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	if (!y || !m || !d) return dateStr;
	const iso = new Date(Date.UTC(y - 1, m - 1, d));
	// rollover (feb 29 -> mar 1 of prior year): clamp to the last day of the
	// intended month in the prior year
	if (iso.getUTCMonth() !== m - 1) {
		return new Date(Date.UTC(y - 1, m, 0)).toISOString().split('T')[0];
	}
	return iso.toISOString().split('T')[0];
}
