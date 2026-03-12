import React, { useMemo, useState, useCallback, memo } from 'react'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'
import type { SankeyNodeProps as NodeProps, SankeyLinkProps as LinkProps, SankeyData } from 'recharts'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import { getPlatformColor, getChartColor } from '@/lib/theme'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'

interface PropertyPlatformMix {
  propertyId: string
  propertyName: string
  propertyCode?: string | null
  platforms: Array<{ platform: string; bookings: number; revenue: number }>
}

interface PlatformPropertySankeyProps {
  data: PropertyPlatformMix[]
  onPropertyClick?: (propertyId: string, propertyName: string) => void
}

interface LinkMeta {
  platformName: string
  propertyName: string
  revenue: number
  bookings: number
  pctOfPlatform: number
  pctOfProperty: number
}

function buildSankeyData(data: PropertyPlatformMix[]): {
  sankeyData: SankeyData
  nodeColors: string[]
  nodeMap: Map<number, { type: 'platform' | 'property'; id?: string; name: string }>
  linkMeta: LinkMeta[]
} {
  const nodes: { name: string }[] = []
  const links: { source: number; target: number; value: number }[] = []
  const linkMeta: LinkMeta[] = []
  const nodeColors: string[] = []
  const nodeMap = new Map<number, { type: 'platform' | 'property'; id?: string; name: string }>()

  const platformTotals = new Map<string, number>()
  for (const prop of data) {
    for (const entry of prop.platforms || []) {
      if (entry.revenue > 0) {
        platformTotals.set(entry.platform, (platformTotals.get(entry.platform) || 0) + entry.revenue)
      }
    }
  }

  const sortedPlatforms = Array.from(platformTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)

  if (sortedPlatforms.length === 0) {
    return { sankeyData: { nodes: [], links: [] }, nodeColors: [], nodeMap, linkMeta: [] }
  }

  // column 1: platforms
  const platformIndices = new Map<string, number>()
  sortedPlatforms.forEach((platform, i) => {
    const idx = nodes.length
    nodes.push({ name: platform })
    nodeColors.push(getPlatformColor(platform, i))
    platformIndices.set(platform, idx)
    nodeMap.set(idx, { type: 'platform', name: platform })
  })

  // column 2: properties sorted by total revenue
  const propertiesSorted = [...data]
    .map(p => ({
      ...p,
      totalRevenue: (p.platforms || []).reduce((sum, e) => sum + e.revenue, 0)
    }))
    .filter(p => p.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)

  const propertyIndices = new Map<string, number>()
  propertiesSorted.forEach((prop, i) => {
    const idx = nodes.length
    const label = prop.propertyCode || (prop.propertyName.length > 20 ? prop.propertyName.slice(0, 18) + '\u2026' : prop.propertyName)
    nodes.push({ name: label })
    nodeColors.push(getChartColor(i))
    propertyIndices.set(prop.propertyId, idx)
    nodeMap.set(idx, { type: 'property', id: prop.propertyId, name: prop.propertyName })
  })

  // links: platform → property
  for (const prop of propertiesSorted) {
    const propIdx = propertyIndices.get(prop.propertyId)
    if (propIdx === undefined) continue

    for (const entry of prop.platforms || []) {
      if (entry.revenue <= 0) continue
      const platIdx = platformIndices.get(entry.platform)
      if (platIdx === undefined) continue

      const platformTotal = platformTotals.get(entry.platform) || 1

      links.push({ source: platIdx, target: propIdx, value: entry.revenue })
      linkMeta.push({
        platformName: entry.platform,
        propertyName: prop.propertyName,
        revenue: entry.revenue,
        bookings: entry.bookings,
        pctOfPlatform: (entry.revenue / platformTotal) * 100,
        pctOfProperty: (entry.revenue / prop.totalRevenue) * 100,
      })
    }
  }

  return { sankeyData: { nodes, links }, nodeColors, nodeMap, linkMeta }
}

const SankeyNodeRenderer = memo<NodeProps & {
  nodeColors: string[]
  nodeMap: Map<number, { type: 'platform' | 'property'; id?: string; name: string }>
  onPropertyClick?: (propertyId: string, propertyName: string) => void
}>(({
  x, y, width, height, index, payload, nodeColors, nodeMap, onPropertyClick
}) => {
  const color = nodeColors[index] || '#6b7280'
  const info = nodeMap.get(index)
  const isProperty = info?.type === 'property'
  const isClickable = isProperty && onPropertyClick && info?.id

  const handleClick = useCallback(() => {
    if (isClickable && info?.id) {
      onPropertyClick!(info.id, info.name)
    }
  }, [isClickable, info, onPropertyClick])

  return (
    <g style={{ cursor: isClickable ? 'pointer' : 'default' }} onClick={handleClick}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        rx={3}
        ry={3}
        opacity={0.9}
      />
      <text
        x={isProperty ? x + width + 8 : x - 8}
        y={y + height / 2}
        textAnchor={isProperty ? 'start' : 'end'}
        dominantBaseline="central"
        className="fill-foreground"
        fontSize={12}
        fontWeight={400}
      >
        {payload?.name || ''}
      </text>
    </g>
  )
})

const LINK_TRANSITION = { transition: 'stroke-opacity 0.2s ease' } as const

const SankeyLinkRenderer = memo<LinkProps & { activeIndex: number | null; linkIndex: number }>(({
  sourceX, targetX, sourceY, targetY,
  sourceControlX, targetControlX,
  linkWidth, payload, activeIndex, linkIndex
}) => {
  const sourceColor = (payload?.source as unknown as { color?: string })?.color || '#6b7280'
  const isActive = activeIndex === null || activeIndex === linkIndex

  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={sourceColor}
      strokeWidth={linkWidth}
      strokeOpacity={isActive ? 0.4 : 0.08}
      style={LINK_TRANSITION}
    />
  )
})

const FlowTooltip = memo<{
  activeLinkIndex: number | null
  linkMeta: LinkMeta[]
}>(({ activeLinkIndex, linkMeta }) => {
  if (activeLinkIndex === null || activeLinkIndex >= linkMeta.length) return null
  const meta = linkMeta[activeLinkIndex]

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border min-w-[220px]">
      <p className="font-semibold text-sm mb-2">{meta.propertyName}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Revenue via {meta.platformName}:</span>
          <span className="font-medium">{formatCurrency(meta.revenue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Bookings:</span>
          <span className="font-medium">{meta.bookings}</span>
        </div>
        <div className="pt-1 mt-1 border-t border-border space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Of {meta.platformName} total:</span>
            <span className="font-medium">{formatPercentage(meta.pctOfPlatform, 1)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Of property total:</span>
            <span className="font-medium">{formatPercentage(meta.pctOfProperty, 1)}</span>
          </div>
        </div>
      </div>
    </div>
  )
})

export const PlatformPropertySankey: React.FC<PlatformPropertySankeyProps> = ({ data, onPropertyClick }) => {
  const [activeLink, setActiveLink] = useState<number | null>(null)

  const { sankeyData, nodeColors, nodeMap, linkMeta } = useMemo(() => buildSankeyData(data), [data])

  const coloredNodes = useMemo(
    () => sankeyData.nodes.map((n, i) => ({ ...n, color: nodeColors[i] })),
    [sankeyData.nodes, nodeColors]
  )

  const sankeyInput = useMemo(
    () => ({ nodes: coloredNodes, links: sankeyData.links }),
    [coloredNodes, sankeyData.links]
  )

  const handleMouseEnter = useCallback((_item: NodeProps | LinkProps, type: string, _e: React.MouseEvent) => {
    if (type === 'link') {
      setActiveLink((_item as LinkProps).index)
    }
  }, [])

  const handleMouseLeave = useCallback(() => setActiveLink(null), [])

  const renderNode = useCallback(
    (props: NodeProps) => (
      <SankeyNodeRenderer
        {...props}
        nodeColors={nodeColors}
        nodeMap={nodeMap}
        onPropertyClick={onPropertyClick}
      />
    ),
    [nodeColors, nodeMap, onPropertyClick]
  )

  const renderLink = useCallback(
    (props: LinkProps) => <SankeyLinkRenderer {...props} activeIndex={activeLink} linkIndex={props.index} />,
    [activeLink]
  )

  if (sankeyData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <EmptyQuadrants className="w-12 h-12 mb-2" />
        <p className="text-sm font-medium">No platform distribution data</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Data will appear once bookings are synced</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Sankey
        data={sankeyInput}
        nodeWidth={14}
        nodePadding={14}
        linkCurvature={0.5}
        iterations={64}
        margin={{ top: 10, right: 160, bottom: 10, left: 120 }}
        node={renderNode}
        link={renderLink}
        onMouseEnter={handleMouseEnter as never}
        onMouseLeave={handleMouseLeave as never}
      >
        <Tooltip
          content={<FlowTooltip activeLinkIndex={activeLink} linkMeta={linkMeta} />}
          isAnimationActive={false}
        />
      </Sankey>
    </ResponsiveContainer>
  )
}
