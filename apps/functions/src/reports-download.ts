import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, corsHeaders } from './middleware/auth'
import { query } from './services/database'

export async function reportsDownload(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Auth check
    const authResult = await requireAuth(request)
    if (!authResult.authenticated) {
      return authResult.response
    }
    const { auth } = authResult.request

    // Get report ID from URL
    const reportId = request.params.reportId
    if (!reportId) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Report ID is required' })
      }
    }

    // Fetch report from database
    const reportResult = await query<any>(
      `SELECT * FROM generated_reports 
       WHERE id = $1 AND tenant_id = $2 AND expires_at > NOW()`,
      [reportId, auth.tenantId || '']
    )

    if (!reportResult.success || reportResult.data.length === 0) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'Report not found or expired' })
      }
    }

    const report = reportResult.data[0]

    // Update last accessed time
    await query(
      `UPDATE generated_reports SET last_accessed = NOW() WHERE id = $1`,
      [reportId]
    )

    // Set appropriate headers based on format
    const contentType = report.format === 'pdf' 
      ? 'application/pdf' 
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    
    const fileName = `${report.name}.${report.format === 'pdf' ? 'pdf' : 'xlsx'}`

    return {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(report.size),
        'Cache-Control': 'private, max-age=3600'
      },
      body: report.data
    }
  } catch (error) {
    context.error('Error downloading report:', error)
    return {
      status: 500,
      body: JSON.stringify({ 
        error: 'Failed to download report',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

app.http('reports-download', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'reports/download/{reportId}',
  handler: reportsDownload
})