import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, corsHeaders } from './middleware/auth'
import { query, transaction } from './services/database'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrency, formatPercentage } from '@baileys/utils'
import { randomUUID } from 'crypto'
import { formatDateISO } from './utils/dates'

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
    dateRange: { from: string; to: string }
    modules: string[]
    filters: any
  }
  modules: Record<string, any>
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
    ['Gross Revenue', formatCurrency(data.pl.revenue || 0), formatCurrency(data.pl.previousRevenue || 0), formatPercentage(data.pl.revenueGrowth || 0)],
    ['Net Revenue', formatCurrency(data.pl.netRevenue || 0), formatCurrency(data.pl.previousNetRevenue || 0), formatPercentage(data.pl.netRevenueGrowth || 0)],
    ['Total Expenses', formatCurrency(data.pl.expenses || 0), formatCurrency(data.pl.previousExpenses || 0), formatPercentage(data.pl.expenseGrowth || 0)],
    ['Net Profit', formatCurrency(data.pl.netProfit || 0), formatCurrency(data.pl.previousNetProfit || 0), formatPercentage(data.pl.profitGrowth || 0)],
    ['Profit Margin', formatPercentage(data.pl.profitMargin || 0), formatPercentage(data.pl.previousProfitMargin || 0), '-']
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
      formatCurrency(property.revenue || 0),
      String(property.bookings || 0),
      formatPercentage((property.occupancyRate || 0) * 100),
      formatCurrency(property.avgNightlyRate || 0)
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
  const overall = data.overall || 0
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
        formatPercentage((prop.rate || 0) * 100),
        String(prop.bookedNights || 0),
        String(prop.availableNights || 0)
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
    ['Total Guests', String(metrics.totalGuests || 0)],
    ['Repeat Guests', String(metrics.repeatGuests || 0)],
    ['Repeat Rate', formatPercentage(metrics.repeatRate || 0)],
    ['Average Spend', formatCurrency(metrics.avgSpend || 0)],
    ['Total Revenue', formatCurrency(metrics.totalRevenue || 0)]
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
        String(guest.bookingCount || 0),
        formatCurrency(guest.totalSpent || 0),
        formatCurrency(guest.avgNightlyRate || 0)
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

  // Tax summary
  const summaryData = [
    ['Tax Type', 'Amount'],
    ['Total Tax Collected', formatCurrency(summary.totalTax || 0)],
    ['State Tax', formatCurrency(summary.stateTax || 0)],
    ['County Tax', formatCurrency(summary.countyTax || 0)],
    ['City Tax', formatCurrency(summary.cityTax || 0)],
    ['Tourism Tax', formatCurrency(summary.tourismTax || 0)]
  ]

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
    rows.push(['Gross Revenue', data.pl.revenue || 0, data.pl.previousRevenue || 0, data.pl.revenueGrowth || 0])
    rows.push(['Net Revenue', data.pl.netRevenue || 0, data.pl.previousNetRevenue || 0, data.pl.netRevenueGrowth || 0])
    rows.push(['Total Expenses', data.pl.expenses || 0, data.pl.previousExpenses || 0, data.pl.expenseGrowth || 0])
    rows.push(['Net Profit', data.pl.netProfit || 0, data.pl.previousNetProfit || 0, data.pl.profitGrowth || 0])
    rows.push(['Profit Margin', data.pl.profitMargin || 0, data.pl.previousProfitMargin || 0, ''])
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
        property.revenue || 0,
        property.bookings || 0,
        (property.occupancyRate || 0) * 100,
        property.avgNightlyRate || 0,
        property.bookedNights || 0,
        property.availableNights || 0
      ])
    })
  }

  return rows
}

function formatOccupancyDataForExcel(data: any, config: ReportConfig): any[][] {
  const rows: any[][] = []
  
  rows.push(['Occupancy Analysis'])
  rows.push([])
  rows.push(['Overall Occupancy', (data.overall || 0) * 100])
  rows.push([])
  
  if (data.byProperty && data.byProperty.length > 0) {
    rows.push(['Property', 'Occupancy Rate', 'Booked Nights', 'Available Nights'])
    data.byProperty.forEach((prop: any) => {
      rows.push([
        prop.propertyName || 'Unknown',
        (prop.rate || 0) * 100,
        prop.bookedNights || 0,
        prop.availableNights || 0
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
        (month.rate || 0) * 100,
        month.bookedNights || 0,
        month.availableNights || 0
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
  rows.push(['Total Guests', metrics.totalGuests || 0])
  rows.push(['Repeat Guests', metrics.repeatGuests || 0])
  rows.push(['Repeat Rate', (metrics.repeatRate || 0)])
  rows.push(['Average Stay Length', metrics.avgStayLength || 0])
  rows.push(['Average Spend', metrics.avgSpend || 0])
  rows.push(['Total Revenue', metrics.totalRevenue || 0])
  
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
        guest.bookingCount || 0,
        guest.totalSpent || 0,
        guest.avgNightlyRate || 0
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
  rows.push(['Total Tax Collected', summary.totalTax || 0])
  rows.push(['State Tax', summary.stateTax || 0])
  rows.push(['County Tax', summary.countyTax || 0])
  rows.push(['City Tax', summary.cityTax || 0])
  rows.push(['Tourism Tax', summary.tourismTax || 0])
  
  if (data.byProperty && data.byProperty.length > 0) {
    rows.push([])
    rows.push(['Tax by Property'])
    rows.push(['Property', 'Total Tax', 'State', 'County', 'City', 'Tourism'])
    
    data.byProperty.forEach((prop: any) => {
      rows.push([
        prop.propertyName || 'Unknown',
        prop.totalTax || 0,
        prop.stateTax || 0,
        prop.countyTax || 0,
        prop.cityTax || 0,
        prop.tourismTax || 0
      ])
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
          summary += `Total revenue for the period was ${formatCurrency(moduleData.pl.revenue || 0)} with a net profit of ${formatCurrency(moduleData.pl.netProfit || 0)}. `
        }
        break
      case 'occupancy':
        if (moduleData.overall) {
          summary += `Overall occupancy rate was ${formatPercentage(moduleData.overall * 100)}. `
        }
        break
      case 'guests':
        if (moduleData.metrics) {
          summary += `You hosted ${moduleData.metrics.totalGuests || 0} guests with a repeat rate of ${formatPercentage(moduleData.metrics.repeatRate || 0)}. `
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
      return authResult.response
    }
    const { auth } = authResult.request

    const body = await request.json() as {
      templateId: string
      data: ReportData
      config: ReportConfig
    }

    if (!body.data || !body.config) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Missing required data or config' })
      }
    }

    const reportName = `Report-${formatDateISO(new Date())}`
    let reportBuffer: Buffer

    // Generate report based on format
    if (body.config.format === 'pdf') {
      reportBuffer = await generatePDF(body.data, body.config, reportName)
    } else if (body.config.format === 'excel') {
      reportBuffer = await generateExcel(body.data, body.config, reportName)
    } else {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Unsupported format. Use PDF or Excel.' })
      }
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
        auth.tenantId || '',
        body.templateId || null,
        reportName,
        body.config.format,
        reportBuffer.length,
        expiresAt,
        reportBuffer
      ]
    )

    if (!insertResult.success) {
      throw new Error('Failed to store report: ' + insertResult.error)
    }

    return {
      status: 200,
      body: JSON.stringify({
        success: true,
        data: {
          reportId,
          downloadUrl: `/api/reports/download/${reportId}`
        }
      })
    }
  } catch (error) {
    context.error('Error generating report:', error)
    return {
      status: 500,
      body: JSON.stringify({ 
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

app.http('reports-generate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: reportsGenerate
})