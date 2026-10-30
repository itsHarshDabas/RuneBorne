import { createNoise2D } from 'simplex-noise'
import { makeRng } from '../world/random'
import { pathFrom, type P } from './geom'
import type { Hit, Scene, ViewInfo } from './MapCanvas'
import { ATLAS_H, ATLAS_W, BIOMES, type Atlas, type Burg } from './worldgen'

// Paints the continent: a raster for soft things (biomes, hill shading, sea depth) and
// vector layers for everything that should stay sharp when zoomed (coast, rivers, roads, relief, labels).

const SCALE = 2
const INK = '#3d3428'
const PAPER = '#efe4c8'
const SEA = '#5f87a0'
const SEA_DEEP = '#4a7189'
const RIVER = '#5d8aa6'

type Icon = { x: number; y: number; s: number; kind: 'mount' | 'snow' | 'hill' | 'tree' | 'pine' | 'palm' | 'dune' | 'reed' }

export type AtlasArt = {
  base: HTMLCanvasElement
  relief: HTMLCanvasElement
  icons: Icon[]
  land: Path2D
  lakes: Path2D
  rivers: Path2D[]
  realms: Path2D[]
  borders: Path2D
  roads: Path2D
  trails: Path2D
}

const artCache = new Map<number, AtlasArt>()

export function atlasArt(a: Atlas): AtlasArt {
  const hit = artCache.get(a.seed)
  if (hit) return hit
  const art = paint(a)
  artCache.set(a.seed, art)
  return art
}

function riverPolygon(points: P[], widths: number[]): P[] {
  const left: P[] = []
  const right: P[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const w = widths[i] / 2
    left.push([points[i][0] - (dy / len) * w, points[i][1] + (dx / len) * w])
    right.push([points[i][0] + (dy / len) * w, points[i][1] - (dx / len) * w])
  }
  return [...left, ...right.reverse()]
}

function reliefIcons(a: Atlas): Icon[] {
  const rng = makeRng(`${a.seed}:relief`)
  const icons: Icon[] = []
  const cell = 6
  const grid = new Map<string, Icon[]>()
  const free = (x: number, y: number, r: number) => {
    const gx = Math.floor(x / cell)
    const gy = Math.floor(y / cell)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      for (const o of grid.get(`${gx + dx},${gy + dy}`) ?? []) if (Math.hypot(o.x - x, (o.y - y) * 1.4) < (o.s + r) * 0.62) return false
    }
    return true
  }
  const put = (ic: Icon) => {
    const k = `${Math.floor(ic.x / cell)},${Math.floor(ic.y / cell)}`
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k)!.push(ic)
    icons.push(ic)
  }
  const spacing = Math.sqrt((ATLAS_W * ATLAS_H) / a.n)
  // Mountains first (biggest), then forests fill around them
  const order = [...Array(a.n).keys()].filter((i) => a.water[i] === 0).sort((p, q) => a.height[q] - a.height[p])
  for (const i of order) {
    const h = a.height[i]
    const b = a.biomeOf(i)
    const tries: { kind: Icon['kind']; s: number; count: number; p: number }[] = []
    if (h > 0.66) tries.push({ kind: h > 0.8 || b === 'glacier' ? 'snow' : 'mount', s: 6 + (h - 0.66) * 34, count: 1, p: 0.55 + (h - 0.66) * 2 })
    else if (h > 0.54) tries.push({ kind: 'hill', s: 3.6 + (h - 0.54) * 12, count: 1, p: 0.55 })
    if (a.riverCell[i] && b !== 'swamp') continue
    switch (b) {
      case 'forest': tries.push({ kind: 'tree', s: 2.6, count: 4, p: 0.85 }); break
      case 'rainforest': tries.push({ kind: 'tree', s: 2.9, count: 5, p: 0.95 }); break
      case 'taiga': tries.push({ kind: 'pine', s: 2.7, count: 4, p: 0.85 }); break
      case 'jungle': tries.push({ kind: 'palm', s: 2.8, count: 5, p: 0.9 }); break
      case 'savanna': tries.push({ kind: 'tree', s: 2.2, count: 1, p: 0.25 }); break
      case 'swamp': tries.push({ kind: 'reed', s: 2.2, count: 3, p: 0.8 }); break
      case 'desert': tries.push({ kind: 'dune', s: 3.4, count: 1, p: 0.45 }); break
      case 'tundra': tries.push({ kind: 'pine', s: 2.2, count: 1, p: 0.15 }); break
      case 'grassland': tries.push({ kind: 'tree', s: 2.2, count: 1, p: 0.1 }); break
    }
    for (const t of tries) {
      for (let c = 0; c < t.count; c++) {
        if (!rng.chance(t.p)) continue
        const x = a.x[i] + rng.range(-0.5, 0.5) * spacing
        const y = a.y[i] + rng.range(-0.5, 0.5) * spacing
        const s = t.s * rng.range(0.85, 1.15)
        if (a.water[a.cellAt(x, y)] !== 0) continue
        if (!free(x, y, s)) continue
        put({ x, y, s, kind: t.kind })
      }
    }
  }
  // Keep towns readable
  const clear = icons.filter((ic) => !a.burgs.some((b) => Math.hypot(b.x - ic.x, b.y - ic.y) < (b.type === 'village' ? 4 : 7)))
  return clear.sort((p, q) => p.y - q.y)
}

export function drawIcon(ctx: CanvasRenderingContext2D, ic: Icon, lw: number) {
  const { x, y, s } = ic
  ctx.lineWidth = lw
  ctx.strokeStyle = INK
  switch (ic.kind) {
    case 'mount':
    case 'snow': {
      const peakX = x + s * 0.08
      const peakY = y - s * 1.15
      const ridgeX = x + s * 0.22
      ctx.beginPath()
      ctx.moveTo(x - s, y)
      ctx.lineTo(peakX, peakY)
      ctx.lineTo(ridgeX, y)
      ctx.closePath()
      ctx.fillStyle = '#e9e0c9'
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(peakX, peakY)
      ctx.lineTo(x + s, y)
      ctx.lineTo(ridgeX, y)
      ctx.closePath()
      ctx.fillStyle = '#a2967c'
      ctx.fill()
      if (ic.kind === 'snow') {
        ctx.beginPath()
        ctx.moveTo(peakX - s * 0.34, peakY + s * 0.4)
        ctx.lineTo(peakX, peakY)
        ctx.lineTo(peakX + s * 0.32, peakY + s * 0.36)
        ctx.lineTo(peakX + s * 0.05, peakY + s * 0.5)
        ctx.closePath()
        ctx.fillStyle = '#fbfaf5'
        ctx.fill()
      }
      ctx.beginPath()
      ctx.moveTo(x - s, y)
      ctx.lineTo(peakX, peakY)
      ctx.lineTo(x + s, y)
      ctx.moveTo(peakX, peakY)
      ctx.lineTo(ridgeX, y - s * 0.15)
      ctx.stroke()
      // Hatching on the shaded side
      ctx.lineWidth = lw * 0.6
      ctx.beginPath()
      for (let k = 1; k <= 3; k++) {
        const t = k / 4
        ctx.moveTo(peakX + (x + s - peakX) * t, peakY + (y - peakY) * t)
        ctx.lineTo(peakX + (x + s - peakX) * t - s * 0.18, peakY + (y - peakY) * t + s * 0.28)
      }
      ctx.stroke()
      break
    }
    case 'hill': {
      ctx.beginPath()
      ctx.moveTo(x - s, y)
      ctx.quadraticCurveTo(x - s * 0.1, y - s * 1.1, x + s, y)
      ctx.fillStyle = '#d9cfae'
      ctx.fill()
      ctx.stroke()
      ctx.lineWidth = lw * 0.6
      ctx.beginPath()
      ctx.moveTo(x + s * 0.2, y - s * 0.35)
      ctx.lineTo(x + s * 0.35, y - s * 0.05)
      ctx.moveTo(x + s * 0.5, y - s * 0.25)
      ctx.lineTo(x + s * 0.62, y - s * 0.02)
      ctx.stroke()
      break
    }
    case 'tree':
    case 'palm': {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y - s * 0.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(x, y - s * 1.05, s * 0.7, s * 0.62, 0, 0, Math.PI * 2)
      ctx.fillStyle = ic.kind === 'palm' ? '#5f8a46' : '#7f9b5b'
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(x - s * 0.22, y - s * 1.22, s * 0.25, s * 0.18, -0.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,230,.35)'
      ctx.fill()
      break
    }
    case 'pine': {
      ctx.beginPath()
      ctx.moveTo(x, y - s * 1.7)
      ctx.lineTo(x + s * 0.6, y - s * 0.2)
      ctx.lineTo(x - s * 0.6, y - s * 0.2)
      ctx.closePath()
      ctx.fillStyle = '#5e7a50'
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, y - s * 0.2)
      ctx.lineTo(x, y)
      ctx.stroke()
      break
    }
    case 'dune': {
      ctx.strokeStyle = '#a58f5c'
      ctx.beginPath()
      ctx.moveTo(x - s, y)
      ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.7, x + s, y - s * 0.1)
      ctx.stroke()
      break
    }
    case 'reed': {
      ctx.strokeStyle = '#4f5f3c'
      ctx.beginPath()
      for (const dx of [-0.5, 0, 0.5]) {
        ctx.moveTo(x + dx * s, y)
        ctx.lineTo(x + dx * s * 1.3, y - s * (dx === 0 ? 1.2 : 0.85))
      }
      ctx.moveTo(x - s * 0.8, y)
      ctx.lineTo(x + s * 0.8, y)
      ctx.stroke()
      break
    }
  }
}

function paint(a: Atlas): AtlasArt {
  const W = ATLAS_W * SCALE
  const H = ATLAS_H * SCALE
  const base = document.createElement('canvas')
  base.width = W
  base.height = H
  const ctx = base.getContext('2d')!
  ctx.scale(SCALE, SCALE)

  const land = new Path2D()
  for (const loop of a.coasts) land.addPath(pathFrom(loop, true))
  const lakes = new Path2D()
  for (const loop of a.lakes) lakes.addPath(pathFrom(loop, true))

  // Sea with depth rings around every coast
  const g = ctx.createRadialGradient(ATLAS_W / 2, ATLAS_H / 2, 100, ATLAS_W / 2, ATLAS_H / 2, ATLAS_W * 0.7)
  g.addColorStop(0, SEA)
  g.addColorStop(1, SEA_DEEP)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H)
  ctx.lineJoin = 'round'
  const rings: [number, string][] = [[70, 'rgba(120,160,180,.10)'], [46, 'rgba(130,170,188,.14)'], [28, 'rgba(140,180,195,.18)'], [14, 'rgba(160,195,205,.25)'], [6, 'rgba(185,212,215,.35)']]
  for (const [w, c] of rings) {
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.stroke(land)
  }
  // Thin contour lines following the coast
  for (const w of [22, 40]) {
    ctx.strokeStyle = 'rgba(40,70,90,.28)'
    ctx.lineWidth = w
    ctx.stroke(land)
    ctx.strokeStyle = g
    ctx.lineWidth = w - 0.9
    ctx.stroke(land)
  }
  // Re-lay the shallow rings over the masking strokes
  for (const [w, c] of rings.slice(2)) {
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.stroke(land)
  }

  // Land: biome colours per cell, softened, clipped to the smooth coastline
  const voronoi = a.delaunay.voronoi([0, 0, ATLAS_W, ATLAS_H])
  const biomeCanvas = document.createElement('canvas')
  biomeCanvas.width = W
  biomeCanvas.height = H
  const bctx = biomeCanvas.getContext('2d')!
  bctx.scale(SCALE, SCALE)
  const jitter = makeRng(`${a.seed}:tint`)
  for (let i = 0; i < a.n; i++) {
    const poly = voronoi.cellPolygon(i)
    if (!poly) continue
    // Ocean cells next to land take the land colour so the blur doesn't bleed blue into beaches
    let id = a.biomeOf(i)
    if (a.water[i] === 1) {
      const nb = a.neighbors[i].find((j) => a.water[j] === 0)
      if (nb === undefined) continue
      id = a.biomeOf(nb)
    }
    const hex = BIOMES[id].color
    const k = 1 + jitter.range(-0.035, 0.035)
    const r = parseInt(hex.slice(1, 3), 16) * k
    const gg = parseInt(hex.slice(3, 5), 16) * k
    const b = parseInt(hex.slice(5, 7), 16) * k
    bctx.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`
    bctx.beginPath()
    poly.forEach(([px, py], j) => (j ? bctx.lineTo(px, py) : bctx.moveTo(px, py)))
    bctx.fill()
    bctx.strokeStyle = bctx.fillStyle
    bctx.lineWidth = 0.6
    bctx.stroke()
  }
  ctx.save()
  ctx.clip(land)
  ctx.filter = 'blur(6px)'
  ctx.drawImage(biomeCanvas, 0, 0, ATLAS_W, ATLAS_H)
  ctx.filter = 'none'

  // Hill shading from a blurred height raster, lit from the north-west
  const HS = 0.5
  const hw = Math.round(ATLAS_W * HS)
  const hh = Math.round(ATLAS_H * HS)
  const hc = document.createElement('canvas')
  hc.width = hw
  hc.height = hh
  const hctx = hc.getContext('2d')!
  hctx.scale(HS, HS)
  for (let i = 0; i < a.n; i++) {
    const poly = voronoi.cellPolygon(i)
    if (!poly) continue
    const v = Math.round(Math.max(0, a.height[i]) * 255)
    hctx.fillStyle = `rgb(${v},${v},${v})`
    hctx.beginPath()
    poly.forEach(([px, py], j) => (j ? hctx.lineTo(px, py) : hctx.moveTo(px, py)))
    hctx.fill()
  }
  const blurred = document.createElement('canvas')
  blurred.width = hw
  blurred.height = hh
  const blctx = blurred.getContext('2d')!
  blctx.filter = 'blur(3px)'
  blctx.drawImage(hc, 0, 0)
  const hd = blctx.getImageData(0, 0, hw, hh).data
  const shadeImg = blctx.createImageData(hw, hh)
  const nz = createNoise2D(makeRng(`${a.seed}:shade`).next)
  for (let py = 1; py < hh - 1; py++) {
    for (let px = 1; px < hw - 1; px++) {
      const nw = hd[((py - 1) * hw + (px - 1)) * 4]
      const se = hd[((py + 1) * hw + (px + 1)) * 4]
      const e = hd[(py * hw + px) * 4] / 255
      // Steeper shading higher up, plus a little noise so slopes look rough
      const v = ((nw - se) / 255) * (1.5 + e * e * 22) + nz(px / 6, py / 6) * 0.03 * e
      const i = (py * hw + px) * 4
      if (v > 0) {
        shadeImg.data[i] = 255
        shadeImg.data[i + 1] = 250
        shadeImg.data[i + 2] = 235
        shadeImg.data[i + 3] = Math.min(110, v * 260)
      } else {
        shadeImg.data[i] = 40
        shadeImg.data[i + 1] = 30
        shadeImg.data[i + 2] = 20
        shadeImg.data[i + 3] = Math.min(150, -v * 330)
      }
    }
  }
  blctx.filter = 'none'
  blctx.putImageData(shadeImg, 0, 0)
  ctx.drawImage(blurred, 0, 0, ATLAS_W, ATLAS_H)
  // Inner glow along the shore
  ctx.strokeStyle = 'rgba(245,235,200,.45)'
  ctx.lineWidth = 3
  ctx.stroke(land)
  ctx.restore()

  // Paper grain over everything
  const grain = document.createElement('canvas')
  grain.width = 256
  grain.height = 256
  const gctx = grain.getContext('2d')!
  const gi = gctx.createImageData(256, 256)
  const gr = makeRng(`${a.seed}:grain`)
  for (let i = 0; i < gi.data.length; i += 4) {
    const v = gr.int(0, 255)
    gi.data[i] = v
    gi.data[i + 1] = v
    gi.data[i + 2] = v
    gi.data[i + 3] = 14
  }
  gctx.putImageData(gi, 0, 0)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = ctx.createPattern(grain, 'repeat')!
  ctx.fillRect(0, 0, W, H)
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(20,15,5,.35)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // Relief layer, drawn separately so it can switch to sharp vectors when zoomed in
  const icons = reliefIcons(a)
  const relief = document.createElement('canvas')
  relief.width = W
  relief.height = H
  const rctx = relief.getContext('2d')!
  rctx.scale(SCALE, SCALE)
  rctx.lineJoin = 'round'
  rctx.lineCap = 'round'
  for (const ic of icons) drawIcon(rctx, ic, 0.45)

  const rivers = a.rivers.map((r) => pathFrom(riverPolygon(r.points, r.widths), true))
  const realms = a.realmShapes.map((loops) => {
    const p = new Path2D()
    for (const l of loops) p.addPath(pathFrom(l, true))
    return p
  })
  const borders = new Path2D()
  for (const b of a.borders) borders.addPath(pathFrom(b, false))
  const roads = new Path2D()
  const trails = new Path2D()
  for (const r of a.roads) (r.kind === 'road' ? roads : trails).addPath(pathFrom(r.points, false))
  return { base, relief, icons, land, lakes, rivers, realms, borders, roads, trails }
}

export type AtlasOverlay = {
  selected: string | null
  names: Record<string, string>
  states: Record<string, string>
  showRealms: boolean
}

const BURG_R: Record<Burg['type'], number> = { capital: 6, city: 4.6, town: 3.4, village: 2.3 }
const STATE_COLOR: Record<string, string> = { Closed: '#94a3b8', Occupied: '#ef4444', Abandoned: '#78716c', Destroyed: '#1c1917', Cleared: '#4ade80', Hidden: '#a78bfa' }

/** Zoom (relative to fitting the whole map) above which relief is drawn as sharp vectors. */
const VECTOR_RELIEF = 2.4

export function atlasScene(a: Atlas, art: AtlasArt, o: AtlasOverlay): Scene {
  const nameOf = (id: string, fallback: string) => o.names[id] ?? fallback
  return {
    key: `atlas:${a.seed}`,
    width: ATLAS_W,
    height: ATLAS_H,
    background: SEA_DEEP,
    maxZoom: 16,
    base: art.base,
    drawWorld(ctx, v) {
      const px = 1 / v.k
      if (o.showRealms) {
        ctx.globalAlpha = 0.1
        art.realms.forEach((p, i) => {
          ctx.fillStyle = a.realms[i].color
          ctx.fill(p)
        })
        ctx.globalAlpha = 1
      }
      // Coastline and lakes
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = INK
      ctx.lineWidth = Math.max(0.35, 1.3 * px)
      ctx.stroke(art.land)
      ctx.fillStyle = '#6f97ad'
      ctx.fill(art.lakes)
      ctx.lineWidth = Math.max(0.3, 1 * px)
      ctx.stroke(art.lakes)
      // Rivers
      ctx.fillStyle = RIVER
      for (const r of art.rivers) ctx.fill(r)
      ctx.strokeStyle = 'rgba(40,70,90,.5)'
      ctx.lineWidth = 0.6 * px
      for (const r of art.rivers) ctx.stroke(r)
      // Relief: raster when zoomed out, crisp vectors when zoomed in
      if (v.zoom < VECTOR_RELIEF) {
        ctx.drawImage(art.relief, 0, 0, ATLAS_W, ATLAS_H)
      } else {
        const x0 = -v.ox / v.k - 12
        const y0 = -v.oy / v.k - 12
        const x1 = x0 + v.w / v.k + 24
        const y1 = y0 + v.h / v.k + 24
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        for (const ic of art.icons) if (ic.x > x0 && ic.x < x1 && ic.y > y0 && ic.y < y1) drawIcon(ctx, ic, Math.max(0.2, 0.45 - (v.zoom - VECTOR_RELIEF) * 0.02))
      }
      // Realms
      if (o.showRealms) {
        ctx.setLineDash([5 * px, 3 * px])
        ctx.strokeStyle = 'rgba(110,30,30,.75)'
        ctx.lineWidth = 1.6 * px
        ctx.stroke(art.borders)
        ctx.setLineDash([])
      }
      // Roads
      ctx.strokeStyle = 'rgba(90,60,35,.85)'
      ctx.lineWidth = 1.3 * px
      ctx.setLineDash([4 * px, 2.5 * px])
      ctx.stroke(art.roads)
      if (v.zoom > 1.6) {
        ctx.lineWidth = 1 * px
        ctx.setLineDash([1.5 * px, 2.5 * px])
        ctx.stroke(art.trails)
      }
      ctx.setLineDash([])
    },
    drawScreen(ctx, v, toScreen) {
      const z = v.zoom
      const placed: [number, number, number, number][] = []
      const fits = (x: number, y: number, w: number, h: number) => {
        if (placed.some(([px, py, pw, ph]) => x < px + pw && x + w > px && y < py + ph && y + h > py)) return false
        placed.push([x, y, w, h])
        return true
      }
      const label = (text: string, x: number, y: number, font: string, fill: string, halo = PAPER, haloW = 3) => {
        ctx.font = font
        const w = ctx.measureText(text).width
        if (!fits(x - w / 2 - 2, y - 11, w + 4, 14)) return
        ctx.lineJoin = 'round'
        ctx.strokeStyle = halo
        ctx.lineWidth = haloW
        ctx.strokeText(text, x, y)
        ctx.fillStyle = fill
        ctx.fillText(text, x, y)
      }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'

      // Markers first (so labels can avoid them), most important first
      const order: Record<Burg['type'], number> = { capital: 0, city: 1, town: 2, village: 3 }
      const visible = a.burgs.filter((b) => b.type === 'capital' || (b.type === 'city' && z > 1.15) || (b.type === 'town' && z > 1.8) || (b.type === 'village' && z > 3.2) || o.selected === b.id)
      visible.sort((p, q) => order[p.type] - order[q.type])
      for (const b of visible) {
        const [sx, sy] = toScreen(b.x, b.y)
        if (sx < -40 || sy < -40 || sx > v.w + 40 || sy > v.h + 40) continue
        const r = BURG_R[b.type] * Math.min(1.8, 0.85 + z * 0.07)
        const st = o.states[b.id]
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = st === 'Destroyed' ? '#57534e' : b.type === 'village' ? INK : PAPER
        ctx.fill()
        ctx.lineWidth = b.type === 'capital' ? 2 : 1.5
        ctx.strokeStyle = STATE_COLOR[st ?? ''] ?? INK
        ctx.stroke()
        if (b.type === 'capital') {
          ctx.beginPath()
          ctx.arc(sx, sy, r * 0.42, 0, Math.PI * 2)
          ctx.fillStyle = INK
          ctx.fill()
        }
        if (o.selected === b.id) {
          ctx.beginPath()
          ctx.arc(sx, sy, r + 5, 0, Math.PI * 2)
          ctx.strokeStyle = '#d4a24c'
          ctx.lineWidth = 2.5
          ctx.stroke()
        }
        placed.push([sx - r, sy - r, r * 2, r * 2])
      }
      if (z > 2.2 || o.selected?.startsWith('s')) {
        for (const s of a.sites) {
          if (z <= 2.2 && o.selected !== s.id) continue
          const [sx, sy] = toScreen(s.x, s.y)
          if (sx < -20 || sy < -20 || sx > v.w + 20 || sy > v.h + 20) continue
          const r = 4.5
          ctx.beginPath()
          ctx.moveTo(sx, sy - r)
          ctx.lineTo(sx + r, sy)
          ctx.lineTo(sx, sy + r)
          ctx.lineTo(sx - r, sy)
          ctx.closePath()
          ctx.fillStyle = STATE_COLOR[o.states[s.id] ?? ''] ?? '#7f1d1d'
          ctx.fill()
          ctx.strokeStyle = PAPER
          ctx.lineWidth = 1.2
          ctx.stroke()
          if (o.selected === s.id) {
            ctx.beginPath()
            ctx.arc(sx, sy, r + 5, 0, Math.PI * 2)
            ctx.strokeStyle = '#d4a24c'
            ctx.lineWidth = 2.5
            ctx.stroke()
          }
          if (z > 3.5 || o.selected === s.id) label(nameOf(s.id, s.name), sx, sy - 9, 'italic 600 11px Inter, sans-serif', '#5b1d1d')
        }
      }

      // Realm names, fading out as you zoom in
      if (o.showRealms && z < 3) {
        ctx.globalAlpha = Math.min(1, (3 - z) / 1.2) * 0.75
        for (const r of a.realms) {
          const [sx, sy] = toScreen(r.labelX, r.labelY)
          const size = Math.max(12, Math.min(26, Math.sqrt(r.cells) * 0.55)) * Math.min(1.5, 0.8 + z * 0.25)
          const text = nameOf(`realm${r.id}`, r.name).toUpperCase()
          ctx.font = `700 ${size}px Cinzel, Georgia, serif`
          ctx.letterSpacing = `${size * 0.18}px`
          label(text, sx, sy, ctx.font, '#5a2d22', 'rgba(239,228,200,.6)', 4)
          ctx.letterSpacing = '0px'
        }
        ctx.globalAlpha = 1
      }

      for (const b of visible) {
        const [sx, sy] = toScreen(b.x, b.y)
        if (sx < -60 || sy < -40 || sx > v.w + 60 || sy > v.h + 40) continue
        const name = nameOf(b.id, b.name)
        const font = b.type === 'capital' ? '700 14px Cinzel, Georgia, serif' : b.type === 'city' ? '700 12.5px Cinzel, Georgia, serif' : b.type === 'town' ? '600 11.5px Inter, sans-serif' : '500 10.5px Inter, sans-serif'
        label(name, sx, sy - BURG_R[b.type] - 6, font, INK)
      }
    },
    hit(x, y, v) {
      const tol = 10 / v.k
      let best: { id: string; d: number } | null = null
      const z = v.zoom
      for (const b of a.burgs) {
        const shown = b.type === 'capital' || (b.type === 'city' && z > 1.15) || (b.type === 'town' && z > 1.8) || (b.type === 'village' && z > 3.2)
        if (!shown) continue
        const d = Math.hypot(b.x - x, b.y - y)
        if (d < tol && (!best || d < best.d)) best = { id: b.id, d }
      }
      if (z > 2.2) for (const s of a.sites) {
        const d = Math.hypot(s.x - x, s.y - y)
        if (d < tol && (!best || d < best.d)) best = { id: s.id, d }
      }
      if (best) return { id: best.id, enter: best.id } satisfies Hit
      const c = a.cellAt(x, y)
      if (a.water[c] === 0 && a.state[c] >= 0) return { id: `realm${a.state[c]}` }
      return null
    },
  }
}

export type { ViewInfo }
