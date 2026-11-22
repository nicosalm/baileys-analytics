import type React from 'react'
import { useMemo, useState, useCallback, memo } from 'react'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'
import type { SankeyNodeProps as NodeProps, SankeyLinkProps as LinkProps, SankeyData } from 'recharts'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import { getPlatformColor, resolveToken, METRIC_COLORS } from '@/lib/theme'
import { EmptyMark } from '@/components/EmptyMark'

interface PlatformEntry {
  platform: string
  grossRevenue: number
}

interface RevenueFlowData {
  platforms: PlatformEntry[]
  hostFees: number
  guestFees: number
  taxes: number
  operatingExpenses: { total: number; byCategory: Record<string, number> }
  grossRevenue: number
  netRevenue: number
  operatingProfit: number
}

interface RevenueFlowSankeyProps {
  data: RevenueFlowData
}

interface LinkMeta {
  title: string
  value: number
  pctOfGross: number
  flowType: 'inflow' | 'deduction' | 'profit'
}

const categoryLabel = (cat: string) => cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// resolve semantic colors at render time so they track light/dark mode
function getSemanticColors() {
  return {
    warning: resolveToken('--warning'), // platform fees
    info: resolveToken('--info'), // taxes
    danger: resolveToken('--danger'), // operating expenses
    success: resolveToken('--success'), // profit / net revenue
  }
}

function buildSankeyData(data: RevenueFlowData): {
  sankeyData: SankeyData
  nodeColors: string[]
  linkMeta: LinkMeta[]
} {
  const nodes: { name: string }[] = []
  const links: { source: number; target: number; value: number }[] = []
  const linkMeta: LinkMeta[] = []
  const nodeColors: string[] = []
  const gross = data.grossRevenue
  const colors = getSemanticColors()

  const platforms = data.platforms.filter((p) => p.grossRevenue > 0)
  if (platforms.length === 0) return { sankeyData: { nodes: [], links: [] }, nodeColors: [], linkMeta: [] }

  // column 1: platforms
  platforms.forEach((p, i) => {
    nodes.push({ name: p.platform || 'Unassigned' })
    nodeColors.push(getPlatformColor(p.platform, i))
  })

  // column 2: gross revenue
  const grossIdx = nodes.length
  nodes.push({ name: 'Gross Revenue' })
  nodeColors.push(METRIC_COLORS.revenue)

  // platform → gross revenue
  platforms.forEach((p, i) => {
    links.push({ source: i, target: grossIdx, value: Math.max(p.grossRevenue, 1) })
    linkMeta.push({
      title: p.platform || 'Unassigned',
      value: p.grossRevenue,
      pctOfGross: gross > 0 ? (p.grossRevenue / gross) * 100 : 0,
      flowType: 'inflow',
    })
  })

  // column 3: deductions + profit
  if (data.hostFees > 0) {
    const idx = nodes.length
    nodes.push({ name: 'Host Fees' })
    nodeColors.push(colors.warning)
    links.push({ source: grossIdx, target: idx, value: Math.max(data.hostFees, 1) })
    linkMeta.push({
      title: 'Host Fees',
      value: data.hostFees,
      pctOfGross: gross > 0 ? (data.hostFees / gross) * 100 : 0,
      flowType: 'deduction',
    })
  }

  if (data.taxes > 0) {
    const idx = nodes.length
    nodes.push({ name: 'Taxes' })
    nodeColors.push(colors.info)
    links.push({ source: grossIdx, target: idx, value: Math.max(data.taxes, 1) })
    linkMeta.push({
      title: 'Taxes',
      value: data.taxes,
      pctOfGross: gross > 0 ? (data.taxes / gross) * 100 : 0,
      flowType: 'deduction',
    })
  }

  // operating expense categories — all use danger (red)
  const opexCategories = Object.entries(data.operatingExpenses.byCategory)
    .filter(([, amount]) => (amount as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))

  if (opexCategories.length > 0) {
    opexCategories.forEach(([cat, amount]) => {
      const idx = nodes.length
      nodes.push({ name: categoryLabel(cat) })
      nodeColors.push(colors.danger)
      links.push({ source: grossIdx, target: idx, value: Math.max(amount as number, 1) })
      linkMeta.push({
        title: categoryLabel(cat),
        value: amount as number,
        pctOfGross: gross > 0 ? ((amount as number) / gross) * 100 : 0,
        flowType: 'deduction',
      })
    })
  } else if (data.operatingExpenses.total > 0) {
    const idx = nodes.length
    nodes.push({ name: 'Operating Expenses' })
    nodeColors.push(colors.danger)
    links.push({ source: grossIdx, target: idx, value: Math.max(data.operatingExpenses.total, 1) })
    linkMeta.push({
      title: 'Operating Expenses',
      value: data.operatingExpenses.total,
      pctOfGross: gross > 0 ? (data.operatingExpenses.total / gross) * 100 : 0,
      flowType: 'deduction',
    })
  }

  // profit node
  const profit = data.operatingExpenses.total > 0 ? data.operatingProfit : data.netRevenue
  const profitLabel = data.operatingExpenses.total > 0 ? 'Operating Profit' : 'Net Revenue'

  if (profit > 0) {
    const profitIdx = nodes.length
    nodes.push({ name: profitLabel })
    nodeColors.push(colors.success)
    links.push({ source: grossIdx, target: profitIdx, value: profit })
    linkMeta.push({
      title: profitLabel,
      value: profit,
      pctOfGross: gross > 0 ? (profit / gross) * 100 : 0,
      flowType: 'profit',
    })
  }

  return { sankeyData: { nodes, links }, nodeColors, linkMeta }
}

const SankeyNodeRenderer = memo<NodeProps & { nodeColors: string[] }>(({ x, y, width, height, index, payload, nodeColors }) => {
  const color = nodeColors[index] || '#6b7280'
  const name = payload?.name || ''
  const isLeftColumn = x < 100
  const isRightColumn = !isLeftColumn && index !== undefined && payload?.depth === 2

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={3} ry={3} opacity={0.9} />
      <text
        x={isRightColumn ? x + width + 8 : isLeftColumn ? x - 8 : x + width / 2}
        y={y + height / 2}
        textAnchor={isRightColumn ? 'start' : isLeftColumn ? 'end' : 'middle'}
        dominantBaseline="central"
        className="fill-foreground"
        fontSize={12}
        fontWeight={name === 'Gross Revenue' ? 600 : 400}
      >
        {name}
      </text>
    </g>
  )
})

const LINK_TRANSITION = { transition: 'stroke-opacity 0.2s ease' } as const

const SankeyLinkRenderer = memo<LinkProps & { activeIndex: number | null; linkIndex: number }>(
  ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, activeIndex, linkIndex }) => {
    const sourceColor = (payload?.source as unknown as { color?: string })?.color || '#6b7280'
    const isActive = activeIndex === null || activeIndex === linkIndex

    return (
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={sourceColor}
        strokeWidth={linkWidth}
        strokeOpacity={isActive ? 0.35 : 0.08}
        style={LINK_TRANSITION}
      />
    )
  },
)

const FlowTooltip = memo<{
  activeLinkIndex: number | null
  linkMeta: LinkMeta[]
}>(({ activeLinkIndex, linkMeta }) => {
  if (activeLinkIndex === null || activeLinkIndex >= linkMeta.length) return null
  const meta = linkMeta[activeLinkIndex]

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border min-w-[200px]">
      <p className="font-semibold text-sm mb-2">{meta.title}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{meta.flowType === 'inflow' ? 'Platform Revenue:' : 'Amount:'}</span>
          <span
            className={`font-medium ${meta.flowType === 'profit' ? 'text-success' : meta.flowType === 'deduction' ? 'text-warning' : ''}`}
          >
            {meta.flowType === 'deduction' ? '-' : ''}
            {formatCurrency(meta.value)}
          </span>
        </div>
        <div className="pt-1 mt-1 border-t border-border flex justify-between gap-4">
          <span className="text-muted-foreground">{meta.flowType === 'inflow' ? 'Share of Gross:' : 'Of Gross Revenue:'}</span>
          <span className="font-medium">{formatPercentage(meta.pctOfGross, 1)}</span>
        </div>
      </div>
    </div>
  )
})

export const RevenueFlowSankey: React.FC<RevenueFlowSankeyProps> = ({ data }) => {
  const [activeLink, setActiveLink] = useState<number | null>(null)

  const { sankeyData, nodeColors, linkMeta } = useMemo(() => buildSankeyData(data), [data])

  const coloredNodes = useMemo(() => sankeyData.nodes.map((n, i) => ({ ...n, color: nodeColors[i] })), [sankeyData.nodes, nodeColors])

  const sankeyInput = useMemo(() => ({ nodes: coloredNodes, links: sankeyData.links }), [coloredNodes, sankeyData.links])

  const handleMouseEnter = useCallback((_item: NodeProps | LinkProps, type: string, _e: React.MouseEvent) => {
    if (type === 'link') {
      setActiveLink((_item as LinkProps).index)
    }
  }, [])

  const handleMouseLeave = useCallback(() => setActiveLink(null), [])

  const renderNode = useCallback((props: NodeProps) => <SankeyNodeRenderer {...props} nodeColors={nodeColors} />, [nodeColors])

  const renderLink = useCallback(
    (props: LinkProps) => <SankeyLinkRenderer {...props} activeIndex={activeLink} linkIndex={props.index} />,
    [activeLink],
  )

  if (sankeyData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <EmptyMark className="w-12 h-12 mb-2" />
        <p className="text-sm font-medium">No revenue flow data</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Sankey
        data={sankeyInput}
        nodeWidth={14}
        nodePadding={16}
        linkCurvature={0.5}
        iterations={64}
        margin={{ top: 10, right: 140, bottom: 10, left: 120 }}
        node={renderNode}
        link={renderLink}
        onMouseEnter={handleMouseEnter as never}
        onMouseLeave={handleMouseLeave as never}
      >
        <Tooltip content={<FlowTooltip activeLinkIndex={activeLink} linkMeta={linkMeta} />} isAnimationActive={false} />
      </Sankey>
    </ResponsiveContainer>
  )
}

export const RevenueFlowLegend: React.FC<{ hasOpex: boolean }> = ({ hasOpex }) => {
  const colors = useMemo(() => getSemanticColors(), [])

  return (
    <div className="flex flex-wrap gap-3 justify-center text-xs mt-3 px-4">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 rounded-sm" style={{ background: colors.warning }} />
        <span className="text-muted-foreground">Host Fees</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 rounded-sm" style={{ background: colors.info }} />
        <span className="text-muted-foreground">Taxes</span>
      </div>
      {hasOpex && (
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded-sm" style={{ background: colors.danger }} />
          <span className="text-muted-foreground">Operating Expenses</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 rounded-sm" style={{ background: colors.success }} />
        <span className="text-muted-foreground">{hasOpex ? 'Operating Profit' : 'Net Revenue'}</span>
      </div>
    </div>
  )
}
