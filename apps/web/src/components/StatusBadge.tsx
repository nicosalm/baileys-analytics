import React from 'react'
import { Badge } from '@/components/ui/badge'
import { STATUS_STYLES } from '@/lib/theme'

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const styles = STATUS_STYLES[status as keyof typeof STATUS_STYLES] || STATUS_STYLES.default
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <Badge variant="secondary" className={`${sizeClasses} ${styles.bg} ${styles.text}`}>
      {status}
    </Badge>
  )
}
