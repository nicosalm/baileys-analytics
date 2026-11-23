import { describe, it, expect } from 'vitest';
import { tierChangeEmail, welcomeEmail, type TierChangeNotice } from './email';
import { EMAIL_COLORS, EMAIL_COLORS_DARK, renderEmail, renderText, SITE_URL } from './email-layout';

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

describe('welcomeEmail', () => {
	const { subject, content } = welcomeEmail();

	it('is written for someone who has just paid', () => {
		expect(subject).toBe('Welcome to Baileys Analytics');
		expect(content.paragraphs.join(' ')).toContain('importing four years');
		expect(content.action).toEqual({ label: 'Open your dashboard', href: `${SITE_URL}/dashboard/overview` });
	});

	it('mentions no removed features, emoji or em dashes', () => {
		const text = renderText(content);
		expect(text).not.toMatch(/tax settings|tax rates/i);
		expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
		expect(text).not.toContain('\u2014');
	});
});

describe('renderEmail', () => {
	const html = renderEmail({
		preheader: 'Preview line',
		heading: 'Confirm your email',
		paragraphs: ['First paragraph.'],
		action: { label: 'Confirm email', href: '{{ .ConfirmationURL }}' },
		after: ['Small print.'],
	});

	it('uses the harbor mark and palette', () => {
		expect(html).toContain(`${SITE_URL}/apple-touch-icon.png`);
		expect(html).toContain(EMAIL_COLORS.primary);
		expect(html).toContain(EMAIL_COLORS.background);
		expect(html).not.toMatch(/#3b82f6|#f9fafb|#111827/i);
	});

	it("follows the reader's light or dark preference where the client allows it", () => {
		expect(html).toContain('<meta name="color-scheme" content="light dark">');
		expect(html).toContain('@media (prefers-color-scheme: dark)');
		expect(html).toContain(`[data-ogsc] .e-text{color:${EMAIL_COLORS_DARK.text} !important}`);
		expect(html).toContain(`.e-card{background-color:${EMAIL_COLORS_DARK.card} !important`);
	});

	it('leaves template placeholders untouched for Supabase', () => {
		expect(html).toContain('href="{{ .ConfirmationURL }}"');
	});

	it('shows a one-time code without a button', () => {
		const withCode = renderEmail({ preheader: '', heading: 'Confirm it is you', paragraphs: ['Enter this code.'], code: '{{ .Token }}' });
		expect(withCode).toContain('{{ .Token }}</p>');
		expect(withCode).not.toContain('class="e-btn"');
		expect(renderText({ preheader: '', heading: '', paragraphs: ['Enter this code.'], code: '123456' })).toBe('Enter this code.\n\n123456');
	});

	it('gives text-only clients the link', () => {
		expect(renderText({ preheader: '', heading: '', paragraphs: ['Hi.'], action: { label: 'Go', href: 'https://x.test' } })).toBe(
			'Hi.\n\nGo: https://x.test',
		);
	});
});
