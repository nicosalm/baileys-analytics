import { describe, it, expect } from 'vitest';
import { resolveTierForPropertyCount, getTierMonthlyDollars, getTierYearlyDollars, TIERS } from '@baileys/constants';

describe('resolveTierForPropertyCount', () => {
	it.each([
		[0, 'starter'],
		[1, 'starter'],
		[4, 'starter'],
		[5, 'growth'],
		[9, 'growth'],
		[10, 'portfolio'],
		[19, 'portfolio'],
		[20, 'enterprise'],
		[100, 'enterprise'],
	])('%i properties resolves to %s', (count, slug) => {
		expect(resolveTierForPropertyCount(count).slug).toBe(slug);
	});
});

describe('tier prices', () => {
	it.each([
		['starter', 20, 17, 199],
		['growth', 39, 33, 399],
		['portfolio', 79, 67, 799],
	])('%s is $%i monthly, about $%i a month yearly, $%i a year', (slug, monthly, yearlyMonthly, yearly) => {
		const tier = TIERS.find((t) => t.slug === slug)!;
		expect(getTierMonthlyDollars(tier, false)).toBe(monthly);
		expect(getTierMonthlyDollars(tier, true)).toBe(yearlyMonthly);
		expect(getTierYearlyDollars(tier)).toBe(yearly);
	});

	it('enterprise has no self-serve price', () => {
		const enterprise = TIERS.find((t) => t.slug === 'enterprise')!;
		expect(getTierMonthlyDollars(enterprise, false)).toBeNull();
		expect(getTierYearlyDollars(enterprise)).toBeNull();
	});
});
