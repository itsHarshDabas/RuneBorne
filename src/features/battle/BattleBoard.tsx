import { Hand, Maximize, Ruler, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { clamp } from '../../lib/util'
import type { Token, TokenSide } from '../../store/game'
import { TOKEN_ICONS } from './icons'

/** SVG units per grid cell. */
const S = 64
const SIDE_RING: Record<TokenSide, string> = { party: '#38bdf8', foe: '#ef4444', ally: '#34d399', neutral: '#d6d3d1' }

export type TokenView = Token & { hp?: number; maxHp?: number; conditions: string[]; active: boolean }
type View = { k: number; x: number; y: number }
type Tool = 'move' | 'measure'

/**
 * The battle grid: background image, grid lines, tokens with HP rings, a ruler, and smooth wheel zoom / drag to pan.
 * Token positions are in grid cells (the centre of the token).
 */
export function BattleBoard({
  image, painting, cols, rows, showGrid, snap, tokens, selectedId, onSelect, onMove,
}: {
  image: string
  painting: boolean
  cols: number
  rows: number
  showGrid: boolean
  snap: boolean
  tokens: TokenView[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
}) {
  const W = cols * S
  const H = rows * S
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [tool, setTool] = useState<Tool>('move')
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number } | null>(null)
  const [pan, setPan] = useState<{ sx: number; sy: number; vx: number; vy: number } | null>(null)
  const [ruler, setRuler] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
  const moved = useRef(false)
  // On-screen pixels per board unit, so labels can stay a readable size at any zoom
  const [boxW, setBoxW] = useState(0)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const ro = new ResizeObserver(() => setBoxW(svg.clientWidth))
    ro.observe(svg)
    return () => ro.disconnect()
  }, [])
  const unitPx = boxW ? (boxW / W) * view.k : 1

  /** Screen point → board units (before the zoom transform). */
  function toSvg(clientX: number, clientY: number) {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    return pt.matrixTransform(svg.getScreenCTM()!.inverse())
  }
  /** Screen point → grid cells. */
  function toCell(clientX: number, clientY: number) {
    const p = toSvg(clientX, clientY)
    const v = viewRef.current
    return { x: (p.x - v.x) / v.k / S, y: (p.y - v.y) / v.k / S }
  }

  function zoomAt(sx: number, sy: number, factor: number) {
    const v = viewRef.current
    const k = clamp(v.k * factor, 1, 6)
    let x = sx - ((sx - v.x) * k) / v.k
    let y = sy - ((sy - v.y) * k) / v.k
    // Keep the board filling the view
    x = clamp(x, W - W * k, 0)
    y = clamp(y, H - H * k, 0)
    setView({ k, x, y })
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = toSvg(e.clientX, e.clientY)
      // Smooth zoom that follows trackpads and mouse wheels alike
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H])

  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [cols, rows])

  function snapPos(t: { size: number }, x: number, y: number) {
    const half = t.size / 2
    if (!snap) return { x: clamp(x, half, cols - half), y: clamp(y, half, rows - half) }
    const tx = clamp(Math.round(x - half), 0, cols - t.size)
    const ty = clamp(Math.round(y - half), 0, rows - t.size)
    return { x: tx + half, y: ty + half }
  }

  function onBoardDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return
    svgRef.current?.setPointerCapture(e.pointerId)
    moved.current = false
    if (tool === 'measure' && e.button === 0) {
      const c = toCell(e.clientX, e.clientY)
      const a = { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5 }
      setRuler({ a, b: a })
      return
    }
    const p = toSvg(e.clientX, e.clientY)
    setPan({ sx: p.x, sy: p.y, vx: view.x, vy: view.y })
  }

  function onBoardMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (drag) {
      const c = toCell(e.clientX, e.clientY)
      moved.current = true
      setDrag({ ...drag, x: c.x - drag.dx, y: c.y - drag.dy })
    } else if (ruler && tool === 'measure' && e.buttons) {
      const c = toCell(e.clientX, e.clientY)
      setRuler({ ...ruler, b: { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5 } })
    } else if (pan && e.buttons) {
      const p = toSvg(e.clientX, e.clientY)
      const dx = p.x - pan.sx
      const dy = p.y - pan.sy
      if (Math.hypot(dx, dy) > 4) moved.current = true
      const v = viewRef.current
      setView({ k: v.k, x: clamp(pan.vx + dx, W - W * v.k, 0), y: clamp(pan.vy + dy, H - H * v.k, 0) })
    }
  }

  function onBoardUp() {
    if (drag) {
      const t = tokens.find((k) => k.id === drag.id)
      if (t && moved.current) {
        const p = snapPos(t, drag.x, drag.y)
        onMove(t.id, p.x, p.y)
      }
      setDrag(null)
    } else if (pan) {
      if (!moved.current) onSelect(null)
      setPan(null)
    }
  }

  const feet = ruler ? Math.max(Math.abs(ruler.b.x - ruler.a.x), Math.abs(ruler.b.y - ruler.a.y)) * 5 : 0
  const tools: { id: Tool; icon: LucideIcon; label: string }[] = [
    { id: 'move', icon: Hand, label: 'Move tokens / pan' },
    { id: 'measure', icon: Ruler, label: 'Measure distance' },
  ]

  return (
    <div className="relative overflow-hidden rounded-lg border border-edge bg-[#141210]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`block h-auto w-full touch-none select-none ${tool === 'measure' ? 'cursor-crosshair' : pan ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onBoardDown}
        onPointerMove={onBoardMove}
        onPointerUp={onBoardUp}
        onPointerCancel={onBoardUp}
      >
        <defs>
          <pattern id="bm-grid" width={S} height={S} patternUnits="userSpaceOnUse">
            <path d={`M ${S} 0 L 0 0 0 ${S}`} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={1.5} />
            <path d={`M ${S} 1 L 1 1 1 ${S}`} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={1} />
          </pattern>
          <filter id="bm-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="#000" floodOpacity=".65" />
          </filter>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`} style={{ transition: drag || pan ? undefined : 'transform 90ms ease-out' }}>
          <rect width={W} height={H} fill="#2b2620" />
          {image && <image href={image} width={W} height={H} preserveAspectRatio="none" />}
          {showGrid && <rect width={W} height={H} fill="url(#bm-grid)" pointerEvents="none" />}

          {tokens.map((t) => {
            const pos = drag?.id === t.id ? drag : t
            return (
              <TokenShape
                key={t.id}
                t={t}
                x={pos.x * S}
                y={pos.y * S}
                selected={t.id === selectedId}
                dragging={drag?.id === t.id}
                unitPx={unitPx}
                onDown={(e) => {
                  if (tool !== 'move') return
                  e.stopPropagation()
                  svgRef.current?.setPointerCapture(e.pointerId)
                  moved.current = false
                  const c = toCell(e.clientX, e.clientY)
                  onSelect(t.id)
                  setDrag({ id: t.id, x: t.x, y: t.y, dx: c.x - t.x, dy: c.y - t.y })
                }}
              />
            )
          })}

          {ruler && (feet > 0 || tool === 'measure') && (
            <g pointerEvents="none">
              <line x1={ruler.a.x * S} y1={ruler.a.y * S} x2={ruler.b.x * S} y2={ruler.b.y * S} stroke="#facc15" strokeWidth={4} strokeDasharray="10 8" strokeLinecap="round" />
              <circle cx={ruler.a.x * S} cy={ruler.a.y * S} r={7} fill="#facc15" />
              <circle cx={ruler.b.x * S} cy={ruler.b.y * S} r={7} fill="#facc15" />
              <g transform={`translate(${((ruler.a.x + ruler.b.x) / 2) * S} ${((ruler.a.y + ruler.b.y) / 2) * S}) scale(${Math.max(1, 1.2 / unitPx)}) translate(0 -26)`}>
                <rect x={-40} y={-18} width={80} height={32} rx={8} fill="rgba(15,13,11,.9)" stroke="#facc15" />
                <text textAnchor="middle" y={5} fill="#fde68a" fontSize={18} fontWeight={700}>{feet} ft</text>
              </g>
            </g>
          )}
        </g>
      </svg>

      {painting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/50 text-sm text-gold">Painting the map…</div>
      )}

      <div className="absolute left-2 top-2 flex gap-1">
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={tool === id}
            onClick={() => {
              setTool(id)
              setRuler(null)
            }}
            className={`rounded-md border p-1.5 ${tool === id ? 'border-gold bg-gold text-ink' : 'border-edge bg-ink/80 text-parch hover:border-gold hover:text-gold'}`}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {[
          { icon: ZoomIn, label: 'Zoom in', fn: () => zoomAt(W / 2, H / 2, 1.4) },
          { icon: ZoomOut, label: 'Zoom out', fn: () => zoomAt(W / 2, H / 2, 1 / 1.4) },
          { icon: Maximize, label: 'Fit map', fn: () => setView({ k: 1, x: 0, y: 0 }) },
        ].map(({ icon: Icon, label, fn }) => (
          <button key={label} type="button" onClick={fn} title={label} aria-label={label} className="rounded-md border border-edge bg-ink/80 p-1.5 text-parch hover:border-gold hover:text-gold">
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}

function TokenShape({ t, x, y, selected, dragging, unitPx, onDown }: { t: TokenView; x: number; y: number; selected: boolean; dragging: boolean; unitPx: number; onDown: (e: ReactPointerEvent<SVGGElement>) => void }) {
  // Names show when squares are big enough to fit them, or for the token that matters right now
  const showLabel = selected || dragging || t.active || unitPx * S * t.size >= 34
  const fs = Math.max(13, 12 / unitPx)
  const r = (t.size * S) / 2 - 6
  const dead = t.hp !== undefined && t.hp <= 0
  const ratio = t.hp !== undefined && t.maxHp ? clamp(t.hp / t.maxHp, 0, 1) : null
  const hpColour = ratio === null ? '' : ratio > 0.6 ? '#4ade80' : ratio > 0.3 ? '#facc15' : '#ef4444'
  const ringR = r + 4
  const circ = 2 * Math.PI * ringR
  const Icon = t.icon ? TOKEN_ICONS[t.icon] : undefined
  const iconSize = r * 1.1
  return (
    <g
      transform={`translate(${x} ${y})`}
      onPointerDown={onDown}
      style={{ cursor: dragging ? 'grabbing' : 'pointer', transition: dragging ? undefined : 'transform 120ms ease-out' }}
      opacity={dead ? 0.55 : 1}
    >
      {t.active && (
        <circle r={ringR + 7} fill="none" stroke="#facc15" strokeWidth={4} strokeDasharray="12 8" className="bm-spin" />
      )}
      {selected && <circle r={ringR + 7} fill="rgba(250,204,21,.12)" stroke="#fde68a" strokeWidth={2} />}
      <g filter="url(#bm-shadow)" transform={dragging ? 'scale(1.12)' : undefined}>
        <circle r={r} fill={t.color} stroke={SIDE_RING[t.side]} strokeWidth={4} />
        <circle r={r - 2} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={1.5} />
      </g>
      {Icon ? (
        <Icon x={-iconSize / 2} y={-iconSize / 2} width={iconSize} height={iconSize} color="#fff" strokeWidth={2.2} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.6))' }} />
      ) : (
        <text textAnchor="middle" dy={r * 0.18} fontSize={r * 0.62} fontWeight={800} fill="#fff" stroke="rgba(0,0,0,.55)" strokeWidth={3} paintOrder="stroke">
          {t.label.slice(0, 2).toUpperCase()}
        </text>
      )}
      {ratio !== null && (
        <>
          <circle r={ringR} fill="none" stroke="rgba(0,0,0,.6)" strokeWidth={5} />
          <circle r={ringR} fill="none" stroke={hpColour} strokeWidth={5} strokeDasharray={`${circ * ratio} ${circ}`} transform="rotate(-90)" strokeLinecap="round" />
        </>
      )}
      {dead && (
        <path d={`M ${-r * 0.6} ${-r * 0.6} L ${r * 0.6} ${r * 0.6} M ${r * 0.6} ${-r * 0.6} L ${-r * 0.6} ${r * 0.6}`} stroke="#7f1d1d" strokeWidth={7} strokeLinecap="round" />
      )}
      {t.conditions.length > 0 && (
        <g transform={`translate(${r * 0.72} ${-r * 0.72})`}>
          <circle r={11} fill="#f59e0b" stroke="#0f0d0b" strokeWidth={2} />
          <text textAnchor="middle" dy={5} fontSize={14} fontWeight={800} fill="#0f0d0b">{t.conditions.length}</text>
        </g>
      )}
      {showLabel && <text
        y={r + 8 + fs}
        textAnchor="middle"
        fontSize={fs}
        fontWeight={700}
        fill="#fff"
        stroke="rgba(0,0,0,.8)"
        strokeWidth={fs / 4}
        paintOrder="stroke"
        pointerEvents="none"
      >
        {t.label}
      </text>}
    </g>
  )
}
