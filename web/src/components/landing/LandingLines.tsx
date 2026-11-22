import { useLayoutEffect, useRef, useState } from 'react'

type Point = [number, number]
type Box = { x: number; y: number; w: number; h: number }

const COLORS = ['var(--metric-revenue)', 'var(--metric-occupancy)', 'var(--metric-bookings)']
const SPACING = 14
const STEP = 6
// text farther than this from the curve can't touch the lines, so it gets no hole in the mask
const REACH = 80
const TOP_FADE = 240

function offsetPath(points: Point[], distance: number): string {
  return points
    .map(([x, y], i) => {
      const [ax, ay] = points[Math.max(i - 1, 0)]
      const [bx, by] = points[Math.min(i + 1, points.length - 1)]
      const length = Math.hypot(bx - ax, by - ay) || 1
      const px = x - ((by - ay) / length) * distance
      const py = y + ((bx - ax) / length) * distance
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`
    })
    .join(' ')
}

// x as a function of y: one sine wave sized to the page, so the lines swing back and forth about 1.4 times
// with curvature everywhere and no flat runs
const SWINGS = 1.42
const AMPLITUDE = 0.47
const PHASE = 0.62 * Math.PI

function route(width: number, height: number): Point[] {
  const wavelength = height / SWINGS
  const points: Point[] = []
  for (let y = -200; y <= height + 200; y += STEP) {
    points.push([width / 2 + AMPLITUDE * width * Math.sin((2 * Math.PI * y) / wavelength + PHASE), y])
  }
  return points
}

const boxOf = (r: DOMRect, origin: DOMRect): Box => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height })

const nearRoute = (b: Box, points: Point[]) =>
  points.some(([x, y]) => y > b.y - REACH && y < b.y + b.h + REACH && x > b.x - REACH && x < b.x + b.w + REACH)

// text near the curve gets a soft hole in the mask so the lines fade out underneath it
function textBoxes(root: HTMLElement, origin: DOMRect, points: Point[]): Box[] {
  const boxes: Box[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue
    range.selectNodeContents(node)
    for (const r of range.getClientRects()) {
      if (r.width && r.height) boxes.push(boxOf(r, origin))
    }
  }
  for (const el of root.querySelectorAll('a, button')) {
    const r = el.getBoundingClientRect()
    if (r.width && r.height) boxes.push(boxOf(r, origin))
  }
  return boxes.filter((b) => nearRoute(b, points))
}

interface Layout {
  width: number
  height: number
  route: Point[]
  holes: Box[]
}

export function LandingLines() {
  const ref = useRef<SVGSVGElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)

  useLayoutEffect(() => {
    const root = ref.current?.parentElement
    if (!root) return
    let frame = 0
    const measure = () => {
      if (!ref.current || getComputedStyle(ref.current).display === 'none') return
      const origin = root.getBoundingClientRect()
      const points = route(origin.width, origin.height)
      setLayout({ width: origin.width, height: origin.height, route: points, holes: textBoxes(root, origin, points) })
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    // text can move without the page changing size: the serif font swapping in, the hero fading up,
    // or the tour caption changing, so those also trigger a measure
    const resizes = new ResizeObserver(schedule)
    resizes.observe(root)
    const edits = new MutationObserver(schedule)
    edits.observe(root, { childList: true, characterData: true, subtree: true })
    document.fonts.ready.then(schedule)
    const entrances = document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity)
    Promise.allSettled(entrances.map((a) => a.finished)).then(schedule)
    return () => {
      resizes.disconnect()
      edits.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <svg
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none z-[1] hidden md:block opacity-50 dark:opacity-60"
      viewBox={layout ? `0 0 ${layout.width} ${layout.height}` : undefined}
      aria-hidden
    >
      {layout && (
        <>
          <defs>
            <linearGradient id="landing-lines-top" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={TOP_FADE}>
              <stop offset="0" stopColor="#000" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </linearGradient>
            <filter id="landing-lines-soften" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <mask id="landing-lines-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={layout.width} height={layout.height}>
              <rect width={layout.width} height={layout.height} fill="#fff" />
              <rect width={layout.width} height={TOP_FADE} fill="url(#landing-lines-top)" />
              <g fill="#000" filter="url(#landing-lines-soften)">
                {layout.holes.map((b, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the holes are rebuilt together on every measure
                  <rect key={i} x={b.x - 14} y={b.y - 14} width={b.w + 28} height={b.h + 28} rx="24" />
                ))}
              </g>
            </mask>
          </defs>
          <g mask="url(#landing-lines-mask)" fill="none" strokeWidth={1.5} strokeLinecap="round">
            {COLORS.map((color, i) => (
              <path key={color} d={offsetPath(layout.route, (i - 1) * SPACING)} stroke={color} />
            ))}
          </g>
        </>
      )}
    </svg>
  )
}
