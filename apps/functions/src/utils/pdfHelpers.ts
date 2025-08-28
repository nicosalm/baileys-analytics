import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatPercentage } from '@baileys/utils'

export interface ChartOptions {
  type: 'bar' | 'line' | 'pie'
  data: any[]
  labels: string[]
  colors?: string[]
  title?: string
}

// Color palette for charts
export const CHART_COLORS = {
  primary: [59, 130, 246] as [number, number, number],    // Blue
  success: [34, 197, 94] as [number, number, number],     // Green
  warning: [251, 146, 60] as [number, number, number],    // Orange
  danger: [239, 68, 68] as [number, number, number],      // Red
  purple: [147, 51, 234] as [number, number, number],     // Purple
  gray: [107, 114, 128] as [number, number, number],      // Gray
}

// Draw a simple bar chart in PDF
export function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: number[],
  labels: string[],
  title?: string
): number {
  const maxValue = Math.max(...data)
  const barWidth = width / data.length * 0.7
  const gap = width / data.length * 0.3
  
  // Title
  if (title) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(title, x + width / 2, y - 5, { align: 'center' })
  }
  
  // Draw axes
  doc.setDrawColor(200, 200, 200)
  doc.line(x, y + height, x + width, y + height) // X-axis
  doc.line(x, y, x, y + height) // Y-axis
  
  // Draw bars
  data.forEach((value, i) => {
    const barHeight = (value / maxValue) * height * 0.9
    const barX = x + (i * (barWidth + gap)) + gap / 2
    const barY = y + height - barHeight
    
    // Bar
    doc.setFillColor(...CHART_COLORS.primary)
    doc.rect(barX, barY, barWidth, barHeight, 'F')
    
    // Value label
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(formatCurrency(value), barX + barWidth / 2, barY - 2, { align: 'center' })
    
    // X-axis label
    doc.setFontSize(7)
    const label = labels[i] || ''
    doc.text(label, barX + barWidth / 2, y + height + 4, { align: 'center', maxWidth: barWidth })
  })
  
  return y + height + 15
}

// Draw a simple line chart in PDF
export function drawLineChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: number[],
  labels: string[],
  title?: string
): number {
  const maxValue = Math.max(...data)
  const minValue = Math.min(...data)
  const range = maxValue - minValue
  const pointSpacing = width / (data.length - 1)
  
  // Title
  if (title) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(title, x + width / 2, y - 5, { align: 'center' })
  }
  
  // Draw axes
  doc.setDrawColor(200, 200, 200)
  doc.line(x, y + height, x + width, y + height) // X-axis
  doc.line(x, y, x, y + height) // Y-axis
  
  // Draw line
  doc.setDrawColor(...CHART_COLORS.primary)
  doc.setLineWidth(1)
  
  const points: [number, number][] = data.map((value, i) => {
    const px = x + (i * pointSpacing)
    const py = y + height - ((value - minValue) / range * height * 0.9)
    return [px, py]
  })
  
  // Draw lines between points
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])
  }
  
  // Draw points and labels
  points.forEach((point, i) => {
    // Draw point
    doc.setFillColor(...CHART_COLORS.primary)
    doc.circle(point[0], point[1], 1.5, 'F')
    
    // Value label
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(formatCurrency(data[i]), point[0], point[1] - 3, { align: 'center' })
    
    // X-axis label
    if (labels[i]) {
      doc.text(labels[i], point[0], y + height + 4, { align: 'center' })
    }
  })
  
  doc.setLineWidth(0.1) // Reset line width
  return y + height + 15
}

// Draw a simple pie chart in PDF
export function drawPieChart(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  radius: number,
  data: Array<{ value: number, label: string }>,
  title?: string
): number {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let currentAngle = -Math.PI / 2 // Start from top
  
  const colors = [
    CHART_COLORS.primary,
    CHART_COLORS.success,
    CHART_COLORS.warning,
    CHART_COLORS.purple,
    CHART_COLORS.danger,
    CHART_COLORS.gray
  ]
  
  // Title
  if (title) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(title, centerX, centerY - radius - 10, { align: 'center' })
  }
  
  // Draw pie slices
  data.forEach((item, i) => {
    const angle = (item.value / total) * Math.PI * 2
    const endAngle = currentAngle + angle
    const color = colors[i % colors.length]
    
    // Draw sector
    doc.setFillColor(...color)
    
    // Create path for sector
    const steps = 30
    const angleStep = angle / steps
    
    doc.moveTo(centerX, centerY)
    for (let j = 0; j <= steps; j++) {
      const a = currentAngle + (angleStep * j)
      const x = centerX + Math.cos(a) * radius
      const y = centerY + Math.sin(a) * radius
      doc.lineTo(x, y)
    }
    doc.lineTo(centerX, centerY)
    doc.fill()
    
    // Add label
    const labelAngle = currentAngle + angle / 2
    const labelX = centerX + Math.cos(labelAngle) * (radius * 1.3)
    const labelY = centerY + Math.sin(labelAngle) * (radius * 1.3)
    
    doc.setFontSize(8)
    doc.text(
      `${item.label}: ${formatPercentage(item.value / total)}`,
      labelX,
      labelY,
      { align: 'center' }
    )
    
    currentAngle = endAngle
  })
  
  return centerY + radius + 20
}

// Add a minimal summary metric
export function addSummaryCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  value: string,
  subtitle?: string,
  color: keyof typeof CHART_COLORS = 'primary'
): number {
  // Metric title - small gray text
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(title.toUpperCase(), x, y)
  
  // Metric value - larger black text
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(value, x, y + 6)
  
  // Optional subtitle - tiny light gray
  if (subtitle) {
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 140, 140)
    doc.text(subtitle, x, y + 10)
  }
  
  doc.setTextColor(0, 0, 0)
  return y + (subtitle ? 14 : 10)
}

// Add a data table with better formatting
export function addDataTable(
  doc: jsPDF,
  startY: number,
  headers: string[],
  data: any[][],
  options?: {
    columnStyles?: any
    title?: string
    showTotals?: boolean
  }
): number {
  if (options?.title) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(options.title, 20, startY - 5)
  }
  
  const tableData = [...data]
  
  // Add totals row if requested
  if (options?.showTotals && data.length > 0) {
    const totals = headers.map((_, colIndex) => {
      if (colIndex === 0) return 'Total'
      
      const columnValues = data.map(row => row[colIndex])
      const numericValues = columnValues
        .map(v => typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, '')))
        .filter(v => !isNaN(v))
      
      if (numericValues.length > 0) {
        const sum = numericValues.reduce((a, b) => a + b, 0)
        const header = headers[colIndex].toLowerCase()
        
        // Check column type based on header name
        if (header.includes('rate') || header.includes('margin') || header.includes('occupancy') || header.includes('%')) {
          return formatPercentage(sum / numericValues.length)
        } else if (header === 'bookings' || header.includes('nights') || header.includes('count') || header === 'guests' || header.includes('stay')) {
          // For average stay, show average not sum
          if (header.includes('avg') && header.includes('stay')) {
            return `${(sum / numericValues.length).toFixed(1)} nights`
          }
          return Math.round(sum).toString()
        } else {
          // Currency columns (including "Avg Booking" which is average booking value)
          return formatCurrency(sum)
        }
      }
      return ''
    })
    
    tableData.push(totals)
  }
  
  autoTable(doc, {
    startY: options?.title ? startY : startY,
    head: [headers],
    body: tableData,
    theme: 'plain',
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      cellPadding: { top: 1, bottom: 1, left: 0, right: 2 },
      lineWidth: { bottom: 0.2 },
      lineColor: [200, 200, 200]
    },
    styles: { 
      fontSize: 7,
      textColor: [40, 40, 40],
      cellPadding: { top: 1, bottom: 1, left: 0, right: 2 },
      lineWidth: 0,
      overflow: 'linebreak'
    },
    columnStyles: options?.columnStyles || {},
    margin: { left: 20, right: 20 },
    alternateRowStyles: { fillColor: false },
    footStyles: options?.showTotals ? { 
      fillColor: [255, 255, 255],
      fontStyle: 'bold',
      lineWidth: { top: 0.2 },
      lineColor: [200, 200, 200]
    } : undefined
  })
  
  return (doc as any).lastAutoTable.finalY + 10
}

// Format number for display
export function formatNumber(value: number | null | undefined, type: 'currency' | 'percentage' | 'number' = 'number'): string {
  if (value === null || value === undefined) return 'N/A'
  
  switch (type) {
    case 'currency':
      return formatCurrency(value)
    case 'percentage':
      return formatPercentage(value)
    default:
      return value.toLocaleString()
  }
}