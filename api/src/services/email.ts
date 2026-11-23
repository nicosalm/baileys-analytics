import { Resend } from 'resend';

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

const plainHtml = (paragraphs: string[]) =>
	`<!DOCTYPE html><html><body style="margin:0;padding:32px 16px;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><div style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:8px;padding:32px;color:#111827;font-size:15px;line-height:1.6;">${paragraphs
		.map((p) => `<p style="margin:0 0 16px;">${p}</p>`)
		.join('')}</div></body></html>`;

export class EmailService {
	private resend: Resend;

	constructor(apiKey: string) {
		this.resend = new Resend(apiKey);
	}

	async sendWelcomeEmail(to: string, userName?: string): Promise<void> {
		try {
			await this.resend.emails.send({
				from: 'Baileys Analytics <onboarding@baileysanalytics.com>',
				to,
				subject: 'Welcome to Baileys Analytics!',
				html: this.getWelcomeEmailTemplate(userName),
			});
		} catch (error) {
			console.error('Failed to send welcome email:', error);
			// don't throw - email failure shouldn't block the flow
		}
	}

	// resolves false instead of throwing so a caller can retry on the next run
	async sendTierChangeNotice(to: string, notice: TierChangeNotice): Promise<boolean> {
		const { subject, paragraphs } = tierChangeEmail(notice);
		return this.send({
			from: 'Baileys Analytics <support@baileysanalytics.com>',
			to,
			subject,
			text: paragraphs.join('\n\n'),
			html: plainHtml(paragraphs),
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

	private getWelcomeEmailTemplate(userName?: string): string {
		const name = userName ? userName.split(' ')[0] : 'there';

		return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Baileys Analytics</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 0 40px; text-align: center;">
              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 24px; color: white;">📊</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">
                Welcome to Baileys Analytics!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #374151;">
                Hi ${name},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #374151;">
                Thanks for signing up! You now have access to powerful analytics for your vacation rental properties.
              </p>

              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e40af; margin-bottom: 8px;">
                  ✨ Your Subscription is Active
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #1e3a8a;">
                  You have full access to all dashboards and analytics. Manage your subscription anytime in Settings.
                </p>
              </div>

              <h2 style="margin: 24px 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">
                Next Steps
              </h2>

              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 30px; vertical-align: top;">
                          <div style="width: 24px; height: 24px; background-color: #3b82f6; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 14px; font-weight: 600;">1</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; font-size: 14px; line-height: 20px; color: #374151;">
                            <strong>Your data is syncing</strong> - We're importing 4 years of historical bookings from OwnerRez. This usually takes 2-5 minutes.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 30px; vertical-align: top;">
                          <div style="width: 24px; height: 24px; background-color: #3b82f6; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 14px; font-weight: 600;">2</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; font-size: 14px; line-height: 20px; color: #374151;">
                            <strong>Explore your dashboards</strong> - View revenue, occupancy, guest analytics, and property performance across your portfolio.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 30px; vertical-align: top;">
                          <div style="width: 24px; height: 24px; background-color: #3b82f6; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 14px; font-weight: 600;">3</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; font-size: 14px; line-height: 20px; color: #374151;">
                            <strong>Configure tax settings</strong> - Add tax rates and platform fees for accurate financial reporting (optional).
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin: 32px 0 24px 0;">
                <a href="https://baileysanalytics.com/dashboard/overview" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Open Dashboard
                </a>
              </div>

              <div style="border-top: 1px solid #e5e7eb; margin: 24px 0; padding-top: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  Need Help?
                </h3>
                <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 20px; color: #374151;">
                  • Check out our <a href="https://baileysanalytics.com/help" style="color: #3b82f6; text-decoration: none;">Help Center</a>
                </p>
                <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 20px; color: #374151;">
                  • Learn about <a href="https://baileysanalytics.com/docs/ownerrez-data" style="color: #3b82f6; text-decoration: none;">what data we sync</a>
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #374151;">
                  • Email us at <a href="mailto:support@baileysanalytics.com" style="color: #3b82f6; text-decoration: none;">support@baileysanalytics.com</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #6b7280; text-align: center;">
                © ${new Date().getFullYear()} Baileys Analytics. Made with 🧀 in Wisconsin.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 18px; color: #9ca3af; text-align: center;">
                <a href="https://status.baileysanalytics.com" style="color: #9ca3af; text-decoration: none;">Status</a> ·
                <a href="https://baileysanalytics.com/privacy" style="color: #9ca3af; text-decoration: none;">Privacy</a> ·
                <a href="https://baileysanalytics.com/terms" style="color: #9ca3af; text-decoration: none;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
	}
}
