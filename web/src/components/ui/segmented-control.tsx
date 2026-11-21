import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SegmentedOption<T extends string | number> {
  value: T
  label: React.ReactNode
  icon?: LucideIcon
}

interface SegmentedControlProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  // names the control for assistive technology
  label: string
  size?: 'sm' | 'default'
  className?: string
}

// one-of-many toggle styled to match the shadcn TabsList, for filters and view switches inside cards
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = 'sm',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex w-fit items-center rounded-lg bg-muted p-[3px] max-w-full overflow-x-auto',
        size === 'sm' ? 'h-8' : 'h-9',
        className,
      )}
    >
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
        const active = optionValue === value
        return (
          <button
            key={String(optionValue)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(optionValue)}
            className={cn(
              'inline-flex h-full items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 font-medium transition-all cursor-pointer',
              size === 'sm' ? 'text-xs' : 'text-sm',
              active
                ? 'bg-background text-foreground shadow-sm dark:bg-input/30 dark:border-input'
                : 'text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground',
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" aria-hidden />}
            {optionLabel}
          </button>
        )
      })}
    </div>
  )
}
