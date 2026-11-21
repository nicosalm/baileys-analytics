import { cn } from '@/lib/utils'

const OWNERREZ_URL = 'https://www.ownerrez.com/'

// the OwnerRez wordmark, linked to their site in a new tab so nobody loses their place in Baileys
export const OwnerRezLogo = ({ imgClassName, className }: { imgClassName?: string; className?: string }) => (
  <a
    href={OWNERREZ_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="OwnerRez website (opens in a new tab)"
    className={cn('group inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}
  >
    <picture>
      <source srcSet="/logos/ownerrez-wide.avif" type="image/avif" />
      <img src="/logos/ownerrez-wide.png" alt="OwnerRez" className={cn('w-auto transition-opacity', imgClassName)} />
    </picture>
  </a>
)
