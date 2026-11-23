// the one email layout: harbor and limestone colors (index.css tokens converted to hex, since
// email clients don't support oklch), the harbor mark as a hosted png (Gmail strips inline svg and
// blocks data uris), and tables with inline styles for Outlook. light is inline so every client
// gets it; dark comes from a style block for clients that honor prefers-color-scheme (Apple Mail,
// Outlook for Mac) and Outlook.com's data-ogsc/ogsb hooks. Gmail recolors on its own.
// it has no imports so scripts/render-auth-emails.mts can run it under plain node.

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

export const EMAIL_COLORS_DARK = {
	background: '#0f1a26',
	card: '#172433',
	text: '#f3f0ea',
	primary: '#c9d8e8',
	primaryText: '#0f1a26',
	muted: '#93a0ae',
	border: '#283747',
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
const D = EMAIL_COLORS_DARK;

// classes the dark rules hook onto; !important beats the inline light colors
const DARK_RULES = (prefix: string) =>
	[
		`${prefix}.e-bg{background-color:${D.background} !important}`,
		`${prefix}.e-card{background-color:${D.card} !important;border-color:${D.border} !important}`,
		`${prefix}.e-btn{background-color:${D.primary} !important}`,
	].join('');
const DARK_TEXT_RULES = (prefix: string) =>
	[
		`${prefix}.e-text{color:${D.text} !important}`,
		`${prefix}.e-muted{color:${D.muted} !important}`,
		`${prefix}.e-brand,${prefix}.e-link{color:${D.primary} !important}`,
		`${prefix}.e-btn-text{color:${D.primaryText} !important}`,
	].join('');

const DARK_STYLE = `<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){${DARK_RULES('')}${DARK_TEXT_RULES('')}}
${DARK_RULES('[data-ogsb] ')}${DARK_TEXT_RULES('[data-ogsc] ')}
</style>`;

export const emailLink = (href: string, label: string) =>
	`<a href="${href}" class="e-link" style="color:${C.primary};text-decoration:underline;">${label}</a>`;

export function renderEmail(content: EmailContent): string {
	const paragraphs = content.paragraphs
		.map((p) => `<p class="e-text" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.text};">${p}</p>`)
		.join('');
	const action = content.action
		? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td class="e-btn" style="border-radius:8px;background-color:${C.primary};"><a href="${content.action.href}" class="e-btn-text" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:${C.primaryText};text-decoration:none;border-radius:8px;">${content.action.label}</a></td></tr></table>`
		: '';
	const after = (content.after ?? [])
		.map((p) => `<p class="e-muted" style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${C.muted};">${p}</p>`)
		.join('');

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${content.heading}</title>
${DARK_STYLE}
</head>
<body class="e-bg" style="margin:0;padding:0;background-color:${C.background};font-family:${FONT};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${content.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="e-bg" style="background-color:${C.background};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${SITE_URL}/apple-touch-icon.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td class="e-brand" style="vertical-align:middle;padding-left:10px;font-size:16px;font-weight:600;color:${C.primary};">Baileys Analytics</td>
</tr></table>
</td></tr>
<tr><td class="e-card" style="background-color:${C.card};border:1px solid ${C.border};border-radius:12px;padding:32px;">
<h1 class="e-text" style="margin:0 0 16px;font-family:${SERIF};font-size:24px;line-height:1.3;font-weight:600;color:${C.text};">${content.heading}</h1>
${paragraphs}${action}${after}
</td></tr>
<tr><td class="e-muted" style="padding:20px 4px 0;font-size:12px;line-height:1.5;color:${C.muted};">
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
