import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, corsHeaders } from './middleware/auth'
import { query, transaction } from './services/database'
import { fetchReportData, ReportModuleData, ReportDateRange, ReportFilters } from './services/reportService'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrency, formatPercentage } from '@baileys/utils'
import { randomUUID } from 'crypto'
import { formatDateISO } from './utils/dates'
import { createErrorResponse, createSuccessResponse, requireTenant } from './utils/httpResponses'
import { buildDateRangeFilter, normalizePlatformSQL } from './utils/queryBuilders'
import { parseNumericField, parseIntField, normalizePlatformName } from './utils/dataTransformers'

interface ReportConfig {
  format: 'pdf' | 'excel'
  modules: string[]
  dateRange: { from: string; to: string }
  filters: {
    tags?: string[]
    properties?: string[]
  }
  includeCharts: boolean
  includeRawData: boolean
  includeSummary: boolean
  groupBy?: 'property' | 'month' | 'quarter' | 'year'
  compareWithPrevious?: boolean
}

interface ReportData {
  metadata: {
    generatedAt: string
    dateRange: ReportDateRange
    modules: string[]
    filters: ReportFilters
  }
  modules: ReportModuleData
}

// Generate PDF Report
async function generatePDF(data: ReportData, config: ReportConfig, reportName: string): Promise<Buffer> {
  const doc = new jsPDF()
  let yPosition = 20

  // Title Page
  doc.setFontSize(24)
  doc.text(reportName, 105, yPosition, { align: 'center' })
  yPosition += 10

  doc.setFontSize(12)
  doc.text(`Generated: ${new Date(data.metadata.generatedAt).toLocaleDateString()}`, 105, yPosition, { align: 'center' })
  yPosition += 8
  doc.text(`Period: ${data.metadata.dateRange.from} to ${data.metadata.dateRange.to}`, 105, yPosition, { align: 'center' })
  yPosition += 15

  // Executive Summary
  if (config.includeSummary) {
    doc.setFontSize(16)
    doc.text('Executive Summary', 20, yPosition)
    yPosition += 10

    doc.setFontSize(10)
    const summary = generateExecutiveSummary(data)
    const lines = doc.splitTextToSize(summary, 170)
    doc.text(lines, 20, yPosition)
    yPosition += lines.length * 5 + 10
  }

  // Process each module
  Object.entries(data.modules).forEach(([moduleId, moduleData]) => {
    if (!moduleData || moduleData.error) return

    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }

    // Module header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(getModuleTitle(moduleId), 20, yPosition)
    doc.setFont('helvetica', 'normal')
    yPosition += 10

    // Module content based on type
    switch (moduleId) {
      case 'pl':
      case 'revenue':
        yPosition = addFinancialSection(doc, moduleData, yPosition, config)
        break
      case 'properties':
      case 'property_comparison':
        yPosition = addPropertySection(doc, moduleData, yPosition, config)
        break
      case 'occupancy':
        yPosition = addOccupancySection(doc, moduleData, yPosition, config)
        break
      case 'guests':
      case 'guest_segments':
        yPosition = addGuestSection(doc, moduleData, yPosition, config)
        break
      case 'tax':
        yPosition = addTaxSection(doc, moduleData, yPosition, config)
        break
      default:
        yPosition = addGenericSection(doc, moduleData, yPosition, config)
    }

    yPosition += 10
  })

  return Buffer.from(doc.output('arraybuffer'))
}

// Generate Excel Report
async function generateExcel(data: ReportData, config: ReportConfig, reportName: string): Promise<Buffer> {
  const workbook = XLSX.utils.book_new()

  // Summary Sheet
  if (config.includeSummary) {
    const summaryData = [
      ['Report', reportName],
      ['Generated', new Date(data.metadata.generatedAt).toLocaleString()],
      ['Date Range', `${data.metadata.dateRange.from} to ${data.metadata.dateRange.to}`],
      [],
      ['Executive Summary'],
      [generateExecutiveSummary(data)]
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
  }

  // Process each module into separate sheets
  Object.entries(data.modules).forEach(([moduleId, moduleData]) => {
    if (!moduleData || moduleData.error) return

    const sheetName = getModuleTitle(moduleId).substring(0, 31) // Excel sheet name limit
    let sheetData: any[][] = []

    switch (moduleId) {
      case 'pl':
      case 'revenue':
        sheetData = formatFinancialDataForExcel(moduleData, config)
        break
      case 'properties':
      case 'property_comparison':
        sheetData = formatPropertyDataForExcel(moduleData, config)
        break
      case 'occupancy':
        sheetData = formatOccupancyDataForExcel(moduleData, config)
        break
      case 'guests':
      case 'guest_segments':
        sheetData = formatGuestDataForExcel(moduleData, config)
        break
      case 'tax':
        sheetData = formatTaxDataForExcel(moduleData, config)
        break
      default:
        sheetData = formatGenericDataForExcel(moduleData, config)
    }

    if (sheetData.length > 0) {
      const sheet = XLSX.utils.aoa_to_sheet(sheetData)
      
      // Auto-size columns
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
      const colWidths: { wch: number }[] = []
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = { c: C, r: R }
          const cellRef = XLSX.utils.encode_cell(cellAddress)
          if (sheet[cellRef] && sheet[cellRef].v) {
            const cellValue = String(sheet[cellRef].v)
            maxWidth = Math.max(maxWidth, cellValue.length)
          }
        }
        colWidths.push({ wch: Math.min(maxWidth + 2, 50) })
      }
      sheet['!cols'] = colWidths

      XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
    }
  })

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return buffer
}

// Helper functions for PDF generation
function addFinancialSection(doc: jsPDF, data: any, yPos: number, config: ReportConfig): number {
  if (!data.pl) return yPos

  const tableData = [
    ['Metric', 'Current Period', 'Previous Period', 'Change'],
    ['Gross Revenue', formatCurrency(parseNumericField(data.pl.revenue)), formatCurrency(parseNumericField(data.pl.previousRevenue)), formatPercentage(parseNumericField(data.pl.revenueGrowth))],
    ['Net Revenue', formatCurrency(parseNumericField(data.pl.netRevenue)), formatCurrency(parseNumericField(data.pl.previousNetRevenue)), formatPercentage(parseNumericField(data.pl.netRevenueGrowth))],
    ['Total Expenses', formatCurrency(parseNumericField(data.pl.expenses)), formatCurrency(parseNumericField(data.pl.previousExpenses)), formatPercentage(parseNumericField(data.pl.expenseGrowth))],
    ['Net Profit', formatCurrency(parseNumericField(data.pl.netProfit)), formatCurrency(parseNumericField(data.pl.previousNetProfit)), formatPercentage(parseNumericField(data.pl.profitGrowth))],
    ['Profit Margin', formatPercentage(parseNumericField(data.pl.profitMargin)), formatPercentage(parseNumericField(data.pl.previousProfitMargin)), '-']
  ]

  autoTable(doc, {
    startY: yPos,
    head: [tableData[0]],
    body: tableData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 }
  })

  return (doc as any).lastAutoTable.finalY + 10
}

function addPropertySection(doc: jsPDF, data: any, yPos: number, config: ReportConfig): number {
  if (!Array.isArray(data)) return yPos

  const tableData = [
    ['Property', 'Revenue', 'Bookings', 'Occupancy', 'Avg Nightly']
  ]

  data.forEach((property: any) => {
    tableData.push([
      property.propertyName || 'Unknown',
      formatCurrency(parseNumericField(property.revenue)),
      String(parseIntField(property.bookings)),
      formatPercentage(parseNumericField(property.occupancyRate) * 100),
      formatCurrency(parseNumericField(property.avgNightlyRate))
    ])
  })

  autoTable(doc, {
    startY: yPos,
    head: [tableData[0]],
    body: tableData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 }
  })

  return (doc as any).lastAutoTable.finalY + 10
}

function addOccupancySection(doc: jsPDF, data: any, yPos: number, config: ReportConfig): number {
  const overall = parseNumericField(data.overall)
  const byProperty = data.byProperty || []

  doc.setFontSize(10)
  doc.text(`Overall Occupancy: ${formatPercentage(overall * 100)}`, 20, yPos)
  yPos += 8

  if (byProperty.length > 0) {
    const tableData = [
      ['Property', 'Occupancy Rate', 'Booked Nights', 'Available Nights']
    ]

    byProperty.forEach((prop: any) => {
      tableData.push([
        prop.propertyName || 'Unknown',
        formatPercentage(parseNumericField(prop.rate) * 100),
        String(parseIntField(prop.bookedNights)),
        String(parseIntField(prop.availableNights))
      ])
    })

    autoTable(doc, {
      startY: yPos,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 }
    })

    return (doc as any).lastAutoTable.finalY + 10
  }

  return yPos + 10
}

function addGuestSection(doc: jsPDF, data: any, yPos: number, config: ReportConfig): number {
  const metrics = data.metrics || {}
  const guests = data.guests || []

  // Guest metrics summary
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Guests', String(parseIntField(metrics.totalGuests))],
    ['Repeat Guests', String(parseIntField(metrics.repeatGuests))],
    ['Repeat Rate', formatPercentage(parseNumericField(metrics.repeatRate))],
    ['Average Spend', formatCurrency(parseNumericField(metrics.avgSpend))],
    ['Total Revenue', formatCurrency(parseNumericField(metrics.totalRevenue))]
  ]

  autoTable(doc, {
    startY: yPos,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 60 } }
  })

  yPos = (doc as any).lastAutoTable.finalY + 10

  // Top guests table if raw data is included
  if (config.includeRawData && guests.length > 0) {
    const guestTableData = [
      ['Guest Name', 'Bookings', 'Total Spent', 'Avg/Night']
    ]

    guests.slice(0, 10).forEach((guest: any) => {
      guestTableData.push([
        guest.name || 'Unknown',
        String(parseIntField(guest.bookingCount)),
        formatCurrency(parseNumericField(guest.totalSpent)),
        formatCurrency(parseNumericField(guest.avgNightlyRate))
      ])
    })

    autoTable(doc, {
      startY: yPos,
      head: [guestTableData[0]],
      body: guestTableData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 }
    })

    return (doc as any).lastAutoTable.finalY + 10
  }

  return yPos
}

function addTaxSection(doc: jsPDF, data: any, yPos: number, config: ReportConfig): number {
  const summary = data.summary || {}
  const byProperty = data.byProperty || []

  // Tax summary - dynamically build from actual tax data
  const summaryData = [
    ['Tax Type', 'Amount'],
    ['Total Tax Collected', formatCurrency(parseNumericField(summary.totalTax))]
  ]
  
  // Add jurisdiction-specific taxes if present
  if (summary.taxBreakdown && Array.isArray(summary.taxBreakdown)) {
    summary.taxBreakdown.forEach((tax: any) => {
      summaryData.push([tax.name || tax.type, formatCurrency(parseNumericField(tax.amount))])
    })
  }

  autoTable(doc, {
    startY: yPos,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 }
  })

  return (doc as any).lastAutoTable.finalY + 10
}

function addGenericSection(doc: jsPDF, data: any, yPos: number, config: ReportConfig): number {
  doc.setFontSize(10)
  
  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0])
    const tableData = [headers]
    
    data.slice(0, 20).forEach((item: any) => {
      tableData.push(headers.map(h => {
        const value = item[h]
        if (typeof value === 'number' && h.toLowerCase().includes('amount')) {
          return formatCurrency(value)
        }
        return String(value || '')
      }))
    })

    autoTable(doc, {
      startY: yPos,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 }
    })

    return (doc as any).lastAutoTable.finalY + 10
  }

  return yPos
}

// Helper functions for Excel generation
function formatFinancialDataForExcel(data: any, config: ReportConfig): any[][] {
  const rows: any[][] = []
  
  rows.push(['Financial Summary'])
  rows.push([])
  rows.push(['Metric', 'Current Period', 'Previous Period', 'Change'])
  
  if (data.pl) {
    rows.push(['Gross Revenue', parseNumericField(data.pl.revenue), parseNumericField(data.pl.previousRevenue), parseNumericField(data.pl.revenueGrowth)])
    rows.push(['Net Revenue', parseNumericField(data.pl.netRevenue), parseNumericField(data.pl.previousNetRevenue), parseNumericField(data.pl.netRevenueGrowth)])
    rows.push(['Total Expenses', parseNumericField(data.pl.expenses), parseNumericField(data.pl.previousExpenses), parseNumericField(data.pl.expenseGrowth)])
    rows.push(['Net Profit', parseNumericField(data.pl.netProfit), parseNumericField(data.pl.previousNetProfit), parseNumericField(data.pl.profitGrowth)])
    rows.push(['Profit Margin', parseNumericField(data.pl.profitMargin), parseNumericField(data.pl.previousProfitMargin), ''])
  }

  if (data.breakdown && config.includeRawData) {
    rows.push([])
    rows.push(['Detailed Breakdown'])
    rows.push(['Category', 'Amount', 'Percentage'])
    
    Object.entries(data.breakdown).forEach(([category, amount]) => {
      rows.push([category, amount, ''])
    })
  }

  return rows
}

function formatPropertyDataForExcel(data: any, config: ReportConfig): any[][] {
  const rows: any[][] = []
  
  rows.push(['Property Performance'])
  rows.push([])
  rows.push(['Property Name', 'Revenue', 'Bookings', 'Occupancy Rate', 'Avg Nightly Rate', 'Booked Nights', 'Available Nights'])
  
  if (Array.isArray(data)) {
    data.forEach((property: any) => {
      rows.push([
        property.propertyName || 'Unknown',
        parseNumericField(property.revenue),
        parseIntField(property.bookings),
        parseNumericField(property.occupancyRate) * 100,
        parseNumericField(property.avgNightlyRate),
        parseIntField(property.bookedNights),
        parseIntField(property.availableNights)
      ])
    })
  }

  return rows
}

function formatOccupancyDataForExcel(data: any, config: ReportConfig): any[][] {
  const rows: any[][] = []
  
  rows.push(['Occupancy Analysis'])
  rows.push([])
  rows.push(['Overall Occupancy', parseNumericField(data.overall) * 100])
  rows.push([])
  
  if (data.byProperty && data.byProperty.length > 0) {
    rows.push(['Property', 'Occupancy Rate', 'Booked Nights', 'Available Nights'])
    data.byProperty.forEach((prop: any) => {
      rows.push([
        prop.propertyName || 'Unknown',
        parseNumericField(prop.rate) * 100,
        parseIntField(prop.bookedNights),
        parseIntField(prop.availableNights)
      ])
    })
  }

  if (data.byMonth && data.byMonth.length > 0) {
    rows.push([])
    rows.push(['Monthly Occupancy'])
    rows.push(['Month', 'Occupancy Rate', 'Booked Nights', 'Available Nights'])
    data.byMonth.forEach((month: any) => {
      rows.push([
        month.month,
        parseNumericField(month.rate) * 100,
        parseIntField(month.bookedNights),
        parseIntField(month.availableNights)
      ])
    })
  }

  return rows
}

function formatGuestDataForExcel(data: any, config: ReportConfig): any[][] {
  const rows: any[][] = []
  const metrics = data.metrics || {}
  const guests = data.guests || []
  
  rows.push(['Guest Analytics'])
  rows.push([])
  rows.push(['Metric', 'Value'])
  rows.push(['Total Guests', parseIntField(metrics.totalGuests)])
  rows.push(['Repeat Guests', parseIntField(metrics.repeatGuests)])
  rows.push(['Repeat Rate', parseNumericField(metrics.repeatRate)])
  rows.push(['Average Stay Length', parseNumericField(metrics.avgStayLength)])
  rows.push(['Average Spend', parseNumericField(metrics.avgSpend)])
  rows.push(['Total Revenue', parseNumericField(metrics.totalRevenue)])
  
  if (config.includeRawData && guests.length > 0) {
    rows.push([])
    rows.push(['Guest Details'])
    rows.push(['Name', 'Email', 'First Visit', 'Last Visit', 'Bookings', 'Total Spent', 'Avg Nightly Rate'])
    
    guests.forEach((guest: any) => {
      rows.push([
        guest.name || 'Unknown',
        guest.email || '',
        guest.firstVisit || '',
        guest.lastVisit || '',
        parseIntField(guest.bookingCount),
        parseNumericField(guest.totalSpent),
        parseNumericField(guest.avgNightlyRate)
      ])
    })
  }

  return rows
}

function formatTaxDataForExcel(data: any, config: ReportConfig): any[][] {
  const rows: any[][] = []
  const summary = data.summary || {}
  
  rows.push(['Tax Report'])
  rows.push([])
  rows.push(['Tax Summary'])
  rows.push(['Type', 'Amount'])
  rows.push(['Total Tax Collected', parseNumericField(summary.totalTax)])
  
  // Add dynamic tax breakdown if available
  if (summary.taxBreakdown && Array.isArray(summary.taxBreakdown)) {
    summary.taxBreakdown.forEach((tax: any) => {
      rows.push([tax.name || tax.type || 'Tax', parseNumericField(tax.amount)])
    })
  }
  
  if (data.byProperty && data.byProperty.length > 0) {
    rows.push([])
    rows.push(['Tax by Property'])
    // Dynamic headers based on available tax types
    const taxHeaders = ['Property', 'Total Tax']
    if (data.byProperty[0]?.taxBreakdown) {
      data.byProperty[0].taxBreakdown.forEach((tax: any) => {
        taxHeaders.push(tax.name || tax.type)
      })
    }
    rows.push(taxHeaders)
    
    data.byProperty.forEach((prop: any) => {
      const propRow = [prop.propertyName || 'Unknown', parseNumericField(prop.totalTax)]
      if (prop.taxBreakdown) {
        prop.taxBreakdown.forEach((tax: any) => {
          propRow.push(parseNumericField(tax.amount))
        })
      }
      rows.push(propRow)
    })
  }

  return rows
}

function formatGenericDataForExcel(data: any, config: ReportConfig): any[][] {
  const rows: any[][] = []
  
  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0])
    rows.push(headers)
    
    data.forEach((item: any) => {
      rows.push(headers.map(h => item[h] || ''))
    })
  } else if (typeof data === 'object') {
    rows.push(['Field', 'Value'])
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value !== 'object') {
        rows.push([key, value])
      }
    })
  }

  return rows
}

// Utility functions
function generateExecutiveSummary(data: ReportData): string {
  let summary = 'This report provides a comprehensive analysis of your vacation rental business performance. '
  
  // Add key metrics from different modules
  Object.entries(data.modules).forEach(([moduleId, moduleData]) => {
    if (!moduleData || moduleData.error) return
    
    switch (moduleId) {
      case 'pl':
      case 'revenue':
        if (moduleData.pl) {
          summary += `Total revenue for the period was ${formatCurrency(parseNumericField(moduleData.pl.revenue))} with a net profit of ${formatCurrency(parseNumericField(moduleData.pl.netProfit))}. `
        }
        break
      case 'occupancy':
        if (moduleData.overall) {
          summary += `Overall occupancy rate was ${formatPercentage(parseNumericField(moduleData.overall) * 100)}. `
        }
        break
      case 'guests':
        if (moduleData.metrics) {
          summary += `You hosted ${parseIntField(moduleData.metrics.totalGuests)} guests with a repeat rate of ${formatPercentage(parseNumericField(moduleData.metrics.repeatRate))}. `
        }
        break
    }
  })
  
  return summary
}

function getModuleTitle(moduleId: string): string {
  const titles: Record<string, string> = {
    pl: 'Profit & Loss Statement',
    revenue: 'Revenue Analysis',
    tax: 'Tax Report',
    cashflow: 'Cash Flow Analysis',
    expenses: 'Expense Tracking',
    properties: 'Property Metrics',
    property_comparison: 'Property Comparison',
    occupancy: 'Occupancy Analysis',
    guests: 'Guest Analytics',
    guest_segments: 'Guest Segmentation',
    seasonal: 'Seasonal Trends',
    overview: 'Executive Overview',
    bookings: 'Booking Analytics',
    channels: 'Channel Performance'
  }
  
  return titles[moduleId] || moduleId.charAt(0).toUpperCase() + moduleId.slice(1)
}

// Main Azure Function
export async function reportsGenerate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Auth check
    const authResult = await requireAuth(request)
    if (!authResult.authenticated) {
      return createErrorResponse('Unauthorized', 401)
    }
    const { auth } = authResult.request

    // Tenant validation
    const tenantError = requireTenant(auth.tenantId)
    if (tenantError) {
      return tenantError
    }

    const body = await request.json() as {
      templateId: string
      data?: ReportData
      config: ReportConfig
      generateData?: boolean
    }

    if (!body.config) {
      return createErrorResponse('Missing required config', 400)
    }

    let reportData: ReportData

    // If data is provided, use it. Otherwise, fetch the data using the service
    if (body.data) {
      reportData = body.data
    } else if (body.generateData !== false) {
      // Validate tenant ID before proceeding
      const tenantValidation = requireTenant(auth.tenantId);
      if (tenantValidation) {
        return tenantValidation;
      }

      // Generate data using the report service
      const moduleData = await fetchReportData(
        body.config.modules,
        body.config.dateRange,
        auth.tenantId!, // Now we know it's defined
        body.config.filters
      )

      reportData = {
        metadata: {
          generatedAt: new Date().toISOString(),
          dateRange: body.config.dateRange,
          modules: body.config.modules,
          filters: body.config.filters
        },
        modules: moduleData
      }
    } else {
      return createErrorResponse('No data provided and data generation disabled', 400)
    }

    const reportName = `Report-${formatDateISO(new Date())}`
    let reportBuffer: Buffer

    // Generate report based on format
    if (body.config.format === 'pdf') {
      reportBuffer = await generatePDF(reportData, body.config, reportName)
    } else if (body.config.format === 'excel') {
      reportBuffer = await generateExcel(reportData, body.config, reportName)
    } else {
      return createErrorResponse('Unsupported format. Use PDF or Excel.', 400)
    }

    // Store report in database
    const reportId = randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expire in 7 days
    
    const insertResult = await query(
      `INSERT INTO generated_reports (
        id, tenant_id, template_id, name, format, size, expires_at, data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        reportId,
        auth.tenantId,
        body.templateId || null,
        reportName,
        body.config.format,
        reportBuffer.length,
        expiresAt,
        reportBuffer
      ]
    )

    if (!insertResult.success) {
      throw new Error('Failed to store report')
    }

    return createSuccessResponse({
      success: true,
      data: {
        reportId,
        downloadUrl: `/api/reports/download/${reportId}`
      }
    })
  } catch (error) {
    context.error('Error generating report:', error)
    return createErrorResponse(
      'Failed to generate report',
      500
    )
  }
}

app.http('reports-generate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'reports/generate/{templateId}',
  handler: reportsGenerate
})