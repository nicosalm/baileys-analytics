import { Resend } from 'resend';

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
        html: this.getWelcomeEmailTemplate(userName)
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // don't throw - email failure shouldn't block the flow
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

              <div style="background-color: #eff6ff; border-left: 4px solid: #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e40af; margin-bottom: 8px;">
                  ✨ Your $1 Trial is Active
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #1e3a8a;">
                  Get 30 days of full access for just $1. After that, it's $20/month or $192/year (save 20%).
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
                            <strong>Your data is syncing</strong> - We're importing 3 years of historical bookings from OwnerRez. This usually takes 2-5 minutes.
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
