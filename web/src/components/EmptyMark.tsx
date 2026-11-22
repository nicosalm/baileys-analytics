import { LogoShapes, useClipId } from '@/components/Logo'

export const EmptyMark = ({ className = 'w-12 h-12' }: { className?: string }) => {
  const clipId = useClipId()
  return (
    <svg className={className} viewBox="0 0 64 64" opacity={0.3} aria-hidden>
      <LogoShapes clipId={clipId} />
    </svg>
  )
}
