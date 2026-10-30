import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/** How a scene is seen right now. Screen = world * k + (ox, oy), in CSS pixels. */
export type ViewInfo = { k: number; zoom: number; ox: number; oy: number; w: number; h: number; dpr: number }

export type Hit = { id: string; enter?: string }

/** One map level: a fixed-size world drawn on a canvas, with optional raster base and live vector layers. */
export type Scene = {
  key: string
  width: number
  height: number
  background: string
  maxZoom: number
  /** Painted once; stretched over the whole scene. */
  base?: CanvasImageSource | null
  /** Called with the world transform applied (draw in world units). */
  drawWorld?: (ctx: CanvasRenderingContext2D, v: ViewInfo) => void
  /** Called in screen space (CSS pixels) for markers and labels that keep their size. */
  drawScreen?: (ctx: CanvasRenderingContext2D, v: ViewInfo, toScreen: (x: number, y: number) => [number, number]) => void
  hit?: (x: number, y: number, v: ViewInfo) => Hit | null
}

export type MapCanvasHandle = {
  /** Smoothly moves the camera; resolves when it arrives. */
  flyTo: (x: number, y: number, zoom: number, ms?: number) => Promise<void>
  getView: () => ViewInfo
}

type Cam = { cx: number; cy: number; zoom: number }

/**
 * Canvas map viewer with eased wheel zoom, drag to pan, click/double-click picking,
 * "zoom past the edge" to change level, and a zoom-and-fade transition when the scene changes.
 */
export const MapCanvas = forwardRef<MapCanvasHandle, {
  scene: Scene
  /** 'in' when we went deeper, 'out' when we came back up. */
  transition?: 'in' | 'out' | null
  /** Where the camera starts on a new scene (world units). Defaults to the whole scene. */
  start?: Cam | null
  onPick?: (hit: Hit | null) => void
  onEnter?: (hit: Hit) => void
  onZoomPast?: (dir: 'in' | 'out', x: number, y: number) => void
  className?: string
}>(function MapCanvas({ scene, transition, start, onPick, onEnter, onZoomPast, className = '' }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(scene)
  const cam = useRef<Cam>({ cx: scene.width / 2, cy: scene.height / 2, zoom: 1 })
  const target = useRef<Cam>({ ...cam.current })
  const size = useRef({ w: 1, h: 1, dpr: 1 })
  const frame = useRef(0)
  const fly = useRef<{ from: Cam; to: Cam; t0: number; ms: number; done: () => void } | null>(null)
  const fade = useRef<{ snap: HTMLCanvasElement; t0: number; dir: 'in' | 'out' } | null>(null)
  const overshoot = useRef({ n: 0, t: 0 })
  const handlers = useRef({ onPick, onEnter, onZoomPast })
  handlers.current = { onPick, onEnter, onZoomPast }

  const fitK = () => Math.min(size.current.w / sceneRef.current.width, size.current.h / sceneRef.current.height)
  function viewOf(c: Cam): ViewInfo {
    const k = fitK() * c.zoom
    return { k, zoom: c.zoom, ox: size.current.w / 2 - c.cx * k, oy: size.current.h / 2 - c.cy * k, w: size.current.w, h: size.current.h, dpr: size.current.dpr }
  }
  function clampCam(c: Cam): Cam {
    const s = sceneRef.current
    const zoom = Math.min(s.maxZoom, Math.max(1, c.zoom))
    const k = fitK() * zoom
    // Keep the scene on screen; allow centring when it is smaller than the view
    const hw = size.current.w / 2 / k
    const hh = size.current.h / 2 / k
    const cx = s.width > hw * 2 ? Math.min(s.width - hw, Math.max(hw, c.cx)) : s.width / 2
    const cy = s.height > hh * 2 ? Math.min(s.height - hh, Math.max(hh, c.cy)) : s.height / 2
    return { cx, cy, zoom }
  }
  const toWorld = (sx: number, sy: number) => {
    const v = viewOf(cam.current)
    return { x: (sx - v.ox) / v.k, y: (sy - v.oy) / v.k }
  }

  function draw(now: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const s = sceneRef.current
    const { w, h, dpr } = size.current

    // Camera: scripted flights, otherwise ease towards the target
    let moving = false
    if (fly.current) {
      const f = fly.current
      const t = Math.min(1, (now - f.t0) / f.ms)
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
      // Interpolate zoom in log space so it feels even
      const z = Math.exp(Math.log(f.from.zoom) + (Math.log(f.to.zoom) - Math.log(f.from.zoom)) * e)
      cam.current = { cx: f.from.cx + (f.to.cx - f.from.cx) * e, cy: f.from.cy + (f.to.cy - f.from.cy) * e, zoom: z }
      target.current = { ...cam.current }
      moving = t < 1
      if (t >= 1) {
        fly.current = null
        f.done()
      }
    } else {
      const c = cam.current
      const tg = target.current
      const a = 0.22
      const next = { cx: c.cx + (tg.cx - c.cx) * a, cy: c.cy + (tg.cy - c.cy) * a, zoom: Math.exp(Math.log(c.zoom) + (Math.log(tg.zoom) - Math.log(c.zoom)) * a) }
      const close = Math.abs(next.zoom - tg.zoom) < 0.0005 * tg.zoom && Math.abs(next.cx - tg.cx) < 0.01 && Math.abs(next.cy - tg.cy) < 0.01
      cam.current = close ? { ...tg } : next
      moving = !close
    }

    const v = viewOf(cam.current)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.fillStyle = s.background
    ctx.fillRect(0, 0, w, h)

    let alpha = 1
    if (fade.current) {
      const t = Math.min(1, (now - fade.current.t0) / 420)
      alpha = t
      if (t >= 1) fade.current = null
      else moving = true
    }

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.setTransform(dpr * v.k, 0, 0, dpr * v.k, dpr * v.ox, dpr * v.oy)
    if (s.base) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(s.base, 0, 0, s.width, s.height)
    }
    s.drawWorld?.(ctx, v)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    s.drawScreen?.(ctx, v, (x, y) => [x * v.k + v.ox, y * v.k + v.oy])
    ctx.restore()

    // The previous level zooms through and fades away
    if (fade.current) {
      const t = Math.min(1, (now - fade.current.t0) / 420)
      const scale = fade.current.dir === 'in' ? 1 + t * 1.6 : 1 - t * 0.55
      ctx.save()
      ctx.globalAlpha = 1 - t
      ctx.translate(w / 2, h / 2)
      ctx.scale(scale, scale)
      ctx.drawImage(fade.current.snap, -w / 2, -h / 2, w, h)
      ctx.restore()
    }

    if (moving) frame.current = requestAnimationFrame(draw)
    else frame.current = 0
  }
  const kick = () => {
    if (!frame.current) frame.current = requestAnimationFrame(draw)
  }

  // Resize with the container, at device resolution
  useEffect(() => {
    const wrap = wrapRef.current!
    const canvas = canvasRef.current!
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      size.current = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      cam.current = clampCam(cam.current)
      target.current = clampCam(target.current)
      cancelAnimationFrame(frame.current)
      frame.current = 0
      draw(performance.now())
    })
    ro.observe(wrap)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // New scene: snapshot the old one for the transition and reset the camera
  useEffect(() => {
    const prev = sceneRef.current
    sceneRef.current = scene
    if (prev.key !== scene.key) {
      const canvas = canvasRef.current
      if (canvas && transition) {
        const snap = document.createElement('canvas')
        snap.width = canvas.width
        snap.height = canvas.height
        snap.getContext('2d')!.drawImage(canvas, 0, 0)
        fade.current = { snap, t0: performance.now(), dir: transition }
      }
      const begin = start ? clampCam(start) : { cx: scene.width / 2, cy: scene.height / 2, zoom: 1 }
      // Arrive with a little camera move in the same direction as the transition
      cam.current = transition === 'in' ? { ...begin, zoom: Math.max(1, begin.zoom * 0.6) } : transition === 'out' ? clampCam({ ...begin, zoom: begin.zoom * 1.8 }) : begin
      cam.current = clampCam(cam.current)
      target.current = begin
      overshoot.current = { n: 0, t: 0 }
    }
    kick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  useImperativeHandle(ref, () => ({
    flyTo: (x, y, zoom, ms = 450) =>
      new Promise<void>((resolve) => {
        const to = { cx: x, cy: y, zoom: Math.min(sceneRef.current.maxZoom * 1.6, Math.max(1, zoom)) }
        fly.current = { from: { ...cam.current }, to, t0: performance.now(), ms, done: resolve }
        kick()
      }),
    getView: () => viewOf(cam.current),
  }))

  // Wheel zoom around the cursor
  useEffect(() => {
    const canvas = canvasRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (fly.current) return
      const r = canvas.getBoundingClientRect()
      const sx = e.clientX - r.left
      const sy = e.clientY - r.top
      const t = target.current
      const factor = Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.0022)
      const s = sceneRef.current
      const wantIn = factor > 1
      // Zooming past the limits moves between levels
      if ((wantIn && t.zoom >= s.maxZoom - 1e-3) || (!wantIn && t.zoom <= 1 + 1e-3)) {
        const now = performance.now()
        if (now - overshoot.current.t > 600) overshoot.current.n = 0
        overshoot.current = { n: overshoot.current.n + Math.abs(e.deltaY), t: now }
        if (overshoot.current.n > 260) {
          overshoot.current.n = 0
          const p = toWorld(sx, sy)
          handlers.current.onZoomPast?.(wantIn ? 'in' : 'out', p.x, p.y)
        }
        return
      }
      // Keep the point under the cursor fixed, using the target camera
      const kOld = fitK() * t.zoom
      const zoom = Math.min(s.maxZoom, Math.max(1, t.zoom * factor))
      const kNew = fitK() * zoom
      const wx = t.cx + (sx - size.current.w / 2) / kOld
      const wy = t.cy + (sy - size.current.h / 2) / kOld
      target.current = clampCam({ zoom, cx: wx - (sx - size.current.w / 2) / kNew, cy: wy - (sy - size.current.h / 2) / kNew })
      kick()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean; id: number } | null>(null)
  const lastClick = useRef(0)

  function zoomBy(f: number) {
    const t = target.current
    target.current = clampCam({ ...t, zoom: t.zoom * f })
    kick()
  }

  return (
    <div ref={wrapRef} className={`relative h-full w-full overflow-hidden rounded-lg border border-edge ${className}`} style={{ background: scene.background }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, cx: target.current.cx, cy: target.current.cy, moved: false, id: e.pointerId }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) {
            // Hover cursor feedback
            const s = sceneRef.current
            if (s.hit) {
              const r = canvasRef.current!.getBoundingClientRect()
              const p = toWorld(e.clientX - r.left, e.clientY - r.top)
              const hit = s.hit(p.x, p.y, viewOf(cam.current))
              canvasRef.current!.style.cursor = hit?.enter ? 'pointer' : ''
            }
            return
          }
          const dx = e.clientX - d.x
          const dy = e.clientY - d.y
          if (!d.moved && Math.hypot(dx, dy) < 4) return
          d.moved = true
          const k = fitK() * cam.current.zoom
          const next = clampCam({ zoom: target.current.zoom, cx: d.cx - dx / k, cy: d.cy - dy / k })
          target.current = next
          cam.current = { ...cam.current, cx: next.cx, cy: next.cy }
          kick()
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          if (!d || d.moved) return
          const r = canvasRef.current!.getBoundingClientRect()
          const p = toWorld(e.clientX - r.left, e.clientY - r.top)
          const hit = sceneRef.current.hit?.(p.x, p.y, viewOf(cam.current)) ?? null
          const now = performance.now()
          if (now - lastClick.current < 320 && hit?.enter) handlers.current.onEnter?.(hit)
          else handlers.current.onPick?.(hit)
          lastClick.current = now
        }}
        onPointerCancel={() => (drag.current = null)}
      />
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {[
          { icon: ZoomIn, label: 'Zoom in', fn: () => zoomBy(1.6) },
          { icon: ZoomOut, label: 'Zoom out', fn: () => zoomBy(1 / 1.6) },
          { icon: Maximize, label: 'Show everything', fn: () => { target.current = clampCam({ cx: scene.width / 2, cy: scene.height / 2, zoom: 1 }); kick() } },
        ].map(({ icon: Icon, label, fn }) => (
          <button key={label} type="button" onClick={fn} title={label} aria-label={label} className="rounded-md border border-edge bg-ink/80 p-1.5 text-parch backdrop-blur hover:border-gold hover:text-gold">
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  )
})

