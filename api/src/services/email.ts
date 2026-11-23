import { Resend } from 'resend';
import { emailLink, renderEmail, renderText, SITE_URL, type EmailContent } from './email-layout';

export const OPS_EMAIL = 'support@baileysanalytics.com';

export type BillingCycle = 'monthly' | 'yearly';

export interface TierChangeNotice {
	propertyCount: number;
	fromTierName: string;
	toTierName: string;
	fromCycle: BillingCycle;
	toCycle: BillingCycle;
	// the charge at the new renewal, such as "$79 a month" or "$799 a year"
	priceLabel: string;
	effectiveAt: string;
}

const longDate = (iso: string) =>
	new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function tierChangeEmail(notice: TierChangeNotice): { subject: string; paragraphs: string[] } {
	const date = longDate(notice.effectiveAt);
	const tierChanges = notice.fromTierName !== notice.toTierName;
	const cycleChanges = notice.fromCycle !== notice.toCycle;
	const properties = `${notice.propertyCount} active ${notice.propertyCount === 1 ? 'property' : 'properties'}`;

	let change: string;
	if (tierChanges) {
		const billed = cycleChanges ? `, billed ${notice.toCycle},` : '';
		change = `You now have ${properties} in OwnerRez, so your plan moves from ${notice.fromTierName} to ${notice.toTierName}${billed} at your next renewal on ${date}.`;
	} else {
		change = `As you asked, your billing switches from ${notice.fromCycle} to ${notice.toCycle} at your next renewal on ${date}.`;
	}

	return {
		subject: tierChanges
			? `Your Baileys plan moves to ${notice.toTierName} on ${date}`
			: `Your Baileys billing switches to ${notice.toCycle} on ${date}`,
		paragraphs: [
			change,
			`The new price is ${notice.priceLabel}. Nothing changes before then.`,
			'Your plan follows the number of active properties in OwnerRez. If that count looks wrong, check which properties are marked active there, or reply to this email.',
		],
	};
}

// sent once, when the first subscription becomes active; the import starts right after payment
export function welcomeEmail(): { subject: string; content: EmailContent } {
	return {
		subject: 'Welcome to Baileys Analytics',
		content: {
			preheader: 'Your OwnerRez history is importing now.',
			heading: "You're all set",
			paragraphs: [
				'Thanks for subscribing. Baileys is importing four years of bookings, guests and properties from OwnerRez. It usually takes a few minutes, and the dashboards fill in as it finishes.',
				'After that, OwnerRez keeps Baileys current on its own. New bookings, cancellations and property changes show up within a minute or two.',
			],
			action: { label: 'Open your dashboard', href: `${SITE_URL}/dashboard/overview` },
			after: [
				`Questions? Reply to this email, or see ${emailLink(`${SITE_URL}/docs/ownerrez-data`, 'what Baileys imports from OwnerRez')}.`,
			],
		},
	};
}

export class EmailService {
	private resend: Resend;

	constructor(apiKey: string) {
		this.resend = new Resend(apiKey);
	}

	async sendWelcomeEmail(to: string): Promise<boolean> {
		const { subject, content } = welcomeEmail();
		return this.send({
			from: 'Baileys Analytics <onboarding@baileysanalytics.com>',
			to,
			subject,
			text: renderText(content),
			html: renderEmail(content),
		});
	}

	// resolves false instead of throwing so a caller can retry on the next run
	async sendTierChangeNotice(to: string, notice: TierChangeNotice): Promise<boolean> {
		const { subject, paragraphs } = tierChangeEmail(notice);
		const content: EmailContent = {
			preheader: paragraphs[0],
			heading: subject.replace(/^Your Baileys /, 'Your '),
			paragraphs: paragraphs.slice(0, 2),
			action: { label: 'View billing', href: `${SITE_URL}/settings?tab=billing` },
			after: paragraphs.slice(2),
		};
		return this.send({
			from: 'Baileys Analytics <support@baileysanalytics.com>',
			to,
			subject,
			text: renderText(content),
			html: renderEmail(content),
		});
	}

	async sendOpsAlert(subject: string, text: string): Promise<boolean> {
		return this.send({ from: 'Baileys Analytics <support@baileysanalytics.com>', to: OPS_EMAIL, subject, text });
	}

	private async send(message: { from: string; to: string; subject: string; text: string; html?: string }): Promise<boolean> {
		try {
			const { error } = await this.resend.emails.send(message);
			if (error) console.error(`Failed to send "${message.subject}":`, error);
			return !error;
		} catch (error) {
			console.error(`Failed to send "${message.subject}":`, error);
			return false;
		}
	}
}
