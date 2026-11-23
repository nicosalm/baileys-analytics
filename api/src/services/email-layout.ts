// the one email layout: harbor and limestone colors (index.css tokens converted to hex, since
// email clients don't support oklch), the harbor mark as a hosted png (they don't render svg),
// and tables with inline styles for Outlook. it has no imports so scripts/render-auth-emails.mts
// can run it under plain node to produce the Supabase auth templates.

export const SITE_URL = 'https://baileysanalytics.com';

export const EMAIL_COLORS = {
	background: '#f6f3ec',
	card: '#fbf9f5',
	text: '#18232f',
	primary: '#1d3b5c',
	primaryText: '#fbf9f5',
	muted: '#596570',
	border: '#e3ddd1',
} as const;

export interface EmailContent {
	// the inbox preview line
	preheader: string;
	heading: string;
	// trusted html: plain sentences, optionally with a link
	paragraphs: string[];
	action?: { label: string; href: string };
	// smaller print under the button
	after?: string[];
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Newsreader,Georgia,'Times New Roman',serif";
const C = EMAIL_COLORS;

export const emailLink = (href: string, label: string) =>
	`<a href="${href}" style="color:${C.primary};text-decoration:underline;">${label}</a>`;

export function renderEmail(content: EmailContent): string {
	const paragraphs = content.paragraphs
		.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.text};">${p}</p>`)
		.join('');
	const action = content.action
		? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background-color:${C.primary};"><a href="${content.action.href}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:${C.primaryText};text-decoration:none;border-radius:8px;">${content.action.label}</a></td></tr></table>`
		: '';
	const after = (content.after ?? [])
		.map((p) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${C.muted};">${p}</p>`)
		.join('');

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${content.heading}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.background};font-family:${FONT};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${content.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.background};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${SITE_URL}/apple-touch-icon.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="vertical-align:middle;padding-left:10px;font-size:16px;font-weight:600;color:${C.primary};">Baileys Analytics</td>
</tr></table>
</td></tr>
<tr><td style="background-color:${C.card};border:1px solid ${C.border};border-radius:12px;padding:32px;">
<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:24px;line-height:1.3;font-weight:600;color:${C.text};">${content.heading}</h1>
${paragraphs}${action}${after}
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.5;color:${C.muted};">
Baileys Analytics, made in Wisconsin. ${emailLink(`${SITE_URL}/help`, 'Help')} · ${emailLink(`${SITE_URL}/privacy`, 'Privacy')} · ${emailLink(`${SITE_URL}/terms`, 'Terms')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// the plain text part, so clients that block html still get the message and the link
export function renderText(content: EmailContent): string {
	const strip = (html: string) => html.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '$2 ($1)').replace(/<[^>]+>/g, '');
	return [
		...content.paragraphs.map(strip),
		...(content.action ? [`${content.action.label}: ${content.action.href}`] : []),
		...(content.after ?? []).map(strip),
	].join('\n\n');
}
