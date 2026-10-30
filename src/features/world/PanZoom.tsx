import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

const MAX_ZOOM = 8
/** Wheel ticks past the zoom limit before moving to the next level. */
const OVERSHOOT_TICKS = 3

type View = { k: number; x: number; y: number }

/**
 * SVG viewport with wheel zoom, drag to pan, and "zoom past the edge" to change level.
 * Children receive the current zoom so labels can stay a constant size.
 */
export function PanZoom({
  width,
  height,
  background = '#1a1714',
  onZoomPast,
  svgRef,
  children,
}: {
  width: number
  height: number
  background?: string
  onZoomPast?: (dir: 'in' | 'out', x: number, y: number) => void
  svgRef?: React.RefObject<SVGSVGElement | null>
  children: (zoom: number) => ReactNode
}) {
  const ownRef = useRef<SVGSVGElement>(null)
  const ref = svgRef ?? ownRef
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const overshoot = useRef(0)
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const zoomPastRef = useRef(onZoomPast)
  zoomPastRef.current = onZoomPast

  function toSvg(clientX: number, clientY: number) {
    const svg = ref.current!
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    return pt.matrixTransform(svg.getScreenCTM()!.inverse())
  }

  function zoomAt(sx: number, sy: number, factor: number) {
    const v = viewRef.current
    const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor))
    let x = sx - ((sx - v.x) * k) / v.k
    let y = sy - ((sy - v.y) * k) / v.k
    if (k === 1) {
      x = 0
      y = 0
    }
    setView({ k, x, y })
  }

  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = toSvg(e.clientX, e.clientY)
      const v = viewRef.current
      const zoomingIn = e.deltaY < 0
      const atLimit = zoomingIn ? v.k >= MAX_ZOOM : v.k <= 1
      if (atLimit && zoomPastRef.current) {
        overshoot.current += 1
        if (overshoot.current >= OVERSHOOT_TICKS) {
          overshoot.current = 0
          zoomPastRef.current(zoomingIn ? 'in' : 'out', (p.x - v.x) / v.k, (p.y - v.y) / v.k)
        }
        return
      }
      overshoot.current = 0
      zoomAt(p.x, p.y, zoomingIn ? 1.25 : 0.8)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-edge" style={{ background }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          const p = toSvg(e.clientX, e.clientY)
          drag.current = { sx: p.x, sy: p.y, vx: view.x, vy: view.y, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || e.buttons === 0) return
          const p = toSvg(e.clientX, e.clientY)
          const dx = p.x - d.sx
          const dy = p.y - d.sy
          if (!d.moved && Math.hypot(dx, dy) < width / 150) return
          d.moved = true
          setView((v) => (v.k === 1 ? v : { ...v, x: d.vx + dx, y: d.vy + dy }))
        }}
        onPointerUp={() => {
          suppressClick.current = Boolean(drag.current?.moved)
          drag.current = null
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation()
            suppressClick.current = false
          }
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>{children(view.k)}</g>
      </svg>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {[
          { icon: ZoomIn, label: 'Zoom in', fn: () => zoomAt(width / 2, height / 2, 1.5) },
          { icon: ZoomOut, label: 'Zoom out', fn: () => zoomAt(width / 2, height / 2, 1 / 1.5) },
          { icon: Maximize, label: 'Reset view', fn: () => setView({ k: 1, x: 0, y: 0 }) },
        ].map(({ icon: Icon, label, fn }) => (
          <button key={label} type="button" onClick={fn} title={label} aria-label={label} className="rounded-md border border-edge bg-ink/80 p-1.5 text-parch hover:border-gold hover:text-gold">
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}
