import React from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import { resolveToken } from '@/lib/theme'

interface GaugeChartProps {
  value: number
  min?: number
  max?: number
  segments?: {
    threshold: number
    color: string
    label?: string
  }[]
  width?: number
  height?: number
  label?: string
  format?: (value: number) => string
  showMinMax?: boolean
}

const RADIAN = Math.PI / 180

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  min = 0,
  max = 100,
  segments = [
    { threshold: 33,  color: resolveToken('--danger'),  label: 'Low' },
    { threshold: 66,  color: resolveToken('--warning'), label: 'Medium' },
    { threshold: 100, color: resolveToken('--success'), label: 'High' }
  ],
  width = 260,
  height = 140,
  label,
  format = (v) => `${v.toFixed(0)}`,
  showMinMax = true
}) => {
  
  // Create color data from segments with descriptions
  const colorData = segments.map((segment, index) => {
    const prevThreshold = index > 0 ? segments[index - 1].threshold : 0
    const prevValue = index > 0 ? segments[index - 1].threshold * (max - min) / 100 + min : min
    const currentValue = segment.threshold * (max - min) / 100 + min
    
    // Generate description based on the label
    let description = ''
    if (segment.label === 'Low' || segment.label === 'Below') {
      description = `Performance below expectations (${format(prevValue)} - ${format(currentValue)})`
    } else if (segment.label === 'Medium' || segment.label === 'Target') {
      description = `On track with targets (${format(prevValue)} - ${format(currentValue)})`
    } else if (segment.label === 'High' || segment.label === 'Above') {
      description = `Exceeding expectations (${format(prevValue)} - ${format(currentValue)})`
    } else {
      description = `${segment.label} range (${format(prevValue)} - ${format(currentValue)})`
    }
    
    return {
      value: segment.threshold - prevThreshold,
      color: segment.color,
      label: segment.label,
      description,
      range: `${format(prevValue)} - ${format(currentValue)}`
    }
  })

  // Normalize value to 0-100 scale based on min/max
  // Handle edge cases where value is 0, NaN, or max equals min
  const safeValue = isNaN(value) ? min : value
  const safeDivisor = (max - min) || 1 // Prevent division by zero
  const normalizedValue = ((safeValue - min) / safeDivisor) * 100
  const clampedValue = Math.min(Math.max(normalizedValue, 0), 100)

  // calculate which sector is active (the one the needle points to)
  let activeSectorIndex = -1
  let cumulative = 0
  for (let i = 0; i < colorData.length; i++) {
    const prevCumulative = cumulative
    cumulative += colorData[i].value
    if (clampedValue > prevCumulative && clampedValue <= cumulative) {
      activeSectorIndex = i
      break
    }
  }

  const cx = width / 2
  const cy = height - 20
  
  const pieProps = {
    startAngle: 180,
    endAngle: 0,
    cx,
    cy
  }

  const innerRadius = (width / 2) * 0.4
  const outerRadius = (width / 2) * 0.55

  // Calculate needle angle
  // In Recharts semicircle: startAngle=180 (left) to endAngle=0 (right)
  // So for our gauge: 180 degrees = 0% (far left), 90 degrees = 50% (top), 0 degrees = 100% (far right)
  // We need to map: value 0% -> angle 180°, value 100% -> angle 0°
  const needleAngle = 180 - (clampedValue / 100 * 180)
  const radianAngle = needleAngle * RADIAN
  
  // Calculate needle endpoints using proper trigonometry
  // Note: In SVG/Recharts, angles are measured clockwise from 3 o'clock position
  // We need to adjust for the semicircle starting at 9 o'clock (180°)
  // Ensure needle length stays within bounds even at 0 value
  const needleLength = Math.min(outerRadius - 5, outerRadius * 0.9) // Keep needle within gauge bounds
  const needleX = cx + needleLength * Math.cos(-radianAngle)
  const needleY = cy + needleLength * Math.sin(-radianAngle)

  // Get the current performance label
  const currentPerformance = activeSectorIndex >= 0 ? colorData[activeSectorIndex]?.label : ''


  return (
    <div className="relative" style={{ width, height: height + 40 }}>
      <PieChart width={width} height={height + 20}>
        {/* Base colored segments */}
        <Pie
          data={colorData}
          dataKey="value"
          {...pieProps}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          fill={resolveToken('--chart-series-5')}
          stroke="none"
          isAnimationActive={false}
        >
          {colorData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color} 
              stroke="none"
              opacity={index === activeSectorIndex ? 0.9 : 0.7}
            />
          ))}
        </Pie>
        
        {/* Active segment overlay - always visible, non-interactive */}
        {activeSectorIndex >= 0 && (
          <Pie
            data={[{ value: 1 }]}  // Simple data just for rendering
            dataKey="value"
            {...pieProps}
            startAngle={180 - colorData.slice(0, activeSectorIndex + 1).reduce((a, b) => a + b.value, 0) * 1.8}
            endAngle={180 - colorData.slice(0, activeSectorIndex).reduce((a, b) => a + b.value, 0) * 1.8}
            innerRadius={innerRadius - 3}
            outerRadius={outerRadius + 6}
            fill="transparent"
            stroke="none"
            isAnimationActive={false}
            style={{ pointerEvents: 'none' }}  // Make non-interactive
          >
            <Cell 
              fill={colorData[activeSectorIndex].color}
              stroke="none"
            />
          </Pie>
        )}
      </PieChart>
      
      {/* Needle rendered as SVG overlay */}
      <svg 
        width={width} 
        height={height + 20}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0,
          pointerEvents: 'none'
        }}
      >
        {/* Needle shadow */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Main needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={resolveToken('--muted-foreground')}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Needle highlight */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={resolveToken('--chart-reference')}
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Center pin */}
        <circle cx={cx} cy={cy} r={4} fill={resolveToken('--muted-foreground')} fillOpacity={0.5} />
        <circle cx={cx} cy={cy} r={2.5} fill={resolveToken('--chart-reference')} fillOpacity={0.6} />
      </svg>
      
      {/* Value display */}
      <div 
        className="absolute flex flex-col items-center justify-center"
        style={{
          left: cx - 50,
          top: cy - 20,
          width: 100,
          height: 40
        }}
      >
        <span className="text-xl font-bold text-foreground">{format(value)}</span>
        {currentPerformance && (
          <span className="text-xs text-muted-foreground font-medium mt-0.5">{currentPerformance}</span>
        )}
      </div>
      
      {/* Min/Max labels */}
      {showMinMax && (
        <>
          <div 
            className="absolute text-xs text-muted-foreground font-medium"
            style={{
              left: 15,
              bottom: 20
            }}
          >
            {format(min)}
          </div>
          <div
            className="absolute text-xs text-muted-foreground font-medium"
            style={{
              right: 15,
              bottom: 20
            }}
          >
            {format(max)}
          </div>
        </>
      )}
      
      {/* Optional label */}
      {label && (
        <div className="text-xs text-muted-foreground text-center font-medium">
          {label}
        </div>
      )}
    </div>
  )
}