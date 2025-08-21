import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'
import { format, startOfMonth, endOfMonth, getDaysInMonth, differenceInDays, parseISO } from 'date-fns'
import { z } from 'zod'

// Flexible tax report schema
const TaxReportRequestSchema = z.object({
  propertyId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  includeDetails: z.boolean().optional().default(true)
})

interface TaxReportData {
  property: {
    id: string
    name: string
    address: string
  }
  period: {
    month: string
    year: number
    startDate: string
    endDate: string
    daysInMonth: number
    daysOccupied: number
    occupancyRate: number
  }
  revenue: {
    bookingRevenue: number
    cleaningFees: number
    otherFees: number
    platformFees: {
      guest: number
      host: number
    }
    totalGross: number
  }
  taxes: {
    jurisdictions: Array<{
      name: string
      type: string
      rate: number
      taxableAmount: number
      taxDue: number
    }>
    totalRate: number
    totalTaxDue: number
    platformRemitted: number
    ownerResponsibility: number
  }
  platforms: Array<{
    name: string
    bookingCount: number
    revenue: number
    guestFees: number
    hostFees: number
    taxOnFees: number
    remittedByPlatform: number
  }>
}

// GET /api/tax-report
export async function generateTaxReport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request

  try {
    // Parse and validate request
    const params = {
      propertyId: request.query.get('propertyId'),
      month: request.query.get('month'),
      includeDetails: request.query.get('includeDetails') === 'true'
    }

    const validated = TaxReportRequestSchema.parse(params)
    const { propertyId, month, includeDetails } = validated

    const monthDate = parseISO(`${month}-01`)
    const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')
    const daysInMonth = getDaysInMonth(monthDate)

    // Get property details
    const propertyResult = await query(
      `SELECT id, name, address FROM properties 
       WHERE id = $1 AND tenant_id = $2`,
      [propertyId, auth.tenantId]
    )

    if (!propertyResult.success || propertyResult.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { error: 'Property not found' }
      }
    }

    const property = propertyResult.data[0]

    // Get tax configuration for this property
    const taxConfigResult = await query(
      `SELECT jurisdictions, platform_settings, auto_detected
       FROM property_tax_configs
       WHERE property_id = $1 AND tenant_id = $2 AND is_active = true
       LIMIT 1`,
      [propertyId, auth.tenantId]
    )

    if (!taxConfigResult.success || taxConfigResult.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { 
          error: 'No tax configuration found',
          message: 'Please configure tax settings for this property first'
        }
      }
    }

    const taxConfig = taxConfigResult.data[0]
    const jurisdictions = typeof taxConfig.jurisdictions === 'string'
      ? JSON.parse(taxConfig.jurisdictions)
      : taxConfig.jurisdictions

    // Get booking revenue and fees
    const bookingResult = await query(
      `SELECT 
        COUNT(DISTINCT b.id) as booking_count,
        COALESCE(SUM(b.total_amount), 0) as booking_revenue,
        COALESCE(SUM(CASE WHEN bc.type = 'surcharge' AND bc.description ILIKE '%cleaning%' 
                     THEN bc.amount ELSE 0 END), 0) as cleaning_fees,
        COALESCE(SUM(CASE WHEN bc.type = 'surcharge' 
                     AND bc.description NOT ILIKE '%cleaning%' 
                     AND bc.description NOT ILIKE '%tax%'
                     THEN bc.amount ELSE 0 END), 0) as other_fees,
        COUNT(DISTINCT DATE(b.arrival)) as days_occupied
       FROM bookings b
       LEFT JOIN booking_charges bc ON b.id = bc.booking_id
       WHERE b.property_id = $1 
         AND b.tenant_id = $2
         AND b.arrival >= $3 
         AND b.arrival <= $4
         AND b.status != 'canceled'
       GROUP BY b.property_id`,
      [propertyId, auth.tenantId, startDate, endDate]
    )

    const bookingData = bookingResult.success && bookingResult.data.length > 0
      ? bookingResult.data[0]
      : { 
          booking_count: 0, 
          booking_revenue: 0, 
          cleaning_fees: 0, 
          other_fees: 0,
          days_occupied: 0
        }

    // Get platform fees and remittance data
    const platformResult = await query(
      `SELECT 
        platform,
        COUNT(*) as booking_count,
        COALESCE(SUM(guest_service_fee), 0) as guest_fees,
        COALESCE(SUM(host_service_fee), 0) as host_fees,
        COALESCE(SUM(platform_tax_remitted), 0) as platform_remitted,
        MAX(platform_remits_tax) as remits_tax
       FROM platform_fee_entries
       WHERE property_id = $1 AND tenant_id = $2 AND month = $3
       GROUP BY platform`,
      [propertyId, auth.tenantId, month]
    )

    // Get tenant's platform remittance configuration
    const remittanceConfigResult = await query(
      `SELECT platform, remits_occupancy_tax, remits_on_guest_fees
       FROM tenant_platform_configs
       WHERE tenant_id = $1`,
      [auth.tenantId]
    )

    const remittanceConfig = new Map(
      remittanceConfigResult.success 
        ? remittanceConfigResult.data.map(r => [r.platform, r])
        : []
    )

    // Calculate revenue totals
    const revenue = {
      bookingRevenue: parseFloat(bookingData.booking_revenue),
      cleaningFees: parseFloat(bookingData.cleaning_fees),
      otherFees: parseFloat(bookingData.other_fees),
      platformFees: {
        guest: 0,
        host: 0
      },
      totalGross: 0
    }

    // Process platform data
    const platformBreakdown = []
    let totalPlatformRemitted = 0

    if (platformResult.success) {
      for (const platform of platformResult.data) {
        const guestFees = parseFloat(platform.guest_fees)
        const hostFees = parseFloat(platform.host_fees)
        const platformRemitted = parseFloat(platform.platform_remitted)
        
        revenue.platformFees.guest += guestFees
        revenue.platformFees.host += hostFees
        totalPlatformRemitted += platformRemitted

        // Calculate tax on platform fees based on jurisdictions
        const taxOnFees = jurisdictions.reduce((sum: number, j: any) => 
          sum + (guestFees * j.rate / 100), 0
        )

        platformBreakdown.push({
          name: platform.platform,
          bookingCount: parseInt(platform.booking_count),
          revenue: 0, // Would need to join with bookings for platform-specific revenue
          guestFees,
          hostFees,
          taxOnFees,
          remittedByPlatform: platformRemitted
        })
      }
    }

    revenue.totalGross = revenue.bookingRevenue + revenue.cleaningFees + 
                        revenue.otherFees + revenue.platformFees.guest

    // Calculate taxes by jurisdiction
    const taxableAmount = revenue.totalGross
    const jurisdictionBreakdown = jurisdictions.map((j: any) => ({
      name: j.name,
      type: j.type,
      rate: j.rate,
      taxableAmount,
      taxDue: taxableAmount * j.rate / 100
    }))

    const totalRate = jurisdictions.reduce((sum: number, j: any) => sum + j.rate, 0)
    const totalTaxDue = taxableAmount * totalRate / 100

    // Build response
    const report: TaxReportData = {
      property: {
        id: property.id,
        name: property.name,
        address: property.address || ''
      },
      period: {
        month: format(monthDate, 'MMMM'),
        year: monthDate.getFullYear(),
        startDate,
        endDate,
        daysInMonth,
        daysOccupied: parseInt(bookingData.days_occupied),
        occupancyRate: daysInMonth > 0 
          ? Math.round((parseInt(bookingData.days_occupied) / daysInMonth) * 100)
          : 0
      },
      revenue,
      taxes: {
        jurisdictions: jurisdictionBreakdown,
        totalRate,
        totalTaxDue,
        platformRemitted: totalPlatformRemitted,
        ownerResponsibility: Math.max(0, totalTaxDue - totalPlatformRemitted)
      },
      platforms: includeDetails ? platformBreakdown : []
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { 
        status: 'success', 
        data: report,
        metadata: {
          generatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
          reportType: 'monthly_tax_report',
          jurisdiction: 'multi_jurisdiction',
          configSource: taxConfig.auto_detected ? 'auto_detected' : 'manual'
        }
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { 
          error: 'Invalid request parameters',
          details: error.issues
        }
      }
    }

    context.error('Error generating tax report:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Failed to generate tax report' }
    }
  }
}

// GET /api/tax-report/summary
export async function getTaxReportSummary(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request
  const year = request.query.get('year') || format(new Date(), 'yyyy')

  try {
    // Get all properties with tax configs
    const propertiesResult = await query(
      `SELECT DISTINCT p.id, p.name
       FROM properties p
       JOIN property_tax_configs ptc ON p.id = ptc.property_id
       WHERE p.tenant_id = $1 AND ptc.is_active = true`,
      [auth.tenantId]
    )

    if (!propertiesResult.success) {
      throw new Error('Failed to fetch properties')
    }

    const summaryByProperty = []

    for (const property of propertiesResult.data) {
      // Get yearly totals
      const yearlyResult = await query(
        `SELECT 
          COUNT(DISTINCT b.id) as total_bookings,
          COALESCE(SUM(b.total_amount), 0) as total_revenue,
          COUNT(DISTINCT EXTRACT(MONTH FROM b.arrival)) as months_active
         FROM bookings b
         WHERE b.property_id = $1 
           AND b.tenant_id = $2
           AND EXTRACT(YEAR FROM b.arrival) = $3
           AND b.status != 'canceled'`,
        [property.id, auth.tenantId, year]
      )

      const yearlyData = yearlyResult.success && yearlyResult.data.length > 0
        ? yearlyResult.data[0]
        : { total_bookings: 0, total_revenue: 0, months_active: 0 }

      // Get platform fees total
      const feesResult = await query(
        `SELECT 
          COALESCE(SUM(guest_service_fee + host_service_fee), 0) as total_fees,
          COALESCE(SUM(platform_tax_remitted), 0) as total_remitted
         FROM platform_fee_entries
         WHERE property_id = $1 
           AND tenant_id = $2
           AND SUBSTRING(month, 1, 4) = $3`,
        [property.id, auth.tenantId, year]
      )

      const feesData = feesResult.success && feesResult.data.length > 0
        ? feesResult.data[0]
        : { total_fees: 0, total_remitted: 0 }

      summaryByProperty.push({
        propertyId: property.id,
        propertyName: property.name,
        year: parseInt(year),
        totalBookings: parseInt(yearlyData.total_bookings),
        totalRevenue: parseFloat(yearlyData.total_revenue),
        totalPlatformFees: parseFloat(feesData.total_fees),
        totalPlatformRemitted: parseFloat(feesData.total_remitted),
        monthsActive: parseInt(yearlyData.months_active)
      })
    }

    // Calculate totals
    const totals = summaryByProperty.reduce((acc, prop) => ({
      properties: acc.properties + 1,
      bookings: acc.bookings + prop.totalBookings,
      revenue: acc.revenue + prop.totalRevenue,
      platformFees: acc.platformFees + prop.totalPlatformFees,
      platformRemitted: acc.platformRemitted + prop.totalPlatformRemitted
    }), {
      properties: 0,
      bookings: 0,
      revenue: 0,
      platformFees: 0,
      platformRemitted: 0
    })

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        status: 'success',
        data: {
          year: parseInt(year),
          totals,
          properties: summaryByProperty
        }
      }
    }
  } catch (error) {
    context.error('Error generating tax report summary:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Failed to generate summary' }
    }
  }
}

app.http('tax-report', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: generateTaxReport
})

app.http('tax-report-summary', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getTaxReportSummary
})