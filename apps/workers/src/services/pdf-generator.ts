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
    let yPosition = 20
    
    const { period, sections } = reportData
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Quick Report', 105, yPosition, { align: 'center' })
    yPosition += 8
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Period: ${this.formatDate(period.from)} to ${this.formatDate(period.to)}`, 105, yPosition, { align: 'center' })
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 105, yPosition + 5, { align: 'center' })
    yPosition += 15
    
    const renderedModules = new Set<string>()
    
    for (const section of sections) {
      if (!section || !section.title) continue
      
      if (yPosition > 260) {
        doc.addPage()
        yPosition = 20
      }
      
      const startY = yPosition
      yPosition = await this.addSectionContent(doc, section, yPosition, renderedModules)
      
      if (yPosition > startY) {
        yPosition += 8
      }
    }
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' })
      doc.text('Baileys Analytics', 20, 285)
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
      doc.text(section.error || 'No data available', 20, yPosition)
      return yPosition + 10
    }
    
    switch (section.module) {
      case 'arrivals':
      case 'departures':
      case 'turnovers':
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
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(title.toUpperCase(), 20, yPos)
    yPos += 8
    
    if (items.length === 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(`No ${module} scheduled today`, 20, yPos)
      doc.setTextColor(0, 0, 0)
      return yPos + 10
    }
    
    if (module === 'turnovers' && items.length > 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 0, 0)
      doc.text(`ALERT: ${items.length} properties need same-day turnover`, 20, yPos)
      doc.setTextColor(0, 0, 0)
      yPos += 6
    }
    
    let headers: string[]
    let rows: any[][]
    
    if (module === 'turnovers') {
      headers = ['Property', 'Out → In', 'Gap', 'Action']
      rows = items.slice(0, 15).map((turnover: any) => {
        const gap = this.calculateGapHours(turnover.departureTime || turnover.departure, 
                                          turnover.arrivalTime || turnover.arrival)
        let action = 'Standard clean'
        if (gap < 3) action = 'RUSH CLEAN'
        else if (gap < 5) action = 'Priority clean'
        
        return [
          turnover.propertyName || 'N/A',
          `${turnover.departingGuest || 'Guest'} → ${turnover.arrivingGuest || 'Guest'}`,
          `${gap}h`,
          action
        ]
      })
    } else if (module === 'arrivals') {
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
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: module === 'turnovers' ? {
        2: { halign: 'center' },
        3: { halign: 'left' }
      } : module === 'arrivals' ? {
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
      doc.text('No bookings found for this period', 20, yPos)
      return yPos + 10
    }
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('BOOKING DETAILS', 20, yPos)
    yPos += 8
    
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
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
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
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('FINANCIAL SUMMARY', 20, yPos)
    yPos += 8
    
    const revenue = data.revenue || 0
    const platformFees = data.platformFees || 0
    const netRevenue = data.netRevenue || revenue - platformFees
    const netProfit = data.netProfit || netRevenue
    const profitMargin = revenue > 0 ? netProfit / revenue : 0
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(
      `${this.formatCurrency(revenue)} Gross  •  ${this.formatCurrency(netRevenue)} Net  •  ${this.formatCurrency(netProfit)} Profit  •  ${this.formatPercentage(profitMargin)} Margin`,
      20,
      yPos
    )
    doc.setTextColor(0, 0, 0)
    yPos += 8
    
    const financialData = [
      ['Gross Revenue', this.formatCurrency(revenue)],
      ['Platform Fees', this.formatCurrency(-platformFees)],
      ['Net Revenue', this.formatCurrency(netRevenue)],
      ['Bookings', (data.bookingCount || 0).toString()],
      ['Avg Booking Value', this.formatCurrency(data.avgBookingValue || 0)]
    ]
    
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Amount']],
      body: financialData,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
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
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
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
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('PROPERTY PERFORMANCE', 20, yPos)
    yPos += 8
    
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
          theme: 'plain',
          styles: { fontSize: 8, cellPadding: 2 },
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
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
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
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('GUEST ANALYTICS', 20, yPos)
    yPos += 8
    
    const totalGuests = data.totalGuests || 0
    const repeatGuests = data.repeatGuests || 0
    const repeatRate = data.repeatRate || 0
    const avgSpend = data.avgSpend || 0
    
    if (totalGuests === 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      doc.text('No guest data available for this period', 20, yPos)
      doc.setTextColor(0, 0, 0)
      return yPos + 10
    }
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(
      `${totalGuests} Unique Guests  •  ${repeatGuests} Repeat (${this.formatPercentage(repeatRate)})  •  ${this.formatCurrency(avgSpend)} Avg Spend`,
      20,
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
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
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
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          1: { halign: 'right' }
        }
      })
      
      yPos = (doc as any).lastAutoTable.finalY + 5
    }
    
    return yPos
  }
  
  private addTaxSummary(doc: jsPDF, data: any, yPos: number): number {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('TAX SUMMARY', 20, yPos)
    yPos += 8
    
    const effectiveRate = data.effectiveRate || (data.totalRevenue > 0 ? (data.actualTax / data.totalRevenue) * 100 : 0)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(
      `${this.formatCurrency(data.actualTax || data.estimatedTax || 0)} Total Tax  •  ${this.formatPercentage(effectiveRate / 100)} Effective Rate  •  ${data.bookingCount || 0} Bookings`,
      20,
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
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
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
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
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
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('CHANNEL PERFORMANCE', 20, yPos)
    yPos += 8
    
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
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
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
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('MONTHLY TRENDS', 20, yPos)
    yPos += 8
    
    const headers = ['Month', 'Revenue', 'Bookings', 'Occupancy']
    const rows = trends.slice(-12).map((t: any) => [
      this.formatMonth(t.month),
      this.formatCurrency(t.revenue || 0),
      (t.bookings || 0).toString(),
      `${((t.nights || 0) / 30 * 100).toFixed(0)}%`
    ])
    
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'center' },
        3: { halign: 'center' }
      }
    })
    
    return (doc as any).lastAutoTable.finalY + 5
  }
  
  // Helper methods
  private showTotals = true
  
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
      } else if (headerLower.includes('bookings') || headerLower.includes('nights')) {
        return Math.round(sum).toString()
      } else if (headerLower.includes('avg') || headerLower === 'adr') {
        return this.formatCurrency(sum / numericValues.length)
      } else if (headerLower.includes('channel') || headerLower.includes('guest') || headerLower.includes('property')) {
        return ''
      } else {
        return this.formatCurrency(sum)
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
}