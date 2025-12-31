import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SupabaseClient } from '@supabase/supabase-js'

interface ReportData {
  generatedAt: string
  tenantId: string
  period: { from: string; to: string }
  sections: Array<{
    module: string
    title: string
    data: any
    error?: string
  }>
}

export class PDFGenerator {
  constructor(private supabase: SupabaseClient) {}

  async generatePDF(reportData: ReportData): Promise<ArrayBuffer> {
    const doc = new jsPDF()

    const { period, sections } = reportData

    // add header bar on first page
    this.addPageHeader(doc, 'Quick Report')
    let yPosition = 22

    // period and generated info
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Period: ${this.formatDate(period.from)} to ${this.formatDate(period.to)}`, 14, yPosition)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 196, yPosition, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    yPosition += 10
    
    const renderedModules = new Set<string>()
    
    for (const section of sections) {
      if (!section || !section.title) continue

      if (yPosition > 260) {
        doc.addPage()
        this.addPageHeader(doc, 'Quick Report')
        yPosition = 22
      }
      
      const startY = yPosition
      yPosition = await this.addSectionContent(doc, section, yPosition, renderedModules)
      
      if (yPosition > startY) {
        yPosition += 8
      }
    }
    
    // add footer to all pages
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      this.addPageFooter(doc, i, pageCount)
    }
    
    return doc.output('arraybuffer')
  }
  
  private async addSectionContent(
    doc: jsPDF,
    section: any,
    yPosition: number,
    renderedModules: Set<string>
  ): Promise<number> {
    const moduleGroups: Record<string, string> = {
      'properties': 'property_performance',
      'revenue_by_property': 'property_performance',
      'occupancy': 'property_performance',
      'guests': 'guest_analytics',
      'repeat_rate': 'guest_analytics',
      'tax': 'tax_report',
      'jurisdictions': 'tax_report',
      'channels': 'channel_analysis',
      'revenue_by_channel': 'channel_analysis',
      'trends': 'trends_analysis',
      'revenue': 'financial',
      'pl': 'financial',
      'expenses': 'financial'
    }
    
    const primaryModule = moduleGroups[section.module] || section.module
    
    if (renderedModules.has(primaryModule)) {
      return yPosition
    }
    
    renderedModules.add(primaryModule)
    
    if (!section.data) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.text(section.error || 'No data available', 14, yPosition)
      return yPosition + 10
    }
    
    switch (section.module) {
      case 'arrivals':
      case 'departures':
        return this.addOperationalList(doc, section, yPosition)
        
      case 'bookings':
        return this.addBookingsDetails(doc, section.data, yPosition)
        
      case 'revenue':
      case 'pl':
      case 'expenses':
        return this.addFinancialSummary(doc, section.data, yPosition)
        
      case 'properties':
      case 'revenue_by_property':
      case 'occupancy':
        return this.addPropertyPerformance(doc, section.data, yPosition)
        
      case 'guests':
      case 'repeat_rate':
        return this.addGuestMetrics(doc, section.data, yPosition)
        
      case 'tax':
      case 'jurisdictions':
        return this.addTaxSummary(doc, section.data, yPosition)
        
      case 'channels':
      case 'revenue_by_channel':
        return this.addChannelPerformance(doc, section.data, yPosition)
        
      case 'trends':
        return this.addMonthlyTrends(doc, section.data, yPosition)
        
      default:
        return yPosition
    }
  }
  
  private addOperationalList(doc: jsPDF, section: any, yPos: number): number {
    const { module, title, data } = section
    const items = Array.isArray(data) ? data : []

    yPos = this.addSectionTitle(doc, title.toUpperCase(), yPos)

    if (items.length === 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(`No ${module} scheduled today`, 14, yPos)
      doc.setTextColor(0, 0, 0)
      return yPos + 10
    }

    let headers: string[]
    let rows: any[][]

    if (module === 'arrivals') {
      headers = ['Property', 'Guest', 'Time', 'Nights', 'Amount', 'Contact']
      rows = items.slice(0, 15).map((booking: any) => {
        const hasContact = booking.guestEmail || booking.guestPhone ? '✓' : '✗'
        return [
          booking.propertyName || 'N/A',
          booking.guestName || 'Guest',
          this.formatTime(booking.time || booking.arrival),
          (booking.nights || this.calculateNights(booking.arrival, booking.departure)).toString(),
          this.formatCurrency(booking.amount || booking.totalAmount || 0),
          hasContact
        ]
      })
    } else {
      headers = ['Property', 'Guest', 'Time', 'Amount']
      rows = items.slice(0, 15).map((booking: any) => [
        booking.propertyName || 'N/A',
        booking.guestName || 'Guest',
        this.formatTime(booking.time || booking.departure),
        this.formatCurrency(booking.amount || booking.totalAmount || 0)
      ])
    }
    
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows,
      ...this.getTableStyles(),
      columnStyles: module === 'arrivals' ? {
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'center' }
      } : {
        2: { halign: 'center' },
        3: { halign: 'right' }
      }
    })

    return (doc as any).lastAutoTable.finalY + 5
  }

  private addBookingsDetails(doc: jsPDF, data: any, yPos: number): number {
    const bookings = Array.isArray(data) ? data : []

    if (bookings.length === 0) {
      doc.setFontSize(10)
      doc.text('No bookings found for this period', 14, yPos)
      return yPos + 10
    }

    yPos = this.addSectionTitle(doc, 'BOOKING DETAILS', yPos)
    
    const headers = ['Property', 'Guest', 'Dates', 'Nights', 'Amount', 'Channel']
    const rows = bookings.slice(0, 20).map((booking: any) => [
      booking.properties?.name || 'N/A',
      booking.guest_name || 'Guest',
      `${this.formatDate(booking.arrival)} - ${this.formatDate(booking.departure)}`,
      this.calculateNights(booking.arrival, booking.departure).toString(),
      this.formatCurrency(booking.total_amount || 0),
      booking.platform || 'Direct'
    ])
    
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows,
      ...this.getTableStyles(),
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'center' }
      },
      foot: this.showTotals ? [this.calculateTotals(headers, rows)] : undefined
    })

    return (doc as any).lastAutoTable.finalY + 5
  }

  private addFinancialSummary(doc: jsPDF, data: any, yPos: number): number {
    yPos = this.addSectionTitle(doc, 'FINANCIAL SUMMARY', yPos)
    
    const revenue = data.revenue || 0
    const platformFees = data.platformFees || 0
    const netRevenue = data.netRevenue || revenue - platformFees

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(
      `${this.formatCurrency(revenue)} Gross  •  ${this.formatCurrency(platformFees)} Fees  •  ${this.formatCurrency(netRevenue)} Net`,
      14,
      yPos
    )
    doc.setTextColor(0, 0, 0)
    yPos += 6

    const financialData = [
      ['Gross Revenue', this.formatCurrency(revenue)],
      ['Platform Fees', this.formatCurrency(-platformFees)],
      ['Net After Fees', this.formatCurrency(netRevenue)],
      ['Bookings', (data.bookingCount || 0).toString()],
      ['Avg Booking Value', this.formatCurrency(data.avgBookingValue || 0)]
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Amount']],
      body: financialData,
      ...this.getTableStyles(),
      columnStyles: {
        1: { halign: 'right' }
      }
    })
    
    yPos = (doc as any).lastAutoTable.finalY + 8
    
    if (data.monthlyRevenue && data.monthlyRevenue.length > 0) {
      if (yPos > 200) {
        doc.addPage()
        yPos = 30
      }
      
      const trendHeaders = ['Month', 'Revenue', 'Bookings', 'Avg Booking']
      const trendRows = data.monthlyRevenue.slice(-6).map((m: any) => [
        this.formatMonth(m.month),
        this.formatCurrency(m.revenue || 0),
        (m.bookings || 0).toString(),
        m.bookings ? this.formatCurrency(m.revenue / m.bookings) : '-'
      ])
      
      autoTable(doc, {
        startY: yPos,
        head: [trendHeaders],
        body: trendRows,
        ...this.getTableStyles(),
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'center' },
          3: { halign: 'right' }
        }
      })

      yPos = (doc as any).lastAutoTable.finalY + 5
    }

    return yPos
  }

  private addPropertyPerformance(doc: jsPDF, data: any, yPos: number): number {
    const properties = Array.isArray(data) ? data : []

    if (properties.length === 0) {
      return yPos
    }

    yPos = this.addSectionTitle(doc, 'PROPERTY PERFORMANCE', yPos)
    
    if (data.gapAnalysis) {
      const { singleNightGaps = 0, twoNightGaps = 0, threeNightGaps = 0 } = data.gapAnalysis
      const totalGaps = singleNightGaps + twoNightGaps + threeNightGaps
      
      if (totalGaps > 0) {
        const gapHeaders = ['Gap Type', 'Count']
        const gapRows = [
          ['1-night gaps', singleNightGaps.toString()],
          ['2-night gaps', twoNightGaps.toString()],
          ['3-night gaps', threeNightGaps.toString()],
          ['Total Gaps', totalGaps.toString()]
        ]
        
        autoTable(doc, {
          startY: yPos,
          head: [gapHeaders],
          body: gapRows,
          ...this.getTableStyles(),
          columnStyles: {
            1: { halign: 'center' }
          }
        })

        yPos = (doc as any).lastAutoTable.finalY + 8
      }
    }
    
    const headers = ['Property', 'Revenue', 'Bookings', 'Occupancy', 'ADR']
    const rows = properties
      .sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0))
      .slice(0, 10)
      .map((prop: any) => {
        const adr = prop.nights > 0 ? prop.revenue / prop.nights : 0
        return [
          prop.propertyName || 'Unknown',
          this.formatCurrency(prop.revenue || 0),
          (prop.bookings || 0).toString(),
          this.formatPercentage(prop.occupancyRate || 0),
          this.formatCurrency(adr)
        ]
      })
    
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows,
      ...this.getTableStyles(),
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' }
      },
      foot: this.showTotals ? [this.calculateTotals(headers, rows)] : undefined
    })

    return (doc as any).lastAutoTable.finalY + 5
  }

  private addGuestMetrics(doc: jsPDF, data: any, yPos: number): number {
    yPos = this.addSectionTitle(doc, 'GUEST ANALYTICS', yPos)
    
    const totalGuests = data.totalGuests || 0
    const repeatGuests = data.repeatGuests || 0
    const repeatRate = data.repeatRate || 0
    const avgSpend = data.avgSpend || 0
    
    if (totalGuests === 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      doc.text('No guest data available for this period', 14, yPos)
      doc.setTextColor(0, 0, 0)
      return yPos + 10
    }
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(
      `${totalGuests} Unique Guests  •  ${repeatGuests} Repeat (${this.formatPercentage(repeatRate)})  •  ${this.formatCurrency(avgSpend)} Avg Spend`,
      14,
      yPos
    )
    doc.setTextColor(0, 0, 0)
    yPos += 8
    
    if (data.topGuests && data.topGuests.length > 0) {
      const headers = ['Guest', 'Bookings', 'Total Spent', 'Avg/Stay']
      const rows = data.topGuests.slice(0, 10).map((g: any) => [
        g.name || 'Guest',
        (g.bookings || 0).toString(),
        this.formatCurrency(g.revenue || 0),
        this.formatCurrency(g.bookings > 0 ? g.revenue / g.bookings : 0)
      ])
      
      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body: rows,
        ...this.getTableStyles(),
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' }
        }
      })

      yPos = (doc as any).lastAutoTable.finalY + 5
    } else {
      const basicData = [
        ['Total Unique Guests', totalGuests.toString()],
        ['Repeat Guests', `${repeatGuests} (${this.formatPercentage(repeatRate)})`],
        ['Average Spend per Guest', this.formatCurrency(avgSpend)],
        ['Average Stay Length', `${(data.avgStayLength || 0).toFixed(1)} nights`]
      ]

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: basicData,
        ...this.getTableStyles(),
        columnStyles: {
          1: { halign: 'right' }
        }
      })

      yPos = (doc as any).lastAutoTable.finalY + 5
    }

    return yPos
  }

  private addTaxSummary(doc: jsPDF, data: any, yPos: number): number {
    yPos = this.addSectionTitle(doc, 'TAX SUMMARY', yPos)
    
    const effectiveRate = data.effectiveRate || (data.totalRevenue > 0 ? (data.actualTax / data.totalRevenue) * 100 : 0)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(
      `${this.formatCurrency(data.actualTax || data.estimatedTax || 0)} Total Tax  •  ${this.formatPercentage(effectiveRate / 100)} Effective Rate  •  ${data.bookingCount || 0} Bookings`,
      14,
      yPos
    )
    doc.setTextColor(0, 0, 0)
    yPos += 8
    
    const taxData = [
      ['Total Revenue', this.formatCurrency(data.totalRevenue || 0)],
      ['Total Tax Collected', this.formatCurrency(data.actualTax || data.estimatedTax || 0)],
      ['Owner Remitted', this.formatCurrency(data.ownerRemitted || 0)],
      ['Platform Remitted', this.formatCurrency(data.platformRemitted || 0)],
      ['Effective Tax Rate', this.formatPercentage((data.effectiveRate || 0) / 100)]
    ]
    
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Amount']],
      body: taxData,
      ...this.getTableStyles(),
      columnStyles: {
        1: { halign: 'right' }
      }
    })

    yPos = (doc as any).lastAutoTable.finalY + 8

    if (data.byJurisdiction && data.byJurisdiction.length > 0) {
      const jurisdictionHeaders = ['Jurisdiction', 'Type', 'Total Tax', 'Owner', 'Platform']
      const jurisdictionRows = data.byJurisdiction.map((j: any) => [
        j.name,
        j.type,
        this.formatCurrency(j.totalAmount || 0),
        this.formatCurrency(j.ownerRemitted || 0),
        this.formatCurrency(j.platformRemitted || 0)
      ])

      autoTable(doc, {
        startY: yPos,
        head: [jurisdictionHeaders],
        body: jurisdictionRows,
        ...this.getTableStyles(),
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' }
        }
      })

      yPos = (doc as any).lastAutoTable.finalY + 5
    }

    return yPos
  }

  private addChannelPerformance(doc: jsPDF, data: any, yPos: number): number {
    const channels = Array.isArray(data) ? data : []

    if (channels.length === 0) {
      return yPos
    }

    yPos = this.addSectionTitle(doc, 'CHANNEL PERFORMANCE', yPos)
    
    const headers = ['Channel', 'Bookings', 'Revenue', 'Avg Value']
    const rows = channels.map((c: any) => [
      c.channel || 'Direct',
      (c.bookings || 0).toString(),
      this.formatCurrency(c.revenue || 0),
      this.formatCurrency(c.avgValue || 0)
    ])
    
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows,
      ...this.getTableStyles(),
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      foot: this.showTotals ? [this.calculateTotals(headers, rows)] : undefined
    })

    return (doc as any).lastAutoTable.finalY + 5
  }

  private addMonthlyTrends(doc: jsPDF, data: any, yPos: number): number {
    const trends = Array.isArray(data) ? data : []

    if (trends.length === 0) {
      return yPos
    }

    yPos = this.addSectionTitle(doc, 'MONTHLY TRENDS', yPos)
    
    const headers = ['Month', 'Revenue', 'Bookings', 'Occupancy']
    const rows = trends.slice(-12).map((t: any) => {
      // Use occupancyRate if provided, otherwise calculate using actual days in month
      let occupancy = 0
      if (t.occupancyRate !== undefined) {
        occupancy = t.occupancyRate * 100
      } else if (t.nights && t.month) {
        const daysInMonth = this.getDaysInMonth(t.month)
        occupancy = (t.nights / daysInMonth) * 100
      }

      return [
        this.formatMonth(t.month),
        this.formatCurrency(t.revenue || 0),
        (t.bookings || 0).toString(),
        `${occupancy.toFixed(0)}%`
      ]
    })
    
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows,
      ...this.getTableStyles(),
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'center' },
        3: { halign: 'center' }
      }
    })

    return (doc as any).lastAutoTable.finalY + 5
  }

  // helper methods
  private showTotals = true

  private addPageHeader(doc: jsPDF, reportType: string): void {
    doc.setFillColor(40, 40, 40)
    doc.rect(0, 0, 210, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Baileys Analytics', 15, 8)
    doc.text(reportType, 195, 8, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
  }

  private addPageFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
    doc.setDrawColor(180, 180, 180)
    doc.line(15, 280, 195, 280)
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`Page ${pageNum} of ${totalPages}`, 105, 287, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  private addSectionTitle(doc: jsPDF, title: string, yPos: number): number {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 14, yPos)
    doc.setDrawColor(60, 60, 60)
    doc.line(14, yPos + 2, 196, yPos + 2)
    doc.setFont('helvetica', 'normal')
    return yPos + 8
  }

  private getTableStyles() {
    return {
      theme: 'grid' as const,
      headStyles: {
        fillColor: [40, 40, 40] as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold' as const,
        fontSize: 8
      },
      footStyles: {
        fillColor: [60, 60, 60] as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold' as const,
        fontSize: 8
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [120, 120, 120] as [number, number, number],
        lineWidth: 0.1
      }
    }
  }

  private calculateTotals(headers: string[], rows: any[][]): string[] {
    return headers.map((header, colIndex) => {
      if (colIndex === 0) return 'Total'

      const columnValues = rows.map(row => row[colIndex])
      const numericValues = columnValues
        .map(v => {
          const str = String(v).replace(/[^0-9.-]/g, '')
          return parseFloat(str)
        })
        .filter(v => !isNaN(v))

      if (numericValues.length === 0) return ''

      const sum = numericValues.reduce((a, b) => a + b, 0)
      const headerLower = header.toLowerCase()

      if (headerLower.includes('occupancy') || headerLower.includes('%')) {
        return `${(sum / numericValues.length).toFixed(0)}%`
      } else if (headerLower.includes('bookings') || headerLower.includes('nights') ||
                 headerLower.includes('count') || headerLower.includes('year')) {
        return Math.round(sum).toString()
      } else if (headerLower.includes('avg') || headerLower === 'adr') {
        return this.formatCurrency(sum / numericValues.length)
      } else if (headerLower.includes('channel') || headerLower.includes('guest') ||
                 headerLower.includes('property')) {
        return ''
      } else if (headerLower.includes('revenue') || headerLower.includes('amount') ||
                 headerLower.includes('total') || headerLower.includes('price') ||
                 headerLower.includes('fee') || headerLower.includes('spend') ||
                 headerLower.includes('value')) {
        return this.formatCurrency(sum)
      } else {
        // For unknown columns, return plain number instead of assuming currency
        return Math.round(sum).toString()
      }
    })
  }
  
  private formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString()
  }
  
  private formatMonth(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  }
  
  private formatTime(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }
  
  private formatPercentage(value: number): string {
    return `${(value * 100).toFixed(0)}%`
  }
  
  private calculateNights(arrival: string, departure: string): number {
    if (!arrival || !departure) return 0
    const arrivalDate = new Date(arrival)
    const departureDate = new Date(departure)
    const nights = Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, nights)
  }
  
  private calculateGapHours(depTime: string, arrTime: string): number {
    if (!depTime || !arrTime) return 0
    const dep = new Date(depTime)
    const arr = new Date(arrTime)
    const hours = Math.round((arr.getTime() - dep.getTime()) / (1000 * 60 * 60))
    return Math.max(0, hours)
  }

  private getDaysInMonth(dateStr: string): number {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth()
    // Get the last day of the month by going to day 0 of next month
    return new Date(year, month + 1, 0).getDate()
  }
}