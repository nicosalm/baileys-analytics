// shared by every data table so headers, rows, and density match across the app
export const tableStyles = {
  card: 'bg-card rounded-lg border border-border shadow-sm overflow-hidden',
  toolbar: 'flex items-center justify-between gap-3 px-4 py-3 border-b border-border',
  table: 'min-w-full text-sm',
  headRow: 'border-b border-border',
  th: 'px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap',
  sortable: 'cursor-pointer select-none hover:text-foreground',
  row: 'border-b border-border/60 last:border-0 transition-colors',
  rowInteractive: 'cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 outline-none',
  td: 'px-4 py-2.5 text-foreground',
  index: 'px-4 py-2.5 w-12 text-xs text-muted-foreground tabular-nums',
} as const
