const FILLS = ['#dbeafe', '#60a5fa', '#3b82f6', '#1e3a8a']

export const EmptyQuadrants = ({ className = 'w-12 h-12' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 1000 1000" aria-hidden>
    {FILLS.map((fill, i) => (
      <rect key={i} x={i % 2 === 1 ? 520 : 0} y={i >= 2 ? 520 : 0} width="480" height="480" rx="60" fill={fill} opacity={0.35} />
    ))}
  </svg>
)
