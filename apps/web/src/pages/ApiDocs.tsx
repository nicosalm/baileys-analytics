import { DocsLayout } from '@/components/DocsLayout'
import { usePageTitle } from '@/hooks/use-page-title'
import { useState, useMemo } from 'react'
import { Check, Copy, Braces } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const CodeBlock = ({ children, label }: { children: string; label?: string }) => {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(children.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      {label && (
        <div className="text-[11px] font-medium text-muted-foreground bg-muted/60 border border-b-0 rounded-t-lg px-3 py-1.5">
          {label}
        </div>
      )}
      <pre className={`bg-muted/40 border text-sm p-4 overflow-x-auto text-foreground ${label ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <code>{children.trim()}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

const InlineCode = ({ children }: { children: React.ReactNode }) => (
  <code className="bg-muted/60 border text-[13px] px-1.5 py-0.5 rounded font-mono">{children}</code>
)

const tables = [
  {
    name: 'bookings',
    description: 'Reservation records synced from OwnerRez.',
    columns: [
      ['id', 'uuid', 'Primary key'],
      ['property_id', 'uuid', 'Foreign key to properties'],
      ['arrival', 'date', 'Check-in date'],
      ['departure', 'date', 'Check-out date'],
      ['adults', 'integer', 'Number of adults'],
      ['children', 'integer', 'Number of children'],
      ['guest_name', 'varchar', 'Guest full name'],
      ['guest_email', 'varchar', 'Guest email address'],
      ['total_amount', 'numeric', 'Total booking amount'],
      ['status', 'varchar', 'Booking status (e.g. confirmed, canceled)'],
      ['platform', 'varchar', 'Listing source (Airbnb, Vrbo, Direct, etc.)'],
      ['platform_reservation_number', 'varchar', 'Reservation ID from listing platform'],
      ['host_service_fee', 'numeric', 'Host-side platform fee'],
      ['guest_listing_site_fee', 'numeric', 'Guest-side platform fee'],
      ['booked_utc', 'timestamptz', 'When the booking was made'],
      ['canceled_utc', 'timestamptz', 'When the booking was canceled (if applicable)'],
      ['created_at', 'timestamptz', 'Record creation time'],
    ],
  },
  {
    name: 'properties',
    description: 'Rental properties from your OwnerRez account.',
    columns: [
      ['id', 'uuid', 'Primary key'],
      ['name', 'varchar', 'Property name'],
      ['internal_code', 'varchar', 'Short code for charts and compact displays (e.g. CEC, CMC)'],
      ['address', 'text', 'Street address'],
      ['city', 'varchar', 'City'],
      ['state', 'varchar', 'State or province'],
      ['postal_code', 'varchar', 'ZIP or postal code'],
      ['bedrooms', 'integer', 'Number of bedrooms'],
      ['bathrooms', 'integer', 'Number of bathrooms'],
      ['max_guests', 'integer', 'Maximum guest capacity'],
      ['latitude', 'numeric', 'GPS latitude'],
      ['longitude', 'numeric', 'GPS longitude'],
      ['active', 'boolean', 'Whether the property is active'],
      ['created_at', 'timestamptz', 'Record creation time'],
    ],
  },
  {
    name: 'guests',
    description: 'Guest contact records.',
    columns: [
      ['id', 'uuid', 'Primary key'],
      ['first_name', 'text', 'First name'],
      ['last_name', 'text', 'Last name'],
      ['full_name', 'text', 'Full name'],
      ['email', 'text', 'Email address'],
      ['phone', 'text', 'Phone number'],
      ['created_at', 'timestamptz', 'Record creation time'],
    ],
  },
  {
    name: 'blocks',
    description: 'Owner blocks and unavailable date ranges.',
    columns: [
      ['id', 'uuid', 'Primary key'],
      ['property_id', 'integer', 'Property reference'],
      ['arrival', 'date', 'Block start date'],
      ['departure', 'date', 'Block end date'],
      ['type', 'text', 'Block type'],
      ['reason', 'text', 'Block reason'],
      ['created_at', 'timestamptz', 'Record creation time'],
    ],
  },
  {
    name: 'booking_charges',
    description: 'Line-item charges on bookings (rent, fees, taxes, etc.).',
    columns: [
      ['id', 'uuid', 'Primary key'],
      ['booking_id', 'uuid', 'Foreign key to bookings'],
      ['type', 'varchar', 'Charge type'],
      ['description', 'text', 'Charge description'],
      ['amount', 'numeric', 'Charge amount'],
      ['is_taxable', 'boolean', 'Whether this charge is taxable'],
      ['created_at', 'timestamptz', 'Record creation time'],
    ],
  },
  {
    name: 'tags',
    description: 'Tags for organizing properties, bookings, and guests.',
    columns: [
      ['id', 'uuid', 'Primary key'],
      ['name', 'varchar', 'Tag name'],
      ['color', 'varchar', 'Tag color'],
      ['created_at', 'timestamptz', 'Record creation time'],
    ],
  },
  {
    name: 'operating_expenses',
    description: 'Monthly operating expenses per property.',
    columns: [
      ['id', 'uuid', 'Primary key'],
      ['property_id', 'uuid', 'Foreign key to properties'],
      ['category', 'text', 'Expense category'],
      ['amount', 'numeric', 'Expense amount'],
      ['year', 'integer', 'Year'],
      ['month', 'integer', 'Month (1-12)'],
      ['description', 'text', 'Expense description'],
      ['created_at', 'timestamptz', 'Record creation time'],
    ],
  },
  {
    name: 'season_configurations',
    description: 'Custom date ranges for seasonal analysis.',
    columns: [
      ['id', 'uuid', 'Primary key'],
      ['name', 'varchar', 'Season name'],
      ['start_month', 'integer', 'Start month (1-12)'],
      ['start_day', 'integer', 'Start day of month'],
      ['end_month', 'integer', 'End month (1-12)'],
      ['end_day', 'integer', 'End day of month'],
      ['is_active', 'boolean', 'Whether the season is active'],
      ['created_at', 'timestamptz', 'Record creation time'],
    ],
  },
]

const junctionTables = [
  { name: 'booking_tags', keys: ['booking_id', 'tag_id'] },
  { name: 'property_tags', keys: ['property_id', 'tag_id'] },
  { name: 'guest_tags', keys: ['guest_id', 'tag_id'] },
]

const buildLlmSchema = () => {
  const schema = {
    api: {
      base_url: SUPABASE_URL,
      endpoint_pattern: '/rest/v1/{table_name}',
      auth: {
        headers: {
          apikey: 'YOUR_ANON_KEY',
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
        },
        token_endpoint: `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      },
      filtering: 'PostgREST operators as query params (eq, neq, gt, gte, lt, lte, like, ilike, in, is)',
      pagination: 'Use limit and offset query params. Max 1000 rows per request.',
      response_format: 'JSON array of objects. Set Accept: text/csv for CSV.',
    },
    tables: tables.map((t) => ({
      name: t.name,
      description: t.description,
      columns: t.columns.map(([name, type, description]) => ({ name, type, description })),
    })),
    junction_tables: junctionTables.map((jt) => ({
      name: jt.name,
      foreign_keys: jt.keys,
    })),
  }
  return JSON.stringify(schema, null, 2)
}

export const ApiDocs = () => {
  usePageTitle('Data API')
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [schemaCopied, setSchemaCopied] = useState(false)
  const llmSchema = useMemo(buildLlmSchema, [])

  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Data API</h1>
          <p className="text-muted-foreground text-sm">
            Query your Baileys Analytics data directly over HTTPS using the Supabase REST API.
          </p>
        </div>

        {/* overview */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Overview</h2>
          <p className="text-muted-foreground text-sm mb-3">
            Every Baileys Analytics account has a REST API powered by <a href="https://supabase.com/docs/guides/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">Supabase</a> and PostgREST.
            You can use it to pull your booking, property, guest, and financial data into spreadsheets, scripts, or third-party tools.
          </p>
          <p className="text-muted-foreground text-sm">
            All requests go through row-level security. You only see data belonging to your account.
          </p>
        </section>

        {/* authentication */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Authentication</h2>
          <p className="text-muted-foreground text-sm mb-3">
            Every request requires two headers: <InlineCode>apikey</InlineCode> and <InlineCode>Authorization</InlineCode>.
            The <InlineCode>apikey</InlineCode> header identifies your project. The <InlineCode>Authorization</InlineCode> header carries your access token, which determines what data you can read.
          </p>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Base URL</h3>
            <CodeBlock>{SUPABASE_URL}</CodeBlock>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">API Key</h3>
            <p className="text-muted-foreground text-sm mb-2">
              This key is the same for all users. It identifies the project but does not grant access to any data on its own. It is safe to include in scripts and requests.
            </p>
            <CodeBlock>{ANON_KEY}</CodeBlock>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Required headers</h3>
            <CodeBlock label="Headers">{`apikey: ${ANON_KEY}
Authorization: Bearer YOUR_ACCESS_TOKEN`}</CodeBlock>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Getting an access token</h3>
            <p className="text-muted-foreground text-sm mb-1">Tokens expire after one hour. There are two ways to get one.</p>

            <div className="border rounded-lg overflow-hidden mt-3">
              {/* option 1 */}
              <div className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">Option 1: From the dashboard</h4>
                <p className="text-muted-foreground text-sm">
                  Go to <a href="/settings?tab=integrations" className="text-primary hover:text-primary/80">Settings &rarr; Integrations</a> and click <strong>Generate API Token</strong>. Click the token to copy it. Good for one-off queries, testing, and pasting into tools like Postman.
                </p>
              </div>

              <div className="flex items-center gap-3 px-4">
                <div className="flex-1 border-t" />
                <span className="text-xs font-medium text-muted-foreground">OR</span>
                <div className="flex-1 border-t" />
              </div>

              {/* option 2 */}
              <div className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">Option 2: Programmatically</h4>
                <p className="text-muted-foreground text-sm mb-3">
                  Sign in with your Baileys Analytics credentials. Better for scripts and automated pipelines.
                </p>
                <CodeBlock label="curl">{`curl -X POST '${SUPABASE_URL}/auth/v1/token?grant_type=password' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "email": "you@example.com",
    "password": "your-password"
  }'`}</CodeBlock>
                <p className="text-muted-foreground text-sm mt-3">
                  The response includes an <InlineCode>access_token</InlineCode> field. Use that as your Bearer token. The response also includes a <InlineCode>refresh_token</InlineCode> you can use to get a new access token without signing in again.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* querying */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Querying Data</h2>

          <p className="text-muted-foreground text-sm mb-4">
            All tables are available at <InlineCode>/rest/v1/TABLE_NAME</InlineCode>. Requests use standard HTTP GET with query parameters for filtering, sorting, and pagination.
          </p>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Select all rows</h3>
              <CodeBlock label="curl">{`curl '${SUPABASE_URL}/rest/v1/bookings?select=*' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'`}</CodeBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Select specific columns</h3>
              <CodeBlock label="curl">{`curl '${SUPABASE_URL}/rest/v1/bookings?select=arrival,departure,guest_name,total_amount' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'`}</CodeBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Filter rows</h3>
              <p className="text-muted-foreground text-sm mb-2">
                Append filters as query parameters using PostgREST operators.
              </p>
              <CodeBlock label="Bookings arriving after 2025-06-01">{`curl '${SUPABASE_URL}/rest/v1/bookings?select=*&arrival=gte.2025-06-01' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'`}</CodeBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Sort and paginate</h3>
              <CodeBlock label="10 most recent bookings">{`curl '${SUPABASE_URL}/rest/v1/bookings?select=*&order=booked_utc.desc&limit=10' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'`}</CodeBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Combine multiple filters</h3>
              <CodeBlock label="Airbnb bookings over $500">{`curl '${SUPABASE_URL}/rest/v1/bookings?select=*&platform=eq.Airbnb&total_amount=gte.500' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'`}</CodeBlock>
            </div>
          </div>
        </section>

        {/* filter operators */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Filter Operators</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Operator</th>
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Meaning</th>
                  <th className="text-left py-2 font-semibold text-foreground">Example</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">eq</td><td className="py-2 pr-4">Equal</td><td className="py-2 font-mono text-xs">status=eq.confirmed</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">neq</td><td className="py-2 pr-4">Not equal</td><td className="py-2 font-mono text-xs">status=neq.canceled</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">gt</td><td className="py-2 pr-4">Greater than</td><td className="py-2 font-mono text-xs">total_amount=gt.1000</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">gte</td><td className="py-2 pr-4">Greater than or equal</td><td className="py-2 font-mono text-xs">arrival=gte.2025-01-01</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">lt</td><td className="py-2 pr-4">Less than</td><td className="py-2 font-mono text-xs">total_amount=lt.200</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">lte</td><td className="py-2 pr-4">Less than or equal</td><td className="py-2 font-mono text-xs">departure=lte.2025-12-31</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">like</td><td className="py-2 pr-4">Pattern match (case-sensitive)</td><td className="py-2 font-mono text-xs">guest_name=like.*Smith*</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">ilike</td><td className="py-2 pr-4">Pattern match (case-insensitive)</td><td className="py-2 font-mono text-xs">city=ilike.*austin*</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono text-xs">in</td><td className="py-2 pr-4">In a list of values</td><td className="py-2 font-mono text-xs">platform=in.(Airbnb,Vrbo)</td></tr>
                <tr><td className="py-2 pr-4 font-mono text-xs">is</td><td className="py-2 pr-4">Null check</td><td className="py-2 font-mono text-xs">canceled_utc=is.null</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm mt-3">
            See the full <a href="https://docs.postgrest.org/en/stable/references/api/tables_views.html#operators" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">PostgREST operator reference</a> for advanced filters including ranges, arrays, and full-text search.
          </p>
        </section>

        {/* response format */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Response Format</h2>
          <p className="text-muted-foreground text-sm mb-3">
            Responses are JSON arrays by default. You can also request CSV by setting the <InlineCode>Accept</InlineCode> header to <InlineCode>text/csv</InlineCode>.
          </p>
          <CodeBlock label="JSON response">{`[
  {
    "id": "a1b2c3...",
    "arrival": "2025-07-01",
    "departure": "2025-07-05",
    "guest_name": "Jane Smith",
    "total_amount": 1250.00,
    "platform": "Airbnb"
  }
]`}</CodeBlock>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Row count</h3>
          <p className="text-muted-foreground text-sm mb-2">
            To get the total count alongside results, add a <InlineCode>Prefer</InlineCode> header:
          </p>
          <CodeBlock label="Request with count">{`curl '${SUPABASE_URL}/rest/v1/bookings?select=*' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\
  -H 'Prefer: count=exact'`}</CodeBlock>
          <p className="text-muted-foreground text-sm mt-2">
            The total count is returned in the <InlineCode>Content-Range</InlineCode> response header.
          </p>
        </section>

        {/* pagination */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Pagination</h2>
          <p className="text-muted-foreground text-sm mb-3">
            The API returns a maximum of 1,000 rows per request. Use <InlineCode>limit</InlineCode> and <InlineCode>offset</InlineCode> to page through larger result sets.
          </p>
          <CodeBlock label="Page 2 (rows 51-100)">{`curl '${SUPABASE_URL}/rest/v1/bookings?select=*&order=arrival.desc&limit=50&offset=50' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'`}</CodeBlock>
        </section>

        {/* tables reference */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tables</h2>
          <p className="text-muted-foreground text-sm mb-4">
            These are the tables available through the API. All tables are scoped to your account through row-level security.
          </p>

          <div className="space-y-3">
            {tables.map((table) => (
              <div key={table.name} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <span className="font-mono text-sm font-semibold text-foreground">{table.name}</span>
                    <span className="text-muted-foreground text-sm ml-3">{table.description}</span>
                  </div>
                  <span className="text-muted-foreground text-xs shrink-0 ml-2">
                    {expandedTable === table.name ? 'collapse' : `${table.columns.length} columns`}
                  </span>
                </button>
                {expandedTable === table.name && (
                  <div className="border-t">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="text-left py-2 px-4 font-semibold text-foreground text-xs">Column</th>
                          <th className="text-left py-2 px-4 font-semibold text-foreground text-xs">Type</th>
                          <th className="text-left py-2 px-4 font-semibold text-foreground text-xs">Description</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        {table.columns.map(([col, type, desc]) => (
                          <tr key={col} className="border-b last:border-b-0">
                            <td className="py-1.5 px-4 font-mono text-xs">{col}</td>
                            <td className="py-1.5 px-4 text-xs">{type}</td>
                            <td className="py-1.5 px-4 text-xs">{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Junction tables</h3>
            <p className="text-muted-foreground text-sm mb-2">
              These link tags to other records. Each row is a pair of foreign keys.
            </p>
            <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
              {junctionTables.map((jt) => (
                <li key={jt.name}>
                  <span className="font-mono text-xs">{jt.name}</span> ({jt.keys.join(', ')})
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* llm-friendly schema export */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Schema for LLMs</h2>
          <p className="text-muted-foreground text-sm mb-3">
            Copy the full API schema as structured JSON. Paste it into ChatGPT, Claude, or any other LLM to give it context about your data model when writing queries or building integrations.
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(llmSchema)
              setSchemaCopied(true)
              setTimeout(() => setSchemaCopied(false), 2000)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border bg-muted/30 hover:bg-muted/60 text-foreground transition-colors"
          >
            {schemaCopied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Braces className="w-4 h-4" />
                Copy schema JSON
              </>
            )}
          </button>
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Preview
            </summary>
            <pre className="bg-muted/40 border text-xs p-4 rounded-lg mt-2 overflow-x-auto max-h-64 text-foreground">
              <code>{llmSchema}</code>
            </pre>
          </details>
        </section>

        {/* rate limits */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Rate Limits</h2>
          <p className="text-muted-foreground text-sm">
            The API is subject to Supabase's default rate limits. For most accounts this is well above what you will need for data exports and integrations. If you hit rate limits, add a short delay between requests.
          </p>
        </section>

        {/* security */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Security</h2>
          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>All requests are encrypted over HTTPS.</li>
            <li>Row-level security ensures you can only access your own data.</li>
            <li>Access tokens expire after one hour. Use refresh tokens to renew them.</li>
            <li>Never share your access token or embed it in client-side code.</li>
            <li>The anon key is safe to use in requests but does not grant access to data on its own. A valid access token is always required.</li>
          </ul>
        </section>

        <div className="mt-8 pt-6 border-t">
          <p className="text-muted-foreground text-sm">
            For full API documentation, see the <a href="https://supabase.com/docs/guides/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">Supabase API guide</a> and the <a href="https://docs.postgrest.org/en/stable/" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">PostgREST docs</a>.
            Questions? Reach us at <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">support@baileysanalytics.com</a>.
          </p>
        </div>
      </div>
    </DocsLayout>
  )
}
