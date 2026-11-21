// popover menus share the dropdown menu item metrics so every menu reads the same
export const menuStyles = {
  item: 'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent [&_svg]:shrink-0',
  label: 'px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground',
  separator: '-mx-1 my-1 h-px bg-border',
} as const
