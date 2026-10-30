import { createNoise2D } from 'simplex-noise'
import { ROOM_LABELS, type PoiType } from '../atlas/pois'
import { makeRng, type Rng } from '../world/random'

// Procedural top-down battle maps, painted on a canvas.
// A map is fully described by preset + seed + size, so only those are saved.

export const BATTLE_PRESETS = [
  { id: 'forest', label: 'Forest clearing' },
  { id: 'road', label: 'Road ambush' },
  { id: 'river', label: 'River crossing' },
  { id: 'ruins', label: 'Overgrown ruins' },
  { id: 'cave', label: 'Cave' },
  { id: 'dungeon', label: 'Dungeon' },
  { id: 'tavern', label: 'Tavern' },
  { id: 'winter', label: 'Snowy woods' },
] as const
export type BattlePreset = (typeof BATTLE_PRESETS)[number]['id']

export const BATTLE_SIZES = [
  { label: 'Small (20 × 14)', cols: 20, rows: 14 },
  { label: 'Medium (30 × 20)', cols: 30, rows: 20 },
  { label: 'Large (40 × 26)', cols: 40, rows: 26 },
]

/** Pixels per grid cell in the painted image. */
export const CELL_PX = 56

type Ctx = CanvasRenderingContext2D
type RGB = [number, number, number]
type Pt = { x: number; y: number }

/** A labelled room on a painted map, in grid cells. */
export type MapRoom = { x: number; y: number; w: number; h: number; label: string }
export type PaintedMap = { canvas: HTMLCanvasElement; rooms: MapRoom[] }

const cache = new Map<string, string>()
const canvasCache = new Map<string, PaintedMap>()

export function battleMapImage(preset: string, seed: number, cols: number, rows: number): string {
  const key = `${preset}|${seed}|${cols}|${rows}`
  const hit = cache.get(key)
  if (hit) return hit
  const url = battleMapCanvas(preset, seed, cols, rows).canvas.toDataURL('image/jpeg', 0.9)
  cache.set(key, url)
  return url
}

/** Paints a map once and keeps the canvas, plus the rooms it laid out (for building and dungeon maps). */
export function battleMapCanvas(preset: string, seed: number, cols: number, rows: number): PaintedMap {
  const key = `${preset}|${seed}|${cols}|${rows}`
  const hit = canvasCache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = cols * CELL_PX
  canvas.height = rows * CELL_PX
  const ctx = canvas.getContext('2d')!
  const p = new Painter(ctx, preset, seed, cols, rows)
  if (preset.startsWith('house:')) p.building(preset.slice(6))
  else switch (preset as BattlePreset) {
    case 'road': p.road(); break
    case 'river': p.river(); break
    case 'ruins': p.ruins(); break
    case 'cave': p.cave(); break
    case 'dungeon': p.dungeon(); break
    case 'tavern': p.tavern(); break
    case 'winter': p.forest(true); break
    default: p.forest(false)
  }
  p.vignette()
  const out = { canvas, rooms: p.rooms }
  canvasCache.set(key, out)
  return out
}

// ---------- colour helpers ----------

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
function rgb(c: RGB, a = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
}
function shade(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k]
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

const PALETTES = {
  grass: { a: hex('#55702f'), b: hex('#6d8838'), c: hex('#3f5826'), dirt: hex('#7b6343'), dirt2: hex('#93795a'), tuft: hex('#2f4419'), tuft2: hex('#8aa24a') },
  snow: { a: hex('#e6ecf1'), b: hex('#f7fafc'), c: hex('#c9d4de'), dirt: hex('#9aa6b2'), dirt2: hex('#b7c2cc'), tuft: hex('#7d8b96'), tuft2: hex('#ffffff') },
}

class Painter {
  W: number
  H: number
  C = CELL_PX
  rng: Rng
  n1: (x: number, y: number) => number
  n2: (x: number, y: number) => number
  occupied: { x: number; y: number; r: number }[] = []
  rooms: MapRoom[] = []
  ctx: Ctx
  cols: number
  rows: number

  constructor(ctx: Ctx, preset: string, seed: number, cols: number, rows: number) {
    this.ctx = ctx
    this.cols = cols
    this.rows = rows
    this.W = cols * CELL_PX
    this.H = rows * CELL_PX
    this.rng = makeRng(`${preset}:${seed}`)
    this.n1 = createNoise2D(this.rng.next)
    this.n2 = createNoise2D(this.rng.next)
  }

  fbm(x: number, y: number, oct = 4) {
    let t = 0
    let a = 1
    let f = 1
    let norm = 0
    for (let i = 0; i < oct; i++) {
      t += this.n1(x * f, y * f) * a
      norm += a
      a *= 0.5
      f *= 2.03
    }
    return t / norm
  }

  /** Paints every pixel with colour(x, y) at half resolution, then scales it up smoothly. */
  field(colour: (x: number, y: number) => RGB, scale = 0.5) {
    const w = Math.ceil(this.W * scale)
    const h = Math.ceil(this.H * scale)
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d')!
    const img = octx.createImageData(w, h)
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const c = colour(px / scale, py / scale)
        const i = (py * w + px) * 4
        img.data[i] = c[0]
        img.data[i + 1] = c[1]
        img.data[i + 2] = c[2]
        img.data[i + 3] = 255
      }
    }
    octx.putImageData(img, 0, 0)
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
    this.ctx.drawImage(off, 0, 0, this.W, this.H)
  }

  free(x: number, y: number, r: number) {
    return this.occupied.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r)
  }
  claim(x: number, y: number, r: number) {
    this.occupied.push({ x, y, r })
  }

  // ---------- ground ----------

  grassGround(pal = PALETTES.grass, dirtAmount = 0.25, dirtNear?: (x: number, y: number) => number) {
    const C = this.C
    this.field((x, y) => {
      const u = x / C
      const v = y / C
      const big = this.fbm(u * 0.08, v * 0.08)
      const mid = this.n2(u * 0.35, v * 0.35)
      const fine = this.n2(u * 2.1 + 40, v * 2.1)
      let c = mix(pal.a, pal.b, smooth(-0.4, 0.5, big))
      c = mix(c, pal.c, smooth(0.1, 0.8, mid) * 0.55)
      let dirt = smooth(1 - dirtAmount - 0.15, 1 - dirtAmount + 0.15, (this.fbm(u * 0.12 + 9, v * 0.12) + 1) / 2 + mid * 0.08)
      if (dirtNear) dirt = Math.max(dirt, dirtNear(x, y))
      c = mix(c, mix(pal.dirt, pal.dirt2, (fine + 1) / 2), dirt)
      return shade(c, 1 + fine * 0.05)
    })
  }

  tufts(count: number, pal = PALETTES.grass, avoid?: (x: number, y: number) => boolean) {
    const { ctx, rng } = this
    ctx.lineCap = 'round'
    for (let i = 0; i < count; i++) {
      const x = rng.range(0, this.W)
      const y = rng.range(0, this.H)
      if (avoid?.(x, y)) continue
      const light = rng.chance(0.45)
      ctx.strokeStyle = rgb(light ? pal.tuft2 : pal.tuft, light ? 0.35 : 0.45)
      ctx.lineWidth = rng.range(1, 1.8)
      const blades = rng.int(3, 6)
      const len = rng.range(5, 10)
      ctx.beginPath()
      for (let b = 0; b < blades; b++) {
        const a = -Math.PI / 2 + rng.range(-0.8, 0.8)
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
      }
      ctx.stroke()
    }
  }

  flowers(count: number, avoid?: (x: number, y: number) => boolean) {
    const { ctx, rng } = this
    const colours = ['#f4f1de', '#f2cc4f', '#e07a9a', '#a78bfa']
    for (let i = 0; i < count; i++) {
      const cx = rng.range(0, this.W)
      const cy = rng.range(0, this.H)
      if (avoid?.(cx, cy)) continue
      ctx.fillStyle = rng.pick(colours)
      for (let k = 0; k < rng.int(3, 7); k++) {
        ctx.beginPath()
        ctx.arc(cx + rng.range(-10, 10), cy + rng.range(-10, 10), rng.range(1.2, 2.2), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // ---------- props ----------

  withShadow(blur: number, dx: number, dy: number, alpha: number, draw: () => void) {
    const { ctx } = this
    ctx.save()
    ctx.shadowColor = `rgba(0,0,0,${alpha})`
    ctx.shadowBlur = blur
    ctx.shadowOffsetX = dx
    ctx.shadowOffsetY = dy
    draw()
    ctx.restore()
  }

  tree(x: number, y: number, r: number, snowy = false, conifer = false) {
    const { ctx, rng } = this
    const base = snowy ? hex('#5d5348') : hex(rng.pick(['#2f5a24', '#36632a', '#2b4f22', '#3e6b2b']))
    if (conifer) {
      // Pine seen from above: layered rings of needles, darker at the rim
      const layer = (rr: number, col: RGB, rot: number) => {
        const spikes = 18
        ctx.beginPath()
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * Math.PI * 2 + rot
          const rad = i % 2 ? rr * 0.78 : rr * rng.range(0.94, 1.04)
          ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
        }
        ctx.closePath()
        ctx.fillStyle = rgb(col)
        ctx.fill()
      }
      const pine = snowy ? hex('#24463a') : hex(rng.pick(['#1f4a2c', '#24522f', '#1c4128']))
      this.withShadow(r * 0.6, r * 0.35, r * 0.45, 0.55, () => layer(r, shade(pine, 0.75), 0))
      const steps = 4
      for (let i = 1; i <= steps; i++) {
        const k = 1 - i / (steps + 1)
        layer(r * k, mix(pine, hex('#6f9a55'), (i / steps) * 0.45), i * 0.35)
      }
      if (snowy) {
        ctx.fillStyle = 'rgba(245,248,252,.85)'
        for (let i = 0; i < 9; i++) {
          const a = rng.range(Math.PI * 0.9, Math.PI * 1.7)
          const d = rng.range(r * 0.15, r * 0.8)
          ctx.beginPath()
          ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * rng.range(0.1, 0.2), r * rng.range(0.06, 0.1), a, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      return
    }
    const lobeCount = rng.int(6, 9)
    const lobes = Array.from({ length: lobeCount }, (_, i) => {
      const a = (i / lobeCount) * Math.PI * 2 + rng.range(-0.3, 0.3)
      const d = r * rng.range(0.35, 0.55)
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: r * rng.range(0.42, 0.6) }
    })
    const blob = (k: number, dx = 0, dy = 0) => {
      ctx.beginPath()
      ctx.arc(x + dx, y + dy, r * 0.62 * k, 0, Math.PI * 2)
      for (const l of lobes) {
        ctx.moveTo(l.x + dx + l.r * k, l.y + dy)
        ctx.arc(l.x + dx, l.y + dy, l.r * k, 0, Math.PI * 2)
      }
    }
    this.withShadow(r * 0.5, r * 0.3, r * 0.4, 0.6, () => {
      blob(1)
      ctx.fillStyle = rgb(shade(base, 0.75))
      ctx.fill()
    })
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1)
    g.addColorStop(0, rgb(mix(base, hex(snowy ? '#ffffff' : '#9cc06a'), snowy ? 0.6 : 0.45)))
    g.addColorStop(0.55, rgb(base))
    g.addColorStop(1, rgb(shade(base, 0.6)))
    blob(0.86, -r * 0.04, -r * 0.05)
    ctx.fillStyle = g
    ctx.fill()
    // Leaf clusters for texture
    for (let i = 0; i < 14; i++) {
      const a = rng.range(0, Math.PI * 2)
      const d = rng.range(0, r * 0.75)
      const px = x + Math.cos(a) * d
      const py = y + Math.sin(a) * d
      const lit = (px - x) + (py - y) < 0
      ctx.fillStyle = rgb(lit ? mix(base, hex(snowy ? '#ffffff' : '#b5d27a'), 0.4) : shade(base, 0.65), 0.55)
      ctx.beginPath()
      ctx.arc(px, py, rng.range(r * 0.08, r * 0.17), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  bush(x: number, y: number, r: number, snowy = false) {
    const { ctx, rng } = this
    const base = snowy ? hex('#3c5446') : hex(rng.pick(['#47702f', '#3d6328', '#557a33']))
    this.withShadow(r * 0.5, r * 0.25, r * 0.3, 0.5, () => {
      ctx.fillStyle = rgb(shade(base, 0.85))
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = rng.range(0, Math.PI * 2)
        const d = rng.range(0, r * 0.5)
        ctx.moveTo(x + Math.cos(a) * d + r * 0.55, y + Math.sin(a) * d)
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.55, 0, Math.PI * 2)
      }
      ctx.fill()
    })
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = rgb(mix(base, hex(snowy ? '#ffffff' : '#a9c86e'), rng.range(0.15, 0.45)), 0.7)
      ctx.beginPath()
      ctx.arc(x + rng.range(-r * 0.5, r * 0.2), y + rng.range(-r * 0.5, r * 0.2), rng.range(r * 0.12, r * 0.25), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  rock(x: number, y: number, r: number, tint = '#8a8478') {
    const { ctx, rng } = this
    const base = hex(tint)
    const n = rng.int(6, 9)
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.25, 0.25)
      const d = r * rng.range(0.7, 1.05)
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.85 }
    })
    const poly = (k: number, dx = 0, dy = 0) => {
      ctx.beginPath()
      pts.forEach((p, i) => {
        const px = x + (p.x - x) * k + dx
        const py = y + (p.y - y) * k + dy
        if (i) ctx.lineTo(px, py)
        else ctx.moveTo(px, py)
      })
      ctx.closePath()
    }
    this.withShadow(r * 0.4, r * 0.25, r * 0.3, 0.6, () => {
      poly(1)
      ctx.fillStyle = rgb(shade(base, 0.55))
      ctx.fill()
    })
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r)
    g.addColorStop(0, rgb(mix(base, hex('#ffffff'), 0.3)))
    g.addColorStop(1, rgb(shade(base, 0.7)))
    poly(0.82, -r * 0.08, -r * 0.1)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = rgb(shade(base, 0.45), 0.6)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x - r * 0.2, y - r * 0.3)
    ctx.lineTo(x + r * 0.05, y)
    ctx.lineTo(x + r * 0.3, y + r * 0.1)
    ctx.stroke()
  }

  log(x: number, y: number, len: number, angle: number) {
    const { ctx } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    const w = len * 0.18
    this.withShadow(8, 5, 6, 0.55, () => {
      ctx.fillStyle = '#5b4126'
      ctx.beginPath()
      ctx.roundRect(-len / 2, -w / 2, len, w, w / 2)
      ctx.fill()
    })
    const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2)
    g.addColorStop(0, '#8a6a43')
    g.addColorStop(1, '#4a331c')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(-len / 2, -w / 2, len, w, w / 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(40,25,10,.5)'
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(-len / 2 + w, -w / 4 + (i * w) / 6)
      ctx.lineTo(len / 2 - w, -w / 4 + (i * w) / 6 + this.rng.range(-1, 1))
      ctx.stroke()
    }
    ctx.fillStyle = '#b8935f'
    ctx.beginPath()
    ctx.ellipse(len / 2 - 2, 0, w * 0.22, w * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** Scatter trees using a density function (0..1) and keep the given areas clear. */
  scatterTrees(density: (x: number, y: number) => number, opts: { tries: number; snowy?: boolean; conifer?: number; bushes?: number; blocked?: (x: number, y: number, r: number) => boolean }) {
    const { rng, C } = this
    for (let i = 0; i < opts.tries; i++) {
      const x = rng.range(-C * 0.5, this.W + C * 0.5)
      const y = rng.range(-C * 0.5, this.H + C * 0.5)
      if (rng.next() > density(x, y)) continue
      const isBush = rng.chance(opts.bushes ?? 0.3)
      const r = isBush ? rng.range(C * 0.35, C * 0.6) : rng.range(C * 0.75, C * 1.35)
      if (opts.blocked?.(x, y, r)) continue
      if (!this.free(x, y, r * 0.7)) continue
      this.claim(x, y, r * 0.7)
      if (isBush) this.bush(x, y, r, opts.snowy)
      else this.tree(x, y, r, opts.snowy, rng.chance(opts.conifer ?? 0.15))
    }
  }

  scatterRocks(count: number, blocked?: (x: number, y: number, r: number) => boolean, tint?: string) {
    const { rng, C } = this
    for (let i = 0; i < count; i++) {
      const x = rng.range(C, this.W - C)
      const y = rng.range(C, this.H - C)
      const r = rng.chance(0.2) ? rng.range(C * 0.5, C * 0.8) : rng.range(C * 0.15, C * 0.35)
      if (blocked?.(x, y, r) || !this.free(x, y, r)) continue
      this.claim(x, y, r)
      this.rock(x, y, r, tint)
      if (r > C * 0.4) for (let k = 0; k < 3; k++) this.rock(x + rng.range(-r * 1.4, r * 1.4), y + rng.range(-r * 1.4, r * 1.4), rng.range(C * 0.08, C * 0.16), tint)
    }
  }

  // ---------- paths ----------

  wanderingPath(horizontal: boolean, wiggle: number): Pt[] {
    const { rng } = this
    const pts: Pt[] = []
    const len = horizontal ? this.W : this.H
    const across = horizontal ? this.H : this.W
    let off = across * rng.range(0.38, 0.62)
    const steps = 9
    for (let i = 0; i <= steps; i++) {
      const t = -0.06 + (i / steps) * 1.12
      off += rng.range(-wiggle, wiggle) * across
      off = Math.min(across * 0.75, Math.max(across * 0.25, off))
      pts.push(horizontal ? { x: t * len, y: off } : { x: off, y: t * len })
    }
    return pts
  }

  tracePath(pts: Pt[]) {
    const { ctx } = this
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2
      const my = (pts[i].y + pts[i + 1].y) / 2
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
    }
    const last = pts[pts.length - 1]
    ctx.lineTo(last.x, last.y)
  }

  /** Dense samples along the smoothed path, for distance checks. */
  samplePath(pts: Pt[]): Pt[] {
    const out: Pt[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      for (let t = 0; t < 1; t += 0.05) out.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t })
    }
    return out
  }

  distTo(samples: Pt[], x: number, y: number) {
    let best = Infinity
    for (const p of samples) best = Math.min(best, (p.x - x) ** 2 + (p.y - y) ** 2)
    return Math.sqrt(best)
  }

  // ---------- presets ----------

  forest(snowy: boolean) {
    const { C, rng } = this
    const pal = snowy ? PALETTES.snow : PALETTES.grass
    const cx = this.W * rng.range(0.4, 0.6)
    const cy = this.H * rng.range(0.4, 0.6)
    const clearing = (x: number, y: number) => Math.hypot((x - cx) / (this.W * 0.36), (y - cy) / (this.H * 0.36))
    this.grassGround(pal, snowy ? 0.12 : 0.22)
    if (!snowy) this.flowers(50, (x, y) => clearing(x, y) > 1)
    this.tufts(snowy ? 300 : 1800, pal)
    // A campfire or standing stone in the middle sometimes
    if (rng.chance(0.5)) this.campfire(cx + rng.range(-C, C), cy + rng.range(-C, C))
    this.scatterRocks(14, (x, y) => clearing(x, y) < 0.5)
    for (let i = 0; i < 3; i++) this.log(rng.range(C * 3, this.W - C * 3), rng.range(C * 3, this.H - C * 3), rng.range(C * 2, C * 3.5), rng.range(0, Math.PI))
    this.scatterTrees((x, y) => smooth(0.75, 1.25, clearing(x, y) + this.fbm(x / C / 6, y / C / 6) * 0.35), { tries: 2600, snowy, conifer: snowy ? 1 : 0.18 })
  }

  campfire(x: number, y: number) {
    const { ctx, C } = this
    this.claim(x, y, C * 0.6)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      this.rock(x + Math.cos(a) * C * 0.42, y + Math.sin(a) * C * 0.42, C * 0.13, '#7c776c')
    }
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(x, y, 0, x, y, C * 2.2)
    g.addColorStop(0, 'rgba(255,170,60,.55)')
    g.addColorStop(1, 'rgba(255,120,30,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - C * 2.2, y - C * 2.2, C * 4.4, C * 4.4)
    ctx.restore()
    ctx.fillStyle = '#2b1d12'
    ctx.beginPath()
    ctx.arc(x, y, C * 0.28, 0, Math.PI * 2)
    ctx.fill()
    const f = ctx.createRadialGradient(x, y, 0, x, y, C * 0.26)
    f.addColorStop(0, '#fff3b0')
    f.addColorStop(0.5, '#ffb347')
    f.addColorStop(1, 'rgba(220,70,20,.6)')
    ctx.fillStyle = f
    ctx.beginPath()
    ctx.arc(x, y, C * 0.24, 0, Math.PI * 2)
    ctx.fill()
  }

  road() {
    const { C, ctx, rng } = this
    const path = this.wanderingPath(true, 0.08)
    const samples = this.samplePath(path)
    const roadW = C * 2.4
    this.grassGround(PALETTES.grass, 0.12, (x, y) => smooth(roadW * 0.75, roadW * 0.45, this.distTo(samples, x, y) + this.n2(x / 30, y / 30) * 10))
    this.tufts(1600, PALETTES.grass, (x, y) => this.distTo(samples, x, y) < roadW * 0.5)
    // Wheel ruts
    ctx.save()
    ctx.lineCap = 'round'
    for (const off of [-C * 0.45, C * 0.45]) {
      this.tracePath(path.map((p) => ({ x: p.x, y: p.y + off })))
      ctx.strokeStyle = 'rgba(70,50,30,.35)'
      ctx.lineWidth = C * 0.16
      ctx.stroke()
    }
    ctx.restore()
    // Pebbles on the road
    for (let i = 0; i < 160; i++) {
      const p = rng.pick(samples)
      ctx.fillStyle = `rgba(${rng.pick(['120,105,85', '150,135,110', '90,75,60'])},.7)`
      ctx.beginPath()
      ctx.arc(p.x + rng.range(-roadW * 0.4, roadW * 0.4), p.y + rng.range(-roadW * 0.4, roadW * 0.4), rng.range(1, 2.5), 0, Math.PI * 2)
      ctx.fill()
    }
    // A broken cart on the road
    const cart = samples[Math.floor(samples.length * rng.range(0.35, 0.65))]
    this.cart(cart.x, cart.y + rng.range(-C * 0.3, C * 0.3), rng.range(-0.4, 0.4))
    this.claim(cart.x, cart.y, C * 1.6)
    const nearRoad = (x: number, y: number, r: number) => this.distTo(samples, x, y) < roadW * 0.7 + r * 0.5
    this.scatterRocks(16, nearRoad)
    this.scatterTrees((x, y) => 0.25 + smooth(roadW * 1.2, roadW * 3, this.distTo(samples, x, y)) * 0.55 + this.fbm(x / C / 5, y / C / 5) * 0.3, { tries: 1600, blocked: nearRoad, bushes: 0.45 })
  }

  cart(x: number, y: number, angle: number) {
    const { ctx, C } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    const w = C * 2.2
    const h = C * 1.2
    this.withShadow(12, 8, 10, 0.6, () => {
      ctx.fillStyle = '#5a3d22'
      ctx.fillRect(-w / 2, -h / 2, w, h)
    })
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#7a5634' : '#6c4a2b'
      ctx.fillRect(-w / 2 + (i * w) / 6, -h / 2, w / 6 - 1.5, h)
    }
    ctx.strokeStyle = '#2f2012'
    ctx.lineWidth = 3
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = '#3b2a18'
    for (const [wx, wy] of [[-w * 0.3, -h / 2 - 4], [w * 0.3, -h / 2 - 4], [-w * 0.3, h / 2 + 4]]) ctx.fillRect(wx - C * 0.25, wy - 4, C * 0.5, 8)
    // Tongue and a spilled crate
    ctx.fillRect(w / 2, -3, C * 0.9, 6)
    ctx.restore()
    this.crate(x - C * 1.4, y + C * 0.9, 0.5)
    this.barrel(x + C * 1.2, y + C * 1.1)
  }

  river() {
    const { C, ctx, rng } = this
    const path = this.wanderingPath(false, 0.07)
    const samples = this.samplePath(path)
    const riverW = C * rng.range(3, 4)
    this.grassGround(PALETTES.grass, 0.15, (x, y) => smooth(riverW * 0.9, riverW * 0.55, this.distTo(samples, x, y)) * 0.8)
    this.tufts(1500, PALETTES.grass, (x, y) => this.distTo(samples, x, y) < riverW * 0.6)
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    this.tracePath(path)
    ctx.strokeStyle = 'rgba(92,74,52,.85)'
    ctx.lineWidth = riverW * 1.12
    ctx.stroke()
    // Many thin layers from the shallow edge to the deep middle read as a smooth gradient
    const shallow = hex('#4f7a6e')
    const deep = hex('#24576e')
    for (let i = 0; i <= 14; i++) {
      const t = i / 14
      this.tracePath(path)
      ctx.strokeStyle = rgb(mix(shallow, deep, Math.sqrt(t)))
      ctx.lineWidth = riverW * (1 - t * 0.85)
      ctx.stroke()
    }
    // Ripples
    ctx.strokeStyle = 'rgba(210,235,245,.35)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 140; i++) {
      const p = rng.pick(samples)
      const ox = rng.range(-riverW * 0.4, riverW * 0.4)
      ctx.beginPath()
      ctx.moveTo(p.x + ox, p.y)
      ctx.quadraticCurveTo(p.x + ox + 3, p.y + 6, p.x + ox, p.y + rng.range(10, 20))
      ctx.stroke()
    }
    ctx.restore()
    // Reeds along the banks
    for (let i = 0; i < 220; i++) {
      const p = rng.pick(samples)
      const side = rng.chance(0.5) ? 1 : -1
      const x = p.x + side * riverW * rng.range(0.42, 0.6)
      ctx.strokeStyle = rng.chance(0.5) ? 'rgba(120,140,60,.8)' : 'rgba(80,100,40,.8)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(x, p.y)
      ctx.lineTo(x + rng.range(-4, 4), p.y - rng.range(6, 12))
      ctx.stroke()
    }
    // Wooden bridge across the river
    const mid = samples[Math.floor(samples.length * rng.range(0.35, 0.65))]
    this.bridge(mid.x, mid.y, riverW * 1.5)
    this.claim(mid.x, mid.y, riverW * 0.8)
    const nearWater = (x: number, y: number, r: number) => this.distTo(samples, x, y) < riverW * 0.65 + r * 0.6 || Math.abs(y - mid.y) < C * 1.4
    this.scatterRocks(14, nearWater)
    this.scatterTrees((x, y) => 0.2 + this.fbm(x / C / 6, y / C / 6) * 0.6 + smooth(riverW * 1.5, riverW * 4, this.distTo(samples, x, y)) * 0.4, { tries: 1500, blocked: nearWater })
  }

  bridge(x: number, y: number, len: number) {
    const { ctx, C, rng } = this
    const w = C * 2
    this.withShadow(14, 8, 12, 0.65, () => {
      ctx.fillStyle = '#4a3420'
      ctx.fillRect(x - len / 2, y - w / 2, len, w)
    })
    for (let px = x - len / 2; px < x + len / 2; px += C * 0.42) {
      ctx.fillStyle = rgb(mix(hex('#8a6640'), hex('#6b4c2c'), rng.next()))
      ctx.fillRect(px, y - w / 2 + rng.range(-2, 2), C * 0.38, w + rng.range(-2, 2))
      ctx.fillStyle = 'rgba(30,20,10,.6)'
      ctx.fillRect(px + 3, y - w / 2 + 6, 2, 2)
      ctx.fillRect(px + 3, y + w / 2 - 8, 2, 2)
    }
    ctx.fillStyle = '#3d2a17'
    ctx.fillRect(x - len / 2, y - w / 2 - 5, len, 7)
    ctx.fillRect(x - len / 2, y + w / 2 - 2, len, 7)
  }

  ruins() {
    const { C, rng, ctx } = this
    this.grassGround(PALETTES.grass, 0.18)
    // Old flagstone floor, partly overgrown
    const fx = Math.floor(this.cols * rng.range(0.2, 0.35))
    const fy = Math.floor(this.rows * rng.range(0.2, 0.35))
    const fw = Math.floor(this.cols * rng.range(0.35, 0.5))
    const fh = Math.floor(this.rows * rng.range(0.35, 0.5))
    for (let gy = fy; gy < fy + fh; gy++) {
      for (let gx = fx; gx < fx + fw; gx++) {
        const edge = Math.min(gx - fx, gy - fy, fx + fw - 1 - gx, fy + fh - 1 - gy)
        if (rng.next() < (edge < 1 ? 0.45 : 0.12) + this.fbm(gx / 4, gy / 4) * 0.25) continue
        this.flagstone(gx * C, gy * C)
      }
    }
    this.tufts(1400, PALETTES.grass)
    // Broken walls around the floor
    const walls: [number, number, number, number][] = [
      [fx - 1, fy - 1, fx + fw + 1, fy - 1], [fx + fw + 1, fy - 1, fx + fw + 1, fy + fh + 1],
      [fx + fw + 1, fy + fh + 1, fx - 1, fy + fh + 1], [fx - 1, fy + fh + 1, fx - 1, fy - 1],
    ]
    for (const [x0, y0, x1, y1] of walls) {
      const len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let i = 0; i < len; i++) {
        if (this.fbm((x0 + i) / 3, (y0 + i) / 3 + 7) > 0.15 || rng.chance(0.15)) continue
        const t0 = i / len
        const t1 = (i + 1) / len
        this.stoneWall((x0 + (x1 - x0) * t0) * C, (y0 + (y1 - y0) * t0) * C, (x0 + (x1 - x0) * t1) * C, (y0 + (y1 - y0) * t1) * C)
      }
    }
    // Pillars, some toppled
    for (let i = 0; i < 6; i++) {
      const x = (fx + 1 + (i % 3) * ((fw - 2) / 2)) * C
      const y = (i < 3 ? fy + 1 : fy + fh - 1) * C
      if (rng.chance(0.35)) this.fallenPillar(x, y, rng.range(0, Math.PI * 2))
      else if (rng.chance(0.8)) this.pillar(x, y)
      this.claim(x, y, C * 0.5)
    }
    ctx.globalAlpha = 1
    const inFloor = (x: number, y: number, r: number) => x > (fx - 1.5) * C - r && x < (fx + fw + 1.5) * C + r && y > (fy - 1.5) * C - r && y < (fy + fh + 1.5) * C + r
    this.scatterRocks(18, (x, y, r) => inFloor(x, y, r) && rng.chance(0.6), '#8f8a80')
    this.scatterTrees((x, y) => 0.15 + this.fbm(x / C / 5, y / C / 5) * 0.5, { tries: 900, blocked: inFloor })
  }

  flagstone(x: number, y: number) {
    const { ctx, rng, C } = this
    const base = mix(hex('#8d877c'), hex('#a39d90'), rng.next())
    const split = rng.chance(0.4)
    const parts: [number, number, number, number][] = split ? [[0, 0, C, C / 2], [0, C / 2, C, C / 2]] : [[0, 0, C, C]]
    for (const [px, py, pw, ph] of parts) {
      ctx.fillStyle = rgb(shade(base, rng.range(0.88, 1.08)))
      ctx.fillRect(x + px + 1.5, y + py + 1.5, pw - 3, ph - 3)
      ctx.fillStyle = 'rgba(255,255,255,.08)'
      ctx.fillRect(x + px + 1.5, y + py + 1.5, pw - 3, 2)
      ctx.fillStyle = 'rgba(0,0,0,.18)'
      ctx.fillRect(x + px + 1.5, y + py + ph - 3.5, pw - 3, 2)
    }
    if (rng.chance(0.25)) {
      ctx.strokeStyle = 'rgba(40,35,30,.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + rng.range(5, C - 5), y + 3)
      ctx.lineTo(x + rng.range(5, C - 5), y + C / 2)
      ctx.lineTo(x + rng.range(5, C - 5), y + C - 3)
      ctx.stroke()
    }
  }

  stoneWall(x0: number, y0: number, x1: number, y1: number) {
    const { ctx, C, rng } = this
    const ang = Math.atan2(y1 - y0, x1 - x0)
    const len = Math.hypot(x1 - x0, y1 - y0)
    ctx.save()
    ctx.translate(x0, y0)
    ctx.rotate(ang)
    const t = C * 0.42
    this.withShadow(10, 6, 8, 0.6, () => {
      ctx.fillStyle = '#5b564d'
      ctx.fillRect(-2, -t / 2, len + 4, t)
    })
    for (let bx = -2; bx < len + 2; ) {
      const bw = rng.range(C * 0.3, C * 0.55)
      for (const row of [0, 1]) {
        ctx.fillStyle = rgb(mix(hex('#9a9488'), hex('#7d776c'), rng.next()))
        ctx.fillRect(bx + (row ? bw / 2 : 0), -t / 2 + row * (t / 2) + 1, Math.min(bw - 2, len + 2 - bx), t / 2 - 2)
      }
      bx += bw
    }
    ctx.restore()
  }

  pillar(x: number, y: number) {
    const { ctx, C } = this
    this.withShadow(12, 7, 9, 0.6, () => {
      ctx.fillStyle = '#7e786d'
      ctx.beginPath()
      ctx.arc(x, y, C * 0.4, 0, Math.PI * 2)
      ctx.fill()
    })
    const g = ctx.createRadialGradient(x - C * 0.12, y - C * 0.12, 2, x, y, C * 0.4)
    g.addColorStop(0, '#d6d0c2')
    g.addColorStop(1, '#8a8478')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, C * 0.34, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(60,55,48,.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, C * 0.22, 0, Math.PI * 2)
    ctx.stroke()
  }

  fallenPillar(x: number, y: number, angle: number) {
    const { ctx, C } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    const len = C * 2.6
    const w = C * 0.62
    this.withShadow(10, 6, 8, 0.55, () => {
      ctx.fillStyle = '#8a8478'
      ctx.fillRect(0, -w / 2, len, w)
    })
    const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2)
    g.addColorStop(0, '#d2ccbe')
    g.addColorStop(1, '#7e786d')
    ctx.fillStyle = g
    for (let i = 0; i < 3; i++) ctx.fillRect(i * (len / 3) + 2, -w / 2, len / 3 - 4, w)
    ctx.restore()
  }

  /** Cellular-automata cave with smooth, organic walls. */
  cave() {
    const { C, rng } = this
    const sub = 2
    const gw = this.cols * sub
    const gh = this.rows * sub
    let grid = Array.from({ length: gw * gh }, (_, i) => {
      const x = i % gw
      const y = Math.floor(i / gw)
      if (x < 2 || y < 2 || x >= gw - 2 || y >= gh - 2) return 1
      return rng.chance(0.44) ? 1 : 0
    })
    for (let it = 0; it < 5; it++) {
      grid = grid.map((_, i) => {
        const x = i % gw
        const y = Math.floor(i / gw)
        if (x < 1 || y < 1 || x >= gw - 1 || y >= gh - 1) return 1
        let walls = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) walls += grid[(y + dy) * gw + x + dx]
        return walls >= 5 ? 1 : 0
      })
    }
    // Keep only the largest open area so everything is reachable
    const label = new Int32Array(gw * gh).fill(-1)
    let best = -1
    let bestSize = 0
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] || label[i] >= 0) continue
      const stack = [i]
      label[i] = i
      let size = 0
      while (stack.length) {
        const c = stack.pop()!
        size++
        for (const n of [c - 1, c + 1, c - gw, c + gw]) {
          if (n >= 0 && n < grid.length && !grid[n] && label[n] < 0) {
            label[n] = i
            stack.push(n)
          }
        }
      }
      if (size > bestSize) {
        bestSize = size
        best = i
      }
    }
    grid = grid.map((v, i) => (v || label[i] !== best ? 1 : 0))

    const sample = (x: number, y: number) => {
      const gx = (x / C) * sub - 0.5
      const gy = (y / C) * sub - 0.5
      const x0 = Math.max(0, Math.min(gw - 1, Math.floor(gx)))
      const y0 = Math.max(0, Math.min(gh - 1, Math.floor(gy)))
      const x1 = Math.min(gw - 1, x0 + 1)
      const y1 = Math.min(gh - 1, y0 + 1)
      const tx = Math.min(1, Math.max(0, gx - x0))
      const ty = Math.min(1, Math.max(0, gy - y0))
      const a = grid[y0 * gw + x0] * (1 - tx) + grid[y0 * gw + x1] * tx
      const b = grid[y1 * gw + x0] * (1 - tx) + grid[y1 * gw + x1] * tx
      return a * (1 - ty) + b * ty
    }
    const floor = hex('#5b5147')
    const floor2 = hex('#72665a')
    const wall = hex('#1d1916')
    const wall2 = hex('#3a322b')
    const water = hex('#2c5463')
    this.field((x, y) => {
      const u = x / C
      const v = y / C
      const w = sample(x, y) + this.n2(u * 1.3, v * 1.3) * 0.12
      const tex = this.fbm(u * 0.6, v * 0.6)
      if (w > 0.5) {
        // Rock: darker further from the edge, with a lit rim
        const rim = smooth(0.62, 0.5, w)
        const crag = Math.abs(this.n2(u * 1.7 + 11, v * 1.7)) < 0.06 ? 0.7 : 1
        return shade(mix(mix(wall, wall2, (tex + 1) / 2), hex('#6a5d50'), rim * 0.85), crag)
      }
      let c = mix(floor, floor2, smooth(-0.3, 0.6, tex))
      const pool = this.fbm(u * 0.15 + 30, v * 0.15)
      if (pool > 0.42 && w < 0.2) c = mix(c, water, smooth(0.42, 0.5, pool))
      // Shadow along the base of the walls
      return shade(c, 1 - smooth(0.2, 0.5, w) * 0.45 + this.n2(u * 4, v * 4) * 0.04)
    }, 0.6)
    const open = (x: number, y: number) => sample(x, y) < 0.15
    for (let i = 0; i < 1400; i++) {
      const x = rng.range(0, this.W)
      const y = rng.range(0, this.H)
      if (sample(x, y) > 0.3) continue
      this.ctx.fillStyle = rng.chance(0.5) ? 'rgba(30,25,20,.35)' : 'rgba(160,145,125,.3)'
      this.ctx.beginPath()
      this.ctx.arc(x, y, rng.range(0.8, 2.2), 0, Math.PI * 2)
      this.ctx.fill()
    }
    // Stalagmites, rubble, glowing mushrooms, bones
    for (let i = 0; i < 70; i++) {
      const x = rng.range(0, this.W)
      const y = rng.range(0, this.H)
      if (!open(x, y)) continue
      const r = rng.range(C * 0.1, C * 0.3)
      if (!this.free(x, y, r)) continue
      this.claim(x, y, r)
      this.rock(x, y, r, '#77695a')
    }
    for (let i = 0; i < 18; i++) {
      const x = rng.range(0, this.W)
      const y = rng.range(0, this.H)
      if (!open(x, y)) continue
      this.mushrooms(x, y)
    }
    for (let i = 0; i < 6; i++) {
      const x = rng.range(0, this.W)
      const y = rng.range(0, this.H)
      if (open(x, y)) this.bones(x, y)
    }
  }

  mushrooms(x: number, y: number) {
    const { ctx, rng, C } = this
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(x, y, 0, x, y, C * 0.9)
    g.addColorStop(0, 'rgba(90,200,190,.35)')
    g.addColorStop(1, 'rgba(90,200,190,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - C, y - C, C * 2, C * 2)
    ctx.restore()
    for (let i = 0; i < rng.int(3, 6); i++) {
      ctx.fillStyle = rng.chance(0.5) ? '#9ff3e6' : '#5cc8bd'
      ctx.beginPath()
      ctx.arc(x + rng.range(-10, 10), y + rng.range(-10, 10), rng.range(2, 4.5), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  bones(x: number, y: number) {
    const { ctx, rng } = this
    ctx.strokeStyle = '#d8d0bd'
    ctx.lineCap = 'round'
    for (let i = 0; i < 4; i++) {
      const a = rng.range(0, Math.PI)
      const l = rng.range(6, 14)
      const bx = x + rng.range(-10, 10)
      const by = y + rng.range(-10, 10)
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(bx - Math.cos(a) * l, by - Math.sin(a) * l)
      ctx.lineTo(bx + Math.cos(a) * l, by + Math.sin(a) * l)
      ctx.stroke()
    }
    ctx.fillStyle = '#e4dccb'
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2a241f'
    ctx.fillRect(x - 3, y - 1.5, 2, 2)
    ctx.fillRect(x + 1, y - 1.5, 2, 2)
  }

  // ---------- indoor maps ----------

  /** Draws floors for every open cell, then thick walls around them. */
  indoor(open: boolean[][], floor: (gx: number, gy: number) => void, wallCol: string, outside = '#1b1714') {
    const { ctx, C } = this
    // Outside: dark rock (or street) with a subtle hatch
    ctx.fillStyle = outside
    ctx.fillRect(0, 0, this.W, this.H)
    ctx.strokeStyle = 'rgba(255,255,255,.035)'
    ctx.lineWidth = 1
    for (let i = -this.H; i < this.W; i += 9) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + this.H, this.H)
      ctx.stroke()
    }
    for (let gy = 0; gy < this.rows; gy++) for (let gx = 0; gx < this.cols; gx++) if (open[gy][gx]) floor(gx, gy)
    const isOpen = (x: number, y: number) => open[y]?.[x] ?? false
    // Soft shadow inside the room along the walls
    const sh = C * 0.45
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        if (!open[gy][gx]) continue
        const x = gx * C
        const y = gy * C
        const sides: [boolean, CanvasGradient, number, number, number, number][] = [
          [!isOpen(gx, gy - 1), ctx.createLinearGradient(0, y, 0, y + sh), x, y, C, sh],
          [!isOpen(gx - 1, gy), ctx.createLinearGradient(x, 0, x + sh, 0), x, y, sh, C],
          [!isOpen(gx + 1, gy), ctx.createLinearGradient(x + C, 0, x + C - sh, 0), x + C - sh, y, sh, C],
          [!isOpen(gx, gy + 1), ctx.createLinearGradient(0, y + C, 0, y + C - sh), x, y + C - sh, C, sh],
        ]
        for (const [wall, g, rx, ry, rw, rh] of sides) {
          if (!wall) continue
          g.addColorStop(0, 'rgba(0,0,0,.45)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.fillRect(rx, ry, rw, rh)
        }
      }
    }
    // Walls: thick strokes on every open/closed edge
    const t = C * 0.22
    ctx.fillStyle = wallCol
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        if (!open[gy][gx]) continue
        const x = gx * C
        const y = gy * C
        if (!isOpen(gx, gy - 1)) ctx.fillRect(x - t, y - t, C + t * 2, t * 1.6)
        if (!isOpen(gx, gy + 1)) ctx.fillRect(x - t, y + C - t * 0.6, C + t * 2, t * 1.6)
        if (!isOpen(gx - 1, gy)) ctx.fillRect(x - t, y - t, t * 1.6, C + t * 2)
        if (!isOpen(gx + 1, gy)) ctx.fillRect(x + C - t * 0.6, y - t, t * 1.6, C + t * 2)
      }
    }
  }

  dungeon() {
    const { C, rng, ctx } = this
    const open = Array.from({ length: this.rows }, () => Array<boolean>(this.cols).fill(false))
    const rooms: { x: number; y: number; w: number; h: number }[] = []
    for (let tries = 0; tries < 200 && rooms.length < Math.round((this.cols * this.rows) / 70); tries++) {
      const w = rng.int(4, 9)
      const h = rng.int(4, 7)
      const x = rng.int(1, this.cols - w - 1)
      const y = rng.int(1, this.rows - h - 1)
      if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue
      rooms.push({ x, y, w, h })
    }
    rooms.sort((a, b) => a.x + a.y - (b.x + b.y))
    this.rooms = rooms.map((r, i) => ({ ...r, label: String(i + 1) }))
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) open[y][x] = true
    const doors: { x: number; y: number; vertical: boolean }[] = []
    const inRoom = (x: number, y: number) => rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1]
      const b = rooms[i]
      const ax = a.x + Math.floor(a.w / 2)
      const ay = a.y + Math.floor(a.h / 2)
      const bx = b.x + Math.floor(b.w / 2)
      const by = b.y + Math.floor(b.h / 2)
      const wide = rng.chance(0.3)
      let prev = true
      const carve = (x: number, y: number, vertical: boolean) => {
        const here = inRoom(x, y)
        if (!here && prev) doors.push({ x, y, vertical })
        prev = here
        open[y][x] = true
        if (wide && !here) open[vertical ? y : Math.min(this.rows - 1, y + 1)][vertical ? Math.min(this.cols - 1, x + 1) : x] = true
      }
      for (let x = ax; x !== bx; x += Math.sign(bx - ax)) carve(x, ay, false)
      for (let y = ay; y !== by + Math.sign(by - ay) || y === ay; y += Math.sign(by - ay) || 1) {
        carve(bx, y, true)
        if (y === by) break
      }
    }
    this.indoor(open, (gx, gy) => this.dungeonTile(gx * C, gy * C), '#0f0c0a')
    for (const d of doors.slice(0, 10)) if (rng.chance(0.7)) this.door(d.x * C, d.y * C, d.vertical)
    // Furnish rooms
    for (const r of rooms) {
      const roll = rng.next()
      const cx = (r.x + r.w / 2) * C
      const cy = (r.y + r.h / 2) * C
      if (roll < 0.3 && r.w >= 6 && r.h >= 5) {
        for (const [px, py] of [[r.x + 1.5, r.y + 1.5], [r.x + r.w - 1.5, r.y + 1.5], [r.x + 1.5, r.y + r.h - 1.5], [r.x + r.w - 1.5, r.y + r.h - 1.5]]) this.pillar(px * C, py * C)
      } else if (roll < 0.5) {
        this.sarcophagus(cx, cy, r.w > r.h)
      } else if (roll < 0.7) {
        for (let i = 0; i < 4; i++) (rng.chance(0.5) ? this.crate : this.barrel).call(this, (r.x + 0.6 + rng.range(0, 1.2)) * C, (r.y + 0.6 + rng.range(0, r.h - 1.2)) * C, rng.range(0, 0.6))
      } else if (roll < 0.85) {
        this.chest(cx, (r.y + 0.75) * C)
      }
      if (rng.chance(0.6)) this.bones((r.x + rng.range(0.6, r.w - 0.6)) * C, (r.y + rng.range(0.6, r.h - 0.6)) * C)
      for (let i = 0; i < 3; i++) this.rock((r.x + rng.range(0.4, r.w - 0.4)) * C, (r.y + rng.range(0.4, r.h - 0.4)) * C, rng.range(3, 6), '#6f675c')
      // Wall torches
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const tx of [r.x + 0.5, r.x + r.w - 0.5]) {
        if (!rng.chance(0.6)) continue
        const g = ctx.createRadialGradient(tx * C, (r.y + 0.3) * C, 0, tx * C, (r.y + 0.3) * C, C * 2.4)
        g.addColorStop(0, 'rgba(255,170,70,.45)')
        g.addColorStop(1, 'rgba(255,140,40,0)')
        ctx.fillStyle = g
        ctx.fillRect((tx - 2.4) * C, (r.y - 2.1) * C, C * 4.8, C * 4.8)
      }
      ctx.restore()
    }
  }

  dungeonTile(x: number, y: number) {
    const { ctx, rng, C } = this
    const base = mix(hex('#6a645b'), hex('#7d766b'), rng.next())
    ctx.fillStyle = rgb(shade(base, 0.6))
    ctx.fillRect(x, y, C, C)
    const half = C / 2
    for (const [ox, oy] of [[0, 0], [half, 0], [0, half], [half, half]]) {
      ctx.fillStyle = rgb(shade(base, rng.range(0.85, 1.1)))
      ctx.fillRect(x + ox + 1, y + oy + 1, half - 2, half - 2)
      ctx.fillStyle = 'rgba(255,255,255,.06)'
      ctx.fillRect(x + ox + 1, y + oy + 1, half - 2, 1.5)
    }
    if (rng.chance(0.15)) {
      ctx.fillStyle = 'rgba(70,90,50,.35)'
      ctx.beginPath()
      ctx.arc(x + rng.range(0, C), y + rng.range(0, C), rng.range(4, 10), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  door(x: number, y: number, vertical: boolean) {
    const { ctx, C } = this
    ctx.save()
    ctx.translate(x + C / 2, y + C / 2)
    if (vertical) ctx.rotate(Math.PI / 2)
    ctx.fillStyle = '#6b4a2a'
    ctx.fillRect(-C * 0.5, -C * 0.14, C, C * 0.28)
    ctx.strokeStyle = '#2b1d10'
    ctx.lineWidth = 2
    ctx.strokeRect(-C * 0.5, -C * 0.14, C, C * 0.28)
    ctx.beginPath()
    ctx.moveTo(0, -C * 0.14)
    ctx.lineTo(0, C * 0.14)
    ctx.stroke()
    ctx.restore()
  }

  sarcophagus(x: number, y: number, horizontal: boolean) {
    const { ctx, C } = this
    ctx.save()
    ctx.translate(x, y)
    if (!horizontal) ctx.rotate(Math.PI / 2)
    this.withShadow(10, 6, 8, 0.6, () => {
      ctx.fillStyle = '#9b958a'
      ctx.beginPath()
      ctx.roundRect(-C, -C * 0.45, C * 2, C * 0.9, 6)
      ctx.fill()
    })
    ctx.fillStyle = '#b8b2a5'
    ctx.beginPath()
    ctx.roundRect(-C * 0.88, -C * 0.33, C * 1.76, C * 0.66, 4)
    ctx.fill()
    ctx.strokeStyle = 'rgba(60,55,48,.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-C * 0.5, 0)
    ctx.lineTo(C * 0.5, 0)
    ctx.moveTo(C * 0.2, -C * 0.2)
    ctx.lineTo(C * 0.2, C * 0.2)
    ctx.stroke()
    ctx.restore()
  }

  crate(x: number, y: number, angle = 0) {
    const { ctx, C } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    const s = C * 0.36
    this.withShadow(6, 4, 5, 0.6, () => {
      ctx.fillStyle = '#8b6338'
      ctx.fillRect(-s, -s, s * 2, s * 2)
    })
    ctx.strokeStyle = '#4a321a'
    ctx.lineWidth = 2.5
    ctx.strokeRect(-s, -s, s * 2, s * 2)
    ctx.beginPath()
    ctx.moveTo(-s, -s)
    ctx.lineTo(s, s)
    ctx.stroke()
    ctx.restore()
  }

  barrel(x: number, y: number) {
    const { ctx, C } = this
    const r = C * 0.3
    this.withShadow(6, 4, 5, 0.6, () => {
      ctx.fillStyle = '#7a5532'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.strokeStyle = '#3a3a3a'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(x, y, r - 1, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(40,25,10,.6)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2)
    ctx.stroke()
  }

  chest(x: number, y: number) {
    const { ctx, C } = this
    this.withShadow(8, 5, 6, 0.6, () => {
      ctx.fillStyle = '#6e4723'
      ctx.fillRect(x - C * 0.42, y - C * 0.26, C * 0.84, C * 0.52)
    })
    ctx.fillStyle = '#c9a227'
    ctx.fillRect(x - C * 0.42, y - C * 0.04, C * 0.84, C * 0.08)
    ctx.fillRect(x - C * 0.06, y - C * 0.1, C * 0.12, C * 0.2)
  }

  tavern() {
    const { C, rng, ctx } = this
    const open = Array.from({ length: this.rows }, (_, y) => Array.from({ length: this.cols }, (_, x) => x >= 1 && y >= 1 && x < this.cols - 1 && y < this.rows - 1))
    // A back room (kitchen/storage) along one side
    const backW = Math.max(5, Math.floor(this.cols * 0.22))
    for (let y = 1; y < this.rows - 1; y++) open[y][this.cols - 1 - backW] = y === Math.floor(this.rows / 2) || y === Math.floor(this.rows / 2) + 1
    this.indoor(open, (gx, gy) => this.plank(gx * C, gy * C, gx >= this.cols - 1 - backW), '#2a1c10')
    // Front door and windows glow
    this.door(Math.floor((this.cols - backW) / 2) * C, (this.rows - 1.5) * C, false)
    const hallW = this.cols - backW - 2
    // Rug
    const rx = (1 + hallW * 0.3) * C
    const ry = this.rows * 0.35 * C
    ctx.fillStyle = '#7a2e2a'
    ctx.fillRect(rx, ry, hallW * 0.4 * C, this.rows * 0.3 * C)
    ctx.strokeStyle = '#c9a227'
    ctx.lineWidth = 3
    ctx.strokeRect(rx + 6, ry + 6, hallW * 0.4 * C - 12, this.rows * 0.3 * C - 12)
    // Bar counter along the back wall of the hall
    const barX = (this.cols - backW - 3.2) * C
    this.withShadow(10, 6, 8, 0.6, () => {
      ctx.fillStyle = '#5a3a1e'
      ctx.fillRect(barX, 2 * C, C * 0.9, (this.rows - 6) * C)
    })
    const bg = ctx.createLinearGradient(barX, 0, barX + C * 0.9, 0)
    bg.addColorStop(0, '#9a6a3a')
    bg.addColorStop(1, '#6a4524')
    ctx.fillStyle = bg
    ctx.fillRect(barX + 3, 2 * C + 3, C * 0.9 - 6, (this.rows - 6) * C - 6)
    for (let y = 2.5; y < this.rows - 4; y += 1.5) this.stool(barX - C * 0.45, y * C)
    for (let y = 2; y < this.rows - 4; y += 2) this.barrel(barX + C * 1.6, (y + 0.5) * C)
    // Fireplace on the left wall
    const fy = this.rows / 2
    ctx.fillStyle = '#4b4540'
    ctx.fillRect(C * 0.6, (fy - 1.2) * C, C * 0.9, C * 2.4)
    ctx.fillStyle = '#1a120c'
    ctx.fillRect(C * 0.8, (fy - 0.8) * C, C * 0.5, C * 1.6)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const fg = ctx.createRadialGradient(C * 1.3, fy * C, 0, C * 1.3, fy * C, C * 3.5)
    fg.addColorStop(0, 'rgba(255,160,60,.55)')
    fg.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = fg
    ctx.fillRect(0, (fy - 3.5) * C, C * 5, C * 7)
    ctx.restore()
    // Tables with chairs
    const spots: Pt[] = []
    for (let y = 2.5; y < this.rows - 2; y += 3.2) for (let x = 3.5; x < hallW - 3; x += 3.6) spots.push({ x: x + rng.range(-0.3, 0.3), y: y + rng.range(-0.3, 0.3) })
    for (const s of spots) {
      if (rng.chance(0.15)) continue
      if (rng.chance(0.65)) this.roundTable(s.x * C, s.y * C)
      else this.longTable(s.x * C, s.y * C)
    }
    // Back room: kitchen/storage clutter
    for (let i = 0; i < 8; i++) {
      const x = (this.cols - backW - 0.3 + rng.range(0.4, backW - 1)) * C
      const y = rng.range(1.6, this.rows - 2) * C
      if (rng.chance(0.5)) this.crate(x, y, rng.range(0, 0.5))
      else this.barrel(x, y)
    }
  }

  // ---------- buildings from the town map ----------

  /** A house, shop or hall: rooms split from the footprint, inner walls with doors, furniture per room. */
  building(kind: string) {
    const { C, rng, ctx } = this
    const labels = ROOM_LABELS[kind as PoiType] ?? ROOM_LABELS.house!
    type R = { x: number; y: number; w: number; h: number; locked?: boolean }
    const foot: R = { x: 1, y: 1, w: this.cols - 2, h: this.rows - 2 }
    const leaves: R[] = [foot]
    const walls: { x0: number; y0: number; x1: number; y1: number; door: number; vertical: boolean }[] = []
    const split = (i: number, ratio: number) => {
      const r = leaves[i]
      const vertical = r.w > r.h * 1.15 ? true : r.h > r.w * 1.15 ? false : rng.chance(0.5)
      const span = vertical ? r.w : r.h
      const at = Math.max(3, Math.min(span - 3, Math.round(span * ratio)))
      if (span < 6) return false
      const a: R = vertical ? { x: r.x, y: r.y, w: at, h: r.h } : { x: r.x, y: r.y, w: r.w, h: at }
      const b: R = vertical ? { x: r.x + at, y: r.y, w: r.w - at, h: r.h } : { x: r.x, y: r.y + at, w: r.w, h: r.h - at }
      leaves.splice(i, 1, a, b)
      const len = vertical ? r.h : r.w
      walls.push(vertical
        ? { x0: r.x + at, y0: r.y, x1: r.x + at, y1: r.y + r.h, door: r.y + rng.int(1, len - 2), vertical }
        : { x0: r.x, y0: r.y + at, x1: r.x + r.w, y1: r.y + at, door: r.x + rng.int(1, len - 2), vertical })
      return true
    }
    // The main room keeps about 60% of the floor; the rest is split into smaller rooms
    if (labels.length > 1 && split(0, rng.chance(0.5) ? 0.6 : 0.4)) {
      const big = leaves[0].w * leaves[0].h >= leaves[1].w * leaves[1].h ? 0 : 1
      leaves[big].locked = true
    }
    while (leaves.length < labels.length) {
      const order = leaves.map((_, i) => i).filter((i) => !leaves[i].locked).sort((a, b) => leaves[b].w * leaves[b].h - leaves[a].w * leaves[a].h)
      if (!order.some((i) => split(i, rng.range(0.38, 0.62)))) break
    }
    const sorted = [...leaves].sort((a, b) => Number(!!b.locked) - Number(!!a.locked) || b.w * b.h - a.w * a.h)
    this.rooms = sorted.map((r, i) => ({ x: r.x, y: r.y, w: r.w, h: r.h, label: labels[i] ?? 'Room' }))

    const stone = ['temple', 'guard', 'bank', 'shrine', 'stables'].includes(kind)
    const open = Array.from({ length: this.rows }, (_, y) => Array.from({ length: this.cols }, (_, x) => x >= foot.x && y >= foot.y && x < foot.x + foot.w && y < foot.y + foot.h))
    this.indoor(open, (gx, gy) => (stone ? this.flagstone(gx * C, gy * C) : this.plank(gx * C, gy * C, false)), '#2a1c10', '#4a4237')

    // Inner walls, leaving a doorway
    const t = C * 0.16
    ctx.fillStyle = '#2a1c10'
    for (const w of walls) {
      if (w.vertical) {
        ctx.fillRect(w.x0 * C - t / 2, w.y0 * C, t, (w.door - w.y0) * C)
        ctx.fillRect(w.x0 * C - t / 2, (w.door + 1) * C, t, (w.y1 - w.door - 1) * C)
      } else {
        ctx.fillRect(w.x0 * C, w.y0 * C - t / 2, (w.door - w.x0) * C, t)
        ctx.fillRect((w.door + 1) * C, w.y0 * C - t / 2, (w.x1 - w.door - 1) * C, t)
      }
    }
    for (const w of walls) {
      if (w.vertical) this.door(w.x0 * C - C / 2, w.door * C, true)
      else this.door(w.door * C, w.y0 * C - C / 2, false)
    }
    // Front door on an outside wall of the main room
    const m = this.rooms[0]
    if (m.y + m.h === foot.y + foot.h) this.door((m.x + Math.floor(m.w / 2)) * C, (m.y + m.h) * C - C / 2, false)
    else if (m.y === foot.y) this.door((m.x + Math.floor(m.w / 2)) * C, m.y * C - C / 2, false)
    else if (m.x === foot.x) this.door(m.x * C - C / 2, (m.y + Math.floor(m.h / 2)) * C, true)
    else this.door((m.x + m.w) * C - C / 2, (m.y + Math.floor(m.h / 2)) * C, true)

    for (const r of this.rooms) this.furnish(r, kind)
  }

  furnish(r: MapRoom, kind: string) {
    const { C, rng } = this
    const L = r.label.toLowerCase()
    const X = (gx: number) => (r.x + gx) * C
    const Y = (gy: number) => (r.y + gy) * C
    const cx = X(r.w / 2)
    const cy = Y(r.h / 2)
    const along = (n: number, fn: (x: number, y: number) => void) => {
      for (let i = 0; i < n; i++) fn(X(rng.range(0.7, r.w - 0.7)), Y(rng.range(0.7, r.h - 0.7)))
    }
    if (/common|great hall|meeting|dining|lounge|waiting/.test(L)) {
      if (r.w >= 6 && r.h >= 5) this.rug(cx - Math.min(4, r.w * 0.3) * C, cy - Math.min(3, r.h * 0.25) * C, Math.min(8, r.w * 0.6) * C, Math.min(6, r.h * 0.5) * C, kind === 'manor' ? '#3b4a7a' : '#7a2e2a')
      if (/great|dining|meeting/.test(L) || kind === 'guild') {
        for (let y = 2; y < r.h - 1.5; y += 3) this.longTable(cx, Y(y))
      } else {
        for (let y = 2; y < r.h - 1.2; y += 3.4) for (let x = 2.4; x < r.w - 2; x += 4) if (rng.chance(0.85)) this.roundTable(X(x + rng.range(-0.3, 0.3)), Y(y + rng.range(-0.3, 0.3)))
      }
      if (kind === 'tavern' || kind === 'inn') this.counter(X(r.w - 0.75), Y(1), (r.h - 2) * C, true)
      this.hearth(X(0.5), cy, true)
    } else if (/kitchen/.test(L)) {
      this.counter(X(1), Y(0.7), (r.w - 2) * C, false)
      this.hearth(cx, Y(r.h - 0.5), false)
      along(2, (x, y) => this.barrel(x, y))
    } else if (/cellar|store|storage|coal|herb|tack|hayloft|records|archive|stock/.test(L)) {
      for (let i = 0; i < Math.min(10, r.w * r.h * 0.35); i++) {
        const x = X(rng.chance(0.5) ? rng.range(0.6, 1.4) : rng.range(r.w - 1.4, r.w - 0.6))
        const y = Y(rng.range(0.6, r.h - 0.6))
        if (/records|archive/.test(L)) break
        if (rng.chance(0.5)) this.crate(x, y, rng.range(0, 0.4))
        else this.barrel(x, y)
      }
      if (/records|archive/.test(L)) for (let y = 1; y < r.h - 0.5; y += 1.8) this.shelf(cx, Y(y), (r.w - 1.6) * C, true)
    } else if (/guest|bedroom|bedchamber|living|quarters|keeper|cell$|barracks/.test(L)) {
      const n = /barracks|servants/.test(L) ? Math.max(2, Math.floor(r.w / 1.6)) : r.w > 4 && /guest/.test(L) ? 2 : 1
      for (let i = 0; i < n; i++) this.bed(X(0.9 + i * 1.6), Y(1.2), /bedchamber/.test(L))
      this.chest(X(r.w - 1), Y(r.h - 0.8))
      if (r.w > 3) this.rug(X(r.w / 2 - 0.8), Y(r.h / 2), C * 1.6, C * 1.2, '#5b4a7a')
    } else if (/reading|stacks|restricted|study|scriptorium|map room/.test(L)) {
      for (let x = 0.8; x < r.w - 0.8; x += 1.6) this.shelf(X(x), Y(0.45), C * 1.4, true)
      for (let y = 0.8; y < r.h - 0.8; y += 1.6) this.shelf(X(0.45), Y(y), C * 1.4, false)
      if (/stacks|restricted/.test(L)) for (let y = 2.2; y < r.h - 1; y += 2) this.shelf(cx, Y(y), (r.w - 3) * C, true)
      else if (/reading/.test(L)) for (let y = 2.6; y < r.h - 1.5; y += 2.8) for (let x = 3; x < r.w - 1.5; x += 3.4) this.desk(X(x), Y(y), '#e8e0c8')
      else this.desk(cx, cy, /map/.test(L) ? '#d9c9a3' : '#e8e0c8')
    } else if (/forge/.test(L)) {
      this.hearth(X(1), Y(1), false)
      this.anvil(cx, cy)
      along(2, (x, y) => this.barrel(x, y))
    } else if (/shop|storefront|showroom|counting/.test(L)) {
      this.counter(X(1), Y(r.h - 1.6), (r.w - 2) * C, false)
      for (let x = 0.8; x < r.w - 0.8; x += 1.6) this.shelf(X(x), Y(0.45), C * 1.4, true)
      if (kind === 'general' || kind === 'blacksmith') along(3, (x, y) => this.crate(x, y, rng.range(0, 0.5)))
    } else if (/laboratory|enchanting/.test(L)) {
      this.desk(cx, cy, '#cfe3d8')
      this.runeCircle(cx, cy, Math.min(r.w, r.h) * C * 0.38, /enchant/.test(L) ? '#8b5cf6' : '#14b8a6')
    } else if (/vault/.test(L)) {
      for (let i = 0; i < Math.max(2, r.w - 1); i++) this.chest(X(0.9 + i * 1.1), Y(0.8))
    } else if (/nave/.test(L)) {
      this.rug(cx - C * 0.7, Y(2), C * 1.4, (r.h - 2.5) * C, '#7a2e2a')
      this.altar(cx, Y(1))
      for (let y = 3; y < r.h - 1; y += 1.3) {
        this.pew(X(r.w / 2 - 1.4), Y(y), C * 2)
        this.pew(X(r.w / 2 + 1.4), Y(y), C * 2)
      }
    } else if (/altar|shrine/.test(L)) {
      this.altar(cx, Y(1))
      this.runeCircle(cx, cy, Math.min(r.w, r.h) * C * 0.32, '#facc15')
    } else if (/armoury/.test(L)) {
      for (let x = 0.8; x < r.w - 0.8; x += 1.6) this.rack(X(x), Y(0.45))
      along(2, (x, y) => this.crate(x, y))
    } else if (/cells/.test(L)) {
      for (let x = 0; x < r.w; x += 2) this.bars(X(x), Y(r.h - 0.6), C * 2)
    } else if (/stalls/.test(L)) {
      for (let x = 1; x < r.w; x += 2) this.hay(X(x), Y(1))
    } else if (/guard room|office|crypt/.test(L)) {
      this.desk(cx, cy, '#e8e0c8')
      if (/office/.test(L)) this.shelf(X(r.w / 2), Y(0.45), C * 2, true)
    } else {
      along(3, (x, y) => (rng.chance(0.5) ? this.crate(x, y) : this.barrel(x, y)))
    }
  }

  rug(x: number, y: number, w: number, h: number, col: string) {
    const { ctx } = this
    if (w <= 0 || h <= 0) return
    ctx.fillStyle = col
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = '#c9a227'
    ctx.lineWidth = 2.5
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10)
  }

  counter(x: number, y: number, len: number, vertical: boolean) {
    const { ctx, C } = this
    const w = vertical ? C * 0.8 : len
    const h = vertical ? len : C * 0.8
    const x0 = vertical ? x - w / 2 : x
    this.withShadow(8, 5, 6, 0.55, () => {
      ctx.fillStyle = '#5a3a1e'
      ctx.fillRect(x0, y, w, h)
    })
    ctx.fillStyle = '#8a5d33'
    ctx.fillRect(x0 + 3, y + 3, w - 6, h - 6)
  }

  hearth(x: number, y: number, vertical: boolean) {
    const { ctx, C } = this
    const w = vertical ? C * 0.9 : C * 2
    const h = vertical ? C * 2 : C * 0.9
    ctx.fillStyle = '#4b4540'
    ctx.fillRect(x - w / 2, y - h / 2, w, h)
    ctx.fillStyle = '#1a120c'
    ctx.fillRect(x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(x, y, 0, x, y, C * 2.6)
    g.addColorStop(0, 'rgba(255,160,60,.5)')
    g.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - C * 2.6, y - C * 2.6, C * 5.2, C * 5.2)
    ctx.restore()
  }

  bed(x: number, y: number, grand: boolean) {
    const { ctx, C } = this
    const w = C * (grand ? 1.6 : 0.95)
    const h = C * 1.8
    this.withShadow(8, 5, 6, 0.5, () => {
      ctx.fillStyle = '#5a3a1e'
      ctx.fillRect(x - w / 2, y - C * 0.6, w, h)
    })
    ctx.fillStyle = grand ? '#7a2e3a' : '#6b7a8f'
    ctx.fillRect(x - w / 2 + 3, y - C * 0.6 + C * 0.5, w - 6, h - C * 0.5 - 3)
    ctx.fillStyle = '#eee6d2'
    ctx.fillRect(x - w / 2 + 5, y - C * 0.6 + 5, w - 10, C * 0.36)
  }

  shelf(x: number, y: number, len: number, horizontal: boolean) {
    const { ctx, C, rng } = this
    const w = horizontal ? len : C * 0.5
    const h = horizontal ? C * 0.5 : len
    ctx.fillStyle = '#3e2a17'
    ctx.fillRect(x - w / 2, y - h / 2, w, h)
    const books = ['#7a2e2a', '#2e4a7a', '#4a6a2e', '#8a6a2a', '#5a2e6a', '#2e6a6a']
    const n = Math.floor((horizontal ? w : h) / 6)
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rng.pick(books)
      if (horizontal) ctx.fillRect(x - w / 2 + 3 + i * 6, y - h / 2 + 4, 4.5, h - 8)
      else ctx.fillRect(x - w / 2 + 4, y - h / 2 + 3 + i * 6, w - 8, 4.5)
    }
  }

  desk(x: number, y: number, paper: string) {
    const { ctx, C, rng } = this
    this.withShadow(8, 5, 6, 0.55, () => {
      ctx.fillStyle = '#6e4a27'
      ctx.fillRect(x - C * 0.9, y - C * 0.45, C * 1.8, C * 0.9)
    })
    ctx.fillStyle = paper
    for (let i = 0; i < 3; i++) ctx.fillRect(x + rng.range(-C * 0.7, C * 0.3), y + rng.range(-C * 0.35, C * 0.05), C * 0.3, C * 0.35)
    this.stool(x, y + C * 0.8)
  }

  anvil(x: number, y: number) {
    const { ctx, C } = this
    this.withShadow(8, 5, 6, 0.6, () => {
      ctx.fillStyle = '#3d3d3d'
      ctx.beginPath()
      ctx.moveTo(x - C * 0.5, y - C * 0.2)
      ctx.lineTo(x + C * 0.3, y - C * 0.2)
      ctx.lineTo(x + C * 0.55, y)
      ctx.lineTo(x + C * 0.3, y + C * 0.2)
      ctx.lineTo(x - C * 0.5, y + C * 0.2)
      ctx.closePath()
      ctx.fill()
    })
    ctx.fillStyle = 'rgba(255,255,255,.15)'
    ctx.fillRect(x - C * 0.45, y - C * 0.15, C * 0.7, C * 0.08)
  }

  runeCircle(x: number, y: number, r: number, col: string) {
    const { ctx } = this
    ctx.save()
    ctx.strokeStyle = col
    ctx.globalAlpha = 0.6
    ctx.lineWidth = 2
    for (const k of [1, 0.8]) {
      ctx.beginPath()
      ctx.arc(x, y, r * k, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5
      const px = x + Math.cos(a) * r * 0.8
      const py = y + Math.sin(a) * r * 0.8
      if (i) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    }
    ctx.stroke()
    ctx.restore()
  }

  pew(x: number, y: number, len: number) {
    const { ctx, C } = this
    ctx.fillStyle = '#5c3d20'
    ctx.fillRect(x - len / 2, y - C * 0.18, len, C * 0.36)
    ctx.fillStyle = 'rgba(255,255,255,.08)'
    ctx.fillRect(x - len / 2, y - C * 0.18, len, 2)
  }

  altar(x: number, y: number) {
    const { ctx, C } = this
    this.withShadow(10, 6, 8, 0.6, () => {
      ctx.fillStyle = '#d6d0c2'
      ctx.fillRect(x - C, y - C * 0.4, C * 2, C * 0.8)
    })
    ctx.fillStyle = '#c9a227'
    ctx.fillRect(x - C * 0.08, y - C * 0.3, C * 0.16, C * 0.6)
    ctx.fillRect(x - C * 0.25, y - C * 0.12, C * 0.5, C * 0.14)
  }

  rack(x: number, y: number) {
    const { ctx, C } = this
    ctx.fillStyle = '#3e2a17'
    ctx.fillRect(x - C * 0.7, y - C * 0.2, C * 1.4, C * 0.4)
    ctx.strokeStyle = '#b8b8b8'
    ctx.lineWidth = 2
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(x + i * C * 0.25, y - C * 0.35)
      ctx.lineTo(x + i * C * 0.25, y + C * 0.35)
      ctx.stroke()
    }
  }

  bars(x: number, y: number, len: number) {
    const { ctx } = this
    ctx.strokeStyle = '#6b6b6b'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y)
    ctx.stroke()
    ctx.lineWidth = 2
    for (let i = 4; i < len; i += 9) {
      ctx.beginPath()
      ctx.arc(x + i, y, 2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  hay(x: number, y: number) {
    const { ctx, C, rng } = this
    ctx.strokeStyle = '#d8b84a'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 26; i++) {
      const a = rng.range(0, Math.PI)
      const px = x + rng.range(-C * 0.6, C * 0.6)
      const py = y + rng.range(-C * 0.5, C * 0.5)
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + Math.cos(a) * 8, py + Math.sin(a) * 8)
      ctx.stroke()
    }
  }

  plank(x: number, y: number, dark: boolean) {
    const { ctx, rng, C } = this
    const base = dark ? hex('#5c4a38') : hex('#8a6440')
    const rowsPer = 4
    for (let r = 0; r < rowsPer; r++) {
      const h = C / rowsPer
      ctx.fillStyle = rgb(shade(base, rng.range(0.85, 1.1)))
      ctx.fillRect(x, y + r * h, C, h - 1)
      ctx.fillStyle = 'rgba(30,18,8,.35)'
      ctx.fillRect(x, y + r * h + h - 1, C, 1)
      if (rng.chance(0.3)) ctx.fillRect(x + rng.range(4, C - 4), y + r * h, 1.2, h - 1)
    }
  }

  stool(x: number, y: number) {
    const { ctx, C } = this
    this.withShadow(4, 3, 3, 0.5, () => {
      ctx.fillStyle = '#7a5532'
      ctx.beginPath()
      ctx.arc(x, y, C * 0.17, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  roundTable(x: number, y: number) {
    const { ctx, C, rng } = this
    const n = rng.int(3, 5)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2)
      this.stool(x + Math.cos(a) * C * 0.85, y + Math.sin(a) * C * 0.85)
    }
    this.withShadow(10, 6, 8, 0.6, () => {
      ctx.fillStyle = '#6a4524'
      ctx.beginPath()
      ctx.arc(x, y, C * 0.55, 0, Math.PI * 2)
      ctx.fill()
    })
    const g = ctx.createRadialGradient(x - C * 0.15, y - C * 0.15, 2, x, y, C * 0.55)
    g.addColorStop(0, '#a87a48')
    g.addColorStop(1, '#6e4a27')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, C * 0.5, 0, Math.PI * 2)
    ctx.fill()
    // Mugs and a candle
    ctx.fillStyle = '#d9c9a3'
    for (let i = 0; i < 2; i++) {
      ctx.beginPath()
      ctx.arc(x + rng.range(-C * 0.25, C * 0.25), y + rng.range(-C * 0.25, C * 0.25), 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  longTable(x: number, y: number) {
    const { ctx, C } = this
    const w = C * 2.2
    const h = C * 0.8
    for (const dy of [-h * 0.85, h * 0.85]) {
      ctx.fillStyle = '#5c3d20'
      ctx.fillRect(x - w / 2, y + dy - C * 0.12, w, C * 0.24)
    }
    this.withShadow(10, 6, 8, 0.6, () => {
      ctx.fillStyle = '#7d5530'
      ctx.fillRect(x - w / 2, y - h / 2, w, h)
    })
    ctx.strokeStyle = 'rgba(40,25,10,.4)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(x - w / 2, y - h / 2 + (i * h) / 4)
      ctx.lineTo(x + w / 2, y - h / 2 + (i * h) / 4)
      ctx.stroke()
    }
  }

  vignette() {
    const { ctx } = this
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.45, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,.35)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.W, this.H)
  }
}
