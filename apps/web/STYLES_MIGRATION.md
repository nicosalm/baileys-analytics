# Styles Migration: Token-Driven Theming

## Status: Phase 4 Complete ✓

All components and pages have been migrated to the token system. No hardcoded `bg-gray-*`, `text-gray-*`, `bg-blue-*`, etc. remain in any component or page file.

### Mapping cheatsheet for remaining work

```
page/header bg-white/80     → bg-background/80
min-h-screen bg-gray-50     → bg-background (page root)
bg-white (card)             → bg-card
shadow-sm border border-gray-200 → shadow-sm border
text-gray-900               → text-foreground
text-gray-700               → text-foreground
text-gray-600               → text-muted-foreground
text-gray-500               → text-muted-foreground
text-gray-400               → text-muted-foreground
text-gray-300               → text-muted-foreground/50
border-b border-gray-200    → border-b
hover:bg-gray-50            → hover:bg-muted/40
hover:bg-gray-100           → hover:bg-muted
hover:text-gray-900         → hover:text-foreground
bg-blue-600 text-white      → bg-primary text-primary-foreground
text-blue-600 (link)        → text-primary
bg-green-50 (icon wrapper)  → bg-success-subtle
text-green-600              → text-success
bg-red-50 (icon wrapper)    → bg-danger-subtle
text-red-600                → text-danger
bg-green-100 text-green-700 → bg-success-subtle text-success-fg
bg-blue-100 text-blue-800   → bg-info-subtle text-info-fg
bg-gray-100 px-1 (code)     → bg-muted px-1
```

---

## Next: Dark Mode Selector

The token system is ready. These are the remaining steps to ship a working dark mode toggle in settings.

### 1. Theme provider

Create `src/contexts/theme.tsx` that manages `'light' | 'dark' | 'system'` preference:

- Reads initial value from `localStorage` key `'theme'` (fall back to `'system'`)
- Applies/removes `.dark` on `document.documentElement` — this is what triggers all CSS variable overrides
- Listens to `window.matchMedia('(prefers-color-scheme: dark)')` for system mode
- Exposes `{ theme, setTheme }` via context

Wrap the app root in `<ThemeProvider>` in `App.tsx`.

### 2. FOUC prevention

Add an inline script to `index.html` **before** any other scripts. It must run synchronously so the `.dark` class is on the document before React hydrates:

```html
<script>
  const t = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (t === 'dark' || (!t || t === 'system') && prefersDark) {
    document.documentElement.classList.add('dark')
  }
</script>
```

Without this, users with a saved dark preference will see a flash of light mode on every page load.

### 3. Settings UI

Add an appearance section to the settings page with a 3-way toggle: **Light / System / Dark**. Use the existing `Button` or a `ToggleGroup` component. Call `setTheme()` from the context on selection.

### 4. Fix `resolveToken` inside `useMemo`

`getChartColor()` calls `resolveToken` which reads a CSS variable at call time. Any `useMemo` that captures those values will return stale colors after a theme switch unless the theme is included in the dep array.

**Affected:** `revenueChartData` in `OverviewDashboard.tsx` (line ~323) — `Array.from({ length: 10 }, (_, i) => getChartColor(i))` is computed inside the memo with no theme dep.

**Fix:** consume `theme` from `useTheme()` inside the component and add it to the memo's dep array. The memo will then re-run whenever the theme changes and emit correct resolved colors.

This same pattern applies to any future memo that calls `resolveToken`, `METRIC_COLORS.*`, `CHART_INFRA.*`, or `GAUGE_COLORS.*` — all of those are live getters, and memoizing their output requires theme as a dep.

### 5. Visual audit

The `.dark` OKLCH values in `index.css` were computed analytically and are untested in a browser. Do a pass through each dashboard in dark mode and adjust any token that reads as too dim, too saturated, or low-contrast. Priority areas:

- Occupancy heatmap (`--occ-*`) — the 5-level scale needs to be clearly distinguishable on dark backgrounds
- Semantic status badges (`--success-subtle`, `--danger-subtle`, etc.) — subtle backgrounds must read as tinted, not near-black
- Chart lines (`--metric-*`, `--chart-series-*`) — verify adequate contrast against the dark chart background

---

## Philosophy

This migration follows two principles:

**shadcn/ui theming**: All configurable colors live as CSS variables in `index.css`. Light/dark mode is a variable override only. Components express intent (`bg-primary`, `text-muted-foreground`), not implementation (`bg-blue-600`, `text-gray-500`).

**Adam Wathan's utility-first principle**: We are NOT creating semantic CSS component classes (`.success-badge`, `.metric-card--revenue`). That pattern makes CSS depend on HTML structure and isn't reusable. Instead: CSS variables define the constrained set of available values, Tailwind wires those into utility classes, and components compose those utilities. The HTML depends on the CSS abstraction, not the reverse. Extract to components only when the same utility combination recurs.

---

## Current State

This project runs **Tailwind v4** (`@import 'tailwindcss'`) with shadcn/ui. The CSS variable token system is already partially in place — `index.css` defines a full `@theme inline` block with OKLCH tokens for all shadcn primitives (`--background`, `--foreground`, `--primary`, `--muted`, `--destructive`, `--chart-1` through `--chart-5`, etc.) with `.dark` overrides.

The **gap**: domain-specific colors (metrics, occupancy scales, severity levels, chart infrastructure) live outside that system, as either raw hex strings in `lib/theme.ts` or Tailwind palette utilities scattered across components.

---

## What's Already Good

- `index.css` has complete `@theme inline` + `:root` / `.dark` block (shadcn pattern, OKLCH)
- `lib/theme.ts` centralizes all colors in one file — good abstraction boundary
- No `bg-[#...]` arbitrary syntax anywhere
- No scattered `dark:` color overrides to clean up
- Layout, spacing, typography, radius, and shadows are entirely untouched by color concerns

---

## What Needs Work

### 1. `lib/theme.ts` — Hex values not connected to CSS variables

`CHART_COLORS`, `METRIC_COLORS`, and `PLATFORM_COLORS` hold raw hex strings. The constraint: Recharts `fill=` and `stroke=` props require actual color strings, not CSS classes. Solution: define CSS custom properties for each, and add a `resolveToken(varName)` helper that calls `getComputedStyle(document.documentElement).getPropertyValue(varName)` at runtime.

`getOccupancyColor()` and `getOccupancyBgColor()` return hardcoded Tailwind palette class strings (`text-green-600`, `bg-red-600`). These should return semantic token utility classes.

### 2. `TAG_TYPE_STYLES` and `STATUS_STYLES` — Palette-coupled utility strings

These return classes like `bg-green-100 text-green-800`. They need to reference semantic token utilities (`bg-success-subtle text-success-fg`) that map to CSS variables.

### 3. Scattered palette utilities in components

These components contain Tailwind palette references not routed through `theme.ts`:

| Component | Pattern | Approx. instances |
|---|---|---|
| `MetricCard.tsx` | `bg-blue-50 text-blue-600` × 7 variants + 4-step progress bar colors | ~20 |
| `OccupancyHeatmap.tsx` | 6-step occupancy scale: `bg-gray-50 → bg-red-50 → bg-amber-50 → bg-emerald-50/100/200` | ~24 |
| `OccupancyListView.tsx` | Gap severity colors + `text-green/yellow/red-600` for rate display | ~12 |
| `BookingGapAlert.tsx` | Severity tiers red/yellow/blue with `-50` bg and `-200` border | ~12 |
| `SeasonIndicator.tsx` | Active: `bg-green-50 text-green-600`, out-of-season: `bg-amber-50 text-amber-600` | ~8 |
| `InlineDateRangePicker.tsx` | Selection states: `bg-blue-500`, `bg-blue-100`, `bg-gray-50`, `bg-gray-100` | ~8 |
| `WhatIfCalculator.tsx` | `bg-green-100 text-green-700`, `bg-red-100 text-red-700` | ~4 |
| `PasswordRequirements.tsx` | 5-step strength scale: red/orange/yellow/blue/green | ~8 |

### 4. Hardcoded hex in Recharts props

| Component | Values |
|---|---|
| `RevenueChart.tsx` | `stroke="#94a3b8"` (prev revenue), `stroke="#6366f1"` (goal line) |
| `OccupancyDashboard.tsx` | `stroke="#6366f1"`, `stroke="#94a3b8"` |
| `OverviewDashboard.tsx` | `stroke="#E5E7EB"` (grid), `stroke="#6B7280"` (axes) |
| `PropertyPerformanceScatter.tsx` | `stroke="#E5E7EB"`, `stroke="#9CA3AF"` (reference lines) |
| `GaugeChart.tsx` | Needle/pin hex values: `#6B7280`, `#9CA3AF` |
| `SimpleGaugeChart.tsx` | Gauge segment colors: `#FCA5A5`, `#FCD34D`, `#86EFAC`; needle: `#6B7280` |

---

## Migration Plan

### Phase 0 — Extend `index.css` with domain tokens

Add new groups to the existing `@theme inline` block and `:root` / `.dark` definitions. Tailwind v4 makes any `--color-*` variable defined in `@theme` available as a utility class automatically — e.g. `--color-success` becomes `bg-success`, `text-success`, etc.

**New token groups** (add to `@theme inline` and `:root`):

```css
/* Semantic status — for alert/badge/indicator surfaces */
--color-success: oklch(0.696 0.17 162.48);
--color-success-subtle: oklch(0.953 0.052 163.0);
--color-success-fg: oklch(0.361 0.118 163.0);

--color-warning: oklch(0.769 0.188 70.08);
--color-warning-subtle: oklch(0.965 0.051 89.0);
--color-warning-fg: oklch(0.477 0.135 65.0);

--color-danger: oklch(0.628 0.245 27.3);
--color-danger-subtle: oklch(0.963 0.063 17.0);
--color-danger-fg: oklch(0.444 0.177 26.0);

--color-info: oklch(0.623 0.214 259.8);
--color-info-subtle: oklch(0.956 0.045 257.0);
--color-info-fg: oklch(0.452 0.16 264.0);

/* Metric category colors — for icon backgrounds and legend accents */
--color-metric-revenue: oklch(0.623 0.214 259.8);
--color-metric-occupancy: oklch(0.696 0.17 162.48);
--color-metric-bookings: oklch(0.769 0.188 70.08);
--color-metric-expenses: oklch(0.606 0.25 292.7);
--color-metric-profit: oklch(0.704 0.14 195.0);
--color-metric-tax: oklch(0.628 0.245 27.3);

/* Chart infrastructure — axes, grid lines, reference lines, goal lines */
--color-chart-grid: oklch(0.922 0 0);
--color-chart-axis: oklch(0.556 0 0);
--color-chart-reference: oklch(0.708 0 0);
--color-chart-goal: oklch(0.585 0.233 277.1);
--color-chart-comparison: oklch(0.704 0.04 264.0);

/* Occupancy scale — 6 levels, empty → excellent */
--color-occupancy-empty: oklch(0.985 0 0);
--color-occupancy-low: oklch(0.963 0.063 17.0);
--color-occupancy-fair: oklch(0.965 0.051 89.0);
--color-occupancy-good: oklch(0.953 0.052 163.0);
--color-occupancy-great: oklch(0.905 0.093 163.0);
--color-occupancy-excellent: oklch(0.845 0.143 163.0);
```

Add `.dark` overrides for each new group. The key benefit: all colors are now in one place and swappable without touching components.

### Phase 1 — Update `lib/theme.ts`

1. Replace hex values in `METRIC_COLORS` with CSS variable references for contexts that accept them: `{ revenue: 'var(--color-metric-revenue)', ... }`. For Recharts, add:

```ts
export const resolveToken = (varName: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
```

Then chart components call `resolveToken('--color-chart-goal')` instead of `"#6366f1"`.

2. Replace `getOccupancyColor()` / `getOccupancyBgColor()` to return semantic token classes:

```ts
// before: 'text-green-600'
// after:  'text-success'
```

3. Update `TAG_TYPE_STYLES` and `STATUS_STYLES` to use token utilities:

```ts
// before
payment: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', hover: 'hover:bg-green-200' }

// after
payment: { bg: 'bg-success-subtle', text: 'text-success-fg', border: 'border-success', hover: 'hover:bg-success/80' }
```

### Phase 2 — Update components (pure color swaps, no logic changes)

**`MetricCard.tsx`**
- `colorClasses` map: `bg-blue-50 text-blue-600` → `bg-info-subtle text-info-fg`, `bg-green-50 text-green-600` → `bg-success-subtle text-success-fg`, etc.
- Target progress: `bg-green-500 / bg-blue-500 / bg-yellow-500 / bg-red-500` → `bg-success / bg-info / bg-warning / bg-danger`
- `bg-white border-gray-200` → `bg-card border-border`
- `text-gray-600 / text-gray-500 / text-gray-400` → `text-muted-foreground`

**`OccupancyHeatmap.tsx`** and **`OccupancyListView.tsx`**
- Replace occupancy scale classes with `bg-occupancy-empty`, `bg-occupancy-low`, etc.
- Replace `text-green/yellow/red-600` rate colors with `text-success`, `text-warning`, `text-danger`

**`BookingGapAlert.tsx`** and **`SeasonIndicator.tsx`**
- `bg-red-50 border-red-200 text-red-700` → `bg-danger-subtle border-danger text-danger-fg`
- `bg-yellow-50 / bg-amber-50` → `bg-warning-subtle ...`
- `bg-blue-50` → `bg-info-subtle ...`

**`InlineDateRangePicker.tsx`**
- `bg-blue-500 text-white` → `bg-primary text-primary-foreground`
- `bg-blue-100` → `bg-primary/20`
- `bg-gray-100 / bg-gray-50` → `bg-muted / bg-muted/50`

**`WhatIfCalculator.tsx`**
- Positive/negative impact: `bg-success-subtle text-success-fg`, `bg-danger-subtle text-danger-fg`

**`PasswordRequirements.tsx`**
- Strength scale: map 5 levels to a combination of `bg-danger → bg-warning → bg-info → bg-success` (no need for all 5 to be distinct — collapse orange into warning)

**Chart components** (`RevenueChart.tsx`, `OccupancyDashboard.tsx`, `OverviewDashboard.tsx`, `PropertyPerformanceScatter.tsx`, `GaugeChart.tsx`, `SimpleGaugeChart.tsx`)
- Replace inline hex strings with `resolveToken('--color-chart-grid')`, `resolveToken('--color-chart-goal')`, etc.
- Group any remaining magic hex values into named constants at the top of each file while the token approach is validated

### Phase 3 — Validate

- No Tailwind palette utilities remain in component files
- `theme.ts` holds zero raw hex strings except `PLATFORM_COLORS` (Airbnb/VRBO/Booking.com brand colors are legitimately fixed)
- Changing any color requires editing one line in `index.css` only
- No new CSS component classes were created — only new CSS variable tokens and their Tailwind utility wiring

---

## Tailwind v4 Note

No `tailwind.config.js` exists or should be created. In v4, theme extension is done via `@theme` blocks in CSS. The existing `@theme inline` block already wires shadcn tokens — extend it with domain tokens in the same pattern.

---

## Explicit Non-Goals

- Do not change layout, spacing, shadows, radius, or typography
- Do not add dark mode support proactively (values will be configurable once tokens exist; add `.dark` overrides as a separate pass)
- Do not restructure Recharts components — only replace hardcoded color values
- Do not rename exports in `theme.ts` — only change values, not the public shape
- `PLATFORM_COLORS` are brand-identity colors and stay as fixed hex
