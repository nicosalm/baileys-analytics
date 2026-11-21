import { Badge } from '@/components/ui/badge'

const VARIANTS: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  confirmed: 'success',
  active: 'success',
  cancelled: 'danger',
  canceled: 'danger',
  pending: 'warning',
}

export function StatusBadge({ status }: { status: string; size?: 'sm' | 'md' }) {
  return (
    <Badge variant={VARIANTS[status] ?? 'neutral'} className="capitalize">
      {status}
    </Badge>
  )
}
