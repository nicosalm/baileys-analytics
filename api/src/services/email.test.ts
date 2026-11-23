import { describe, it, expect } from 'vitest';
import { tierChangeEmail, type TierChangeNotice } from './email';

const base: TierChangeNotice = {
	propertyCount: 12,
	fromTierName: 'Growth',
	toTierName: 'Portfolio',
	fromCycle: 'monthly',
	toCycle: 'monthly',
	priceLabel: '$79 a month',
	effectiveAt: '2026-12-03T00:00:00.000Z',
};

describe('tierChangeEmail', () => {
	it('explains an upgrade by the property count', () => {
		const { subject, paragraphs } = tierChangeEmail(base);
		expect(subject).toBe('Your Baileys plan moves to Portfolio on December 3, 2026');
		expect(paragraphs[0]).toBe(
			'You now have 12 active properties in OwnerRez, so your plan moves from Growth to Portfolio at your next renewal on December 3, 2026.',
		);
		expect(paragraphs[1]).toBe('The new price is $79 a month. Nothing changes before then.');
	});

	it('explains a downgrade the same way, with a singular count', () => {
		const { paragraphs } = tierChangeEmail({ ...base, propertyCount: 1, toTierName: 'Starter', priceLabel: '$20 a month' });
		expect(paragraphs[0]).toContain('You now have 1 active property in OwnerRez, so your plan moves from Growth to Starter');
	});

	it('mentions the new cycle when the tier and cycle both change', () => {
		const { paragraphs } = tierChangeEmail({ ...base, toCycle: 'yearly', priceLabel: '$799 a year' });
		expect(paragraphs[0]).toContain('moves from Growth to Portfolio, billed yearly, at your next renewal');
	});

	it('describes a cycle switch on its own', () => {
		const { subject, paragraphs } = tierChangeEmail({ ...base, toTierName: 'Growth', toCycle: 'yearly', priceLabel: '$399 a year' });
		expect(subject).toBe('Your Baileys billing switches to yearly on December 3, 2026');
		expect(paragraphs[0]).toBe('As you asked, your billing switches from monthly to yearly at your next renewal on December 3, 2026.');
	});

	it('uses no em dashes', () => {
		const { subject, paragraphs } = tierChangeEmail(base);
		expect([subject, ...paragraphs].join(' ')).not.toContain('—');
	});
});
