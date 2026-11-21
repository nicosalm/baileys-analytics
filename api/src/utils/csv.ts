// csv cell escaping that also defends against formula injection.
//
// a raw string starting with =, +, -, @, tab, or CR is interpreted by excel
// and google sheets as a formula when the file is opened, which is how user
// content ("=HYPERLINK(...)", "=cmd|'...'") gets turned into code execution
// on the viewer's machine. owasp recommends prefixing such values with a
// single apostrophe so the spreadsheet treats them as literal text.
//
// we also wrap every value in quotes and escape embedded quotes, so commas
// and newlines inside the value don't break row parsing.
export function csvEscape(value: unknown): string {
	if (value === null || value === undefined) return '""';
	let str = String(value);
	// neutralize formula-triggering leading characters
	if (/^[=+\-@\t\r]/.test(str)) {
		str = `'${str}`;
	}
	// escape embedded double quotes per rfc 4180
	const escaped = str.replace(/"/g, '""');
	return `"${escaped}"`;
}
