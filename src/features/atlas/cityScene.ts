import { makeRng } from '../world/random'
import type { City, Lot, Ward } from './citygen'
import { area, centroid, dist, longestEdge, pathFrom, pointInPoly, splitConvex, type P, type Poly } from './geom'
import type { Hit, Scene } from './MapCanvas'
import type { PoiType } from './pois'

// Draws a town plan in the style of an old engraved city map: parchment, field strips, tight roofs with
// a lit and a shaded side, thick walls with round towers, and markers for the places the GM cares about.

const INK = '#3b3226'
const PAPER = '#ebe1c6'
const GROUND = '#e2d4b2'
const STREET = '#f1e8d2'
const WATER = '#a3bec4'
const WALL = '#a0947f'
const TREE = '#93a26f'

const ROOF: Record<Ward, string> = {
  craftsmen: '#c8ad86', merchant: '#d1b289', patriarch: '#bd9d78', slum: '#b4a185', military: '#a99e8c', common: '#c6ab84',
  castle: '#a5998a', temple: '#d8c49d', farm: '#c0a57c', market: '#c8ad86', park: '#c8ad86', wild: '#c8ad86',
}

export const POI_COLOR: Record<PoiType, string> = {
  tavern: '#c2410c', inn: '#9a3412', blacksmith: '#44403c', general: '#4d7c0f', alchemist: '#0f766e', magic: '#6d28d9',
  library: '#1d4ed8', temple: '#a16207', shrine: '#b45309', guard: '#991b1b', manor: '#854d0e', bank: '#713f12',
  stables: '#57534e', guild: '#0e7490', market: '#15803d', farm: '#65a30d', house: '#78593a',
}

export const NPC_STATE_COLOR: Record<string, string> = {
  Normal: '#f5ecd7', Friendly: '#4ade80', Hostile: '#ef4444', Away: '#94a3b8', Missing: '#a78bfa', Captured: '#f59e0b', Dead: '#44403c',
}
export const PLACE_STATE_COLOR: Record<string, string> = {
  Closed: '#94a3b8', Occupied: '#ef4444', Abandoned: '#78716c', Destroyed: '#1c1917', Cleared: '#4ade80', Hidden: '#a78bfa',
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, f < 0 ? v * (1 + f) : v + (255 - v) * f)))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

export type CityArt = {
  ground: Path2D
  fields: Path2D[]
  furrows: Path2D
  trees: P[]
  roofs: { fill: string; path: Path2D }[]
  outlines: Path2D
  shadows: Path2D
  ridges: Path2D
  big: Path2D
  streets: Path2D
  roads: Path2D
  sea: Path2D | null
  river: Path2D | null
  wall: Path2D | null
  citadel: Path2D | null
  gates: { p: P; angle: number }[]
  plaza: Path2D | null
  stalls: Path2D
  fountain: P | null
}

const artCache = new Map<string, CityArt>()

export function cityArt(c: City): CityArt {
  const key = `${c.id}|${c.size}|${c.lots.length}`
  const hit = artCache.get(key)
  if (hit) return hit
  const art = paint(c)
  artCache.set(key, art)
  return art
}

/** Line through a convex polygon: the two crossing points, or null. */
function chord(poly: Poly, p: P, d: P): [P, P] | null {
  const pts: P[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const den = d[0] * ey - d[1] * ex
    if (Math.abs(den) < 1e-9) continue
    const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den
    const u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den
    if (u >= 0 && u <= 1) pts.push([p[0] + d[0] * t, p[1] + d[1] * t])
  }
  if (pts.length < 2) return null
  pts.sort((q, r) => (q[0] - p[0]) * d[0] + (q[1] - p[1]) * d[1] - ((r[0] - p[0]) * d[0] + (r[1] - p[1]) * d[1]))
  return [pts[0], pts[pts.length - 1]]
}

function paint(c: City): CityArt {
  const rng = makeRng(`${c.id}/art`)
  const ground = new Path2D()
  for (const pt of c.patches) if (pt.inner || (pt.ward === 'slum' && !pt.water)) ground.addPath(pathFrom(pt.poly, true))

  const fields = [new Path2D(), new Path2D(), new Path2D()]
  const furrows = new Path2D()
  for (const f of c.fields) {
    fields[f.tone].addPath(pathFrom(f.poly, true))
    const d: P = [Math.cos(f.angle), Math.sin(f.angle)]
    const n: P = [-d[1], d[0]]
    let lo = Infinity
    let hi = -Infinity
    for (const q of f.poly) {
      const s = q[0] * n[0] + q[1] * n[1]
      lo = Math.min(lo, s)
      hi = Math.max(hi, s)
    }
    for (let s = lo + 2.2; s < hi - 1; s += 3.2) {
      const seg = chord(f.poly, [n[0] * s, n[1] * s], d)
      if (!seg) continue
      furrows.moveTo(seg[0][0], seg[0][1])
      furrows.lineTo(seg[1][0], seg[1][1])
    }
  }

  // Roofs grouped by colour so a whole town is a handful of fills
  const groups = new Map<string, Path2D>()
  const outlines = new Path2D()
  const shadows = new Path2D()
  const ridges = new Path2D()
  const big = new Path2D()
  const light: P = [-0.6, -0.8]
  for (const l of c.lots) {
    const fill = shade(ROOF[l.ward], rng.range(-0.07, 0.06))
    const key = fill
    if (!groups.has(key)) groups.set(key, new Path2D())
    const path = pathFrom(l.poly, true)
    groups.get(key)!.addPath(path)
    outlines.addPath(path)
    if (l.big) {
      big.addPath(path)
      continue
    }
    // Gabled roof: ridge along the long side through the middle, far half in shade
    const ei = longestEdge(l.poly)
    const a = l.poly[ei]
    const b = l.poly[(ei + 1) % l.poly.length]
    const len = dist(a, b) || 1
    const d: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    const mid = centroid(l.poly)
    const seg = chord(l.poly, mid, d)
    if (!seg) continue
    ridges.moveTo(seg[0][0], seg[0][1])
    ridges.lineTo(seg[1][0], seg[1][1])
    const [h1, h2] = splitConvex(l.poly, mid, d)
    if (h1.length < 3 || h2.length < 3) continue
    const c1 = centroid(h1)
    const lit = (c1[0] - mid[0]) * light[0] + (c1[1] - mid[1]) * light[1] > 0
    shadows.addPath(pathFrom(lit ? h2 : h1, true))
  }
  const roofs = [...groups].map(([fill, path]) => ({ fill, path }))

  const streets = new Path2D()
  for (const s of c.streets) streets.addPath(pathFrom(s, false))
  const roads = new Path2D()
  for (const r of c.roads) roads.addPath(pathFrom(r, false))

  const sea = c.sea ? pathFrom(c.sea, true) : null
  const river = c.river ? pathFrom(c.river.points, false) : null
  const wall = c.wall ? pathFrom(c.wall, true) : null
  const citadel = c.citadel ? pathFrom(c.citadel, true) : null
  const gates = c.gates.map((g) => {
    const w = c.wall!
    const i = w.findIndex((p) => dist(p, g) < 0.01)
    const a = w[(i - 1 + w.length) % w.length]
    const b = w[(i + 1) % w.length]
    return { p: g, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) }
  })

  let plaza: Path2D | null = null
  const stalls = new Path2D()
  let fountain: P | null = null
  if (c.plaza) {
    plaza = pathFrom(c.plaza, true)
    fountain = centroid(c.plaza)
    const r = Math.sqrt(Math.abs(area(c.plaza))) * 0.42
    for (let k = 0, tries = 0; k < 14 && tries < 80; tries++) {
      const p: P = [fountain[0] + rng.range(-r, r), fountain[1] + rng.range(-r, r)]
      if (dist(p, fountain) < 7 || !pointInPoly(p, c.plaza)) continue
      const w = rng.range(3, 5)
      const h = rng.range(2.4, 3.4)
      stalls.rect(p[0] - w / 2, p[1] - h / 2, w, h)
      k++
    }
  }
  return { ground, fields, furrows, trees: c.trees, roofs, outlines, shadows, ridges, big, streets, roads, sea, river, wall, citadel, gates, plaza, stalls, fountain }
}

export type CityOverlay = {
  selected: string | null
  names: Record<string, string>
  placeStates: Record<string, string>
  npcStates: Record<string, string>
  icons: Partial<Record<PoiType, CanvasImageSource>>
  /** Extra people the GM added in this town. */
  extraNpcs: { id: string; x: number; y: number }[]
}

export function cityScene(c: City, art: CityArt, o: CityOverlay): Scene {
  const pois = c.lots.filter((l) => l.poi)
  const marketId = `${c.id}/market`
  const people = [...c.npcs.map((n) => ({ id: n.id, x: n.x, y: n.y })), ...o.extraNpcs]
  return {
    key: `city:${c.id}`,
    width: c.size,
    height: c.size,
    background: PAPER,
    maxZoom: 12,
    drawWorld(ctx, v) {
      const px = 1 / v.k
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, c.size, c.size)

      // Fields with furrows
      const tones = ['#ddd0a4', '#d3c595', '#e3d8b3']
      art.fields.forEach((p, i) => {
        ctx.fillStyle = tones[i]
        ctx.fill(p)
      })
      if (v.k > 1.4) {
        ctx.strokeStyle = 'rgba(120,100,60,.22)'
        ctx.lineWidth = 0.5
        ctx.stroke(art.furrows)
      }
      ctx.strokeStyle = 'rgba(90,75,50,.45)'
      ctx.lineWidth = Math.max(0.4, 0.8 * px)
      art.fields.forEach((p) => ctx.stroke(p))

      // Town ground and roads in
      ctx.fillStyle = GROUND
      ctx.fill(art.ground)
      ctx.strokeStyle = 'rgba(80,65,45,.55)'
      ctx.lineWidth = 7
      ctx.stroke(art.roads)
      ctx.strokeStyle = '#e8dcbc'
      ctx.lineWidth = 5.4
      ctx.stroke(art.roads)

      // Water
      if (art.river && c.river) {
        ctx.strokeStyle = INK
        ctx.lineWidth = c.river.width + 1.6
        ctx.stroke(art.river)
        ctx.strokeStyle = WATER
        ctx.lineWidth = c.river.width
        ctx.stroke(art.river)
        ctx.strokeStyle = 'rgba(255,255,255,.18)'
        ctx.lineWidth = c.river.width * 0.35
        ctx.stroke(art.river)
      }
      if (art.sea) {
        ctx.fillStyle = WATER
        ctx.fill(art.sea)
        ctx.save()
        ctx.clip(art.sea)
        for (const [w, a] of [[26, 0.08], [14, 0.12], [6, 0.16]] as const) {
          ctx.strokeStyle = `rgba(255,255,255,${a})`
          ctx.lineWidth = w
          ctx.stroke(art.sea)
        }
        ctx.restore()
        ctx.strokeStyle = INK
        ctx.lineWidth = Math.max(0.8, 1.4 * px)
        ctx.stroke(art.sea)
      }

      // Main streets
      ctx.strokeStyle = STREET
      ctx.lineWidth = 4.6
      ctx.stroke(art.streets)

      // Market square
      if (art.plaza) {
        ctx.fillStyle = '#ece2c9'
        ctx.fill(art.plaza)
        ctx.fillStyle = '#c9a77c'
        ctx.fill(art.stalls)
        ctx.strokeStyle = INK
        ctx.lineWidth = 0.6
        ctx.stroke(art.stalls)
        if (art.fountain) {
          ctx.beginPath()
          ctx.arc(art.fountain[0], art.fountain[1], 3.6, 0, Math.PI * 2)
          ctx.fillStyle = WATER
          ctx.fill()
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Bridges
      for (const b of c.bridges) {
        ctx.save()
        ctx.translate(b.p[0], b.p[1])
        ctx.rotate(b.angle)
        ctx.fillStyle = '#c4a57a'
        ctx.fillRect(-b.len / 2, -3.4, b.len, 6.8)
        ctx.strokeStyle = INK
        ctx.lineWidth = 0.9
        ctx.strokeRect(-b.len / 2, -3.4, b.len, 6.8)
        ctx.restore()
      }

      // Buildings
      for (const r of art.roofs) {
        ctx.fillStyle = r.fill
        ctx.fill(r.path)
      }
      ctx.fillStyle = 'rgba(60,40,20,.16)'
      ctx.fill(art.shadows)
      if (v.k > 1.2) {
        ctx.strokeStyle = 'rgba(60,45,30,.45)'
        ctx.lineWidth = 0.45
        ctx.stroke(art.ridges)
      }
      ctx.strokeStyle = INK
      ctx.lineWidth = Math.max(0.25, 0.7 * px)
      ctx.stroke(art.outlines)
      ctx.lineWidth = Math.max(0.7, 1.4 * px)
      ctx.stroke(art.big)

      // Trees
      for (const [x, y] of art.trees) {
        ctx.beginPath()
        ctx.arc(x, y, 3.4, 0, Math.PI * 2)
        ctx.fillStyle = TREE
        ctx.fill()
        ctx.strokeStyle = '#56653d'
        ctx.lineWidth = 0.6
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(255,255,240,.25)'
      for (const [x, y] of art.trees) {
        ctx.beginPath()
        ctx.arc(x - 1, y - 1, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }

      // Walls, towers, gates, citadel
      if (art.wall) {
        ctx.strokeStyle = INK
        ctx.lineWidth = 5.4
        ctx.stroke(art.wall)
        ctx.strokeStyle = WALL
        ctx.lineWidth = 3.4
        ctx.stroke(art.wall)
      }
      if (art.citadel) {
        ctx.strokeStyle = INK
        ctx.lineWidth = 4.6
        ctx.stroke(art.citadel)
        ctx.strokeStyle = WALL
        ctx.lineWidth = 2.8
        ctx.stroke(art.citadel)
        for (const p of c.citadel!) tower(ctx, p, 3.6)
      }
      for (const t of c.towers) tower(ctx, t, 3.4)
      for (const g of art.gates) {
        ctx.save()
        ctx.translate(g.p[0], g.p[1])
        ctx.rotate(g.angle)
        ctx.fillStyle = WALL
        ctx.strokeStyle = INK
        ctx.lineWidth = 1
        for (const s of [-1, 1]) {
          ctx.fillRect(s * 5.5 - 2.6, -3.6, 5.2, 7.2)
          ctx.strokeRect(s * 5.5 - 2.6, -3.6, 5.2, 7.2)
        }
        ctx.fillStyle = STREET
        ctx.fillRect(-2.8, -4.4, 5.6, 8.8)
        ctx.restore()
      }

      // State tints on places
      for (const l of pois) {
        const st = o.placeStates[l.id]
        if (!st || !PLACE_STATE_COLOR[st]) continue
        ctx.fillStyle = PLACE_STATE_COLOR[st] + '66'
        ctx.fill(pathFrom(l.poly, true))
      }
      if (o.selected) {
        const l = c.lots.find((x) => x.id === o.selected)
        if (l) {
          ctx.strokeStyle = '#d4a24c'
          ctx.lineWidth = Math.max(1.4, 3 * px)
          ctx.stroke(pathFrom(l.poly, true))
        }
      }
    },
    drawScreen(ctx, v, toScreen) {
      const k = v.k
      const placed: [number, number, number, number][] = []
      const fits = (x: number, y: number, w: number, h: number) => {
        if (placed.some(([px, py, pw, ph]) => x < px + pw && x + w > px && y < py + ph && y + h > py)) return false
        placed.push([x, y, w, h])
        return true
      }
      const label = (text: string, x: number, y: number, font: string, fill: string) => {
        ctx.font = font
        const w = ctx.measureText(text).width
        if (!fits(x - w / 2 - 2, y - 11, w + 4, 14)) return
        ctx.lineJoin = 'round'
        ctx.strokeStyle = 'rgba(241,232,210,.92)'
        ctx.lineWidth = 3.5
        ctx.strokeText(text, x, y)
        ctx.fillStyle = fill
        ctx.fillText(text, x, y)
      }
      ctx.textAlign = 'center'

      // People
      if (k > 2.2) {
        for (const n of people) {
          const [sx, sy] = toScreen(n.x, n.y)
          if (sx < -10 || sy < -10 || sx > v.w + 10 || sy > v.h + 10) continue
          ctx.beginPath()
          ctx.arc(sx, sy, o.selected === n.id ? 5.5 : 4, 0, Math.PI * 2)
          ctx.fillStyle = NPC_STATE_COLOR[o.npcStates[n.id] ?? 'Normal'] ?? NPC_STATE_COLOR.Normal
          ctx.fill()
          ctx.strokeStyle = o.selected === n.id ? '#d4a24c' : INK
          ctx.lineWidth = o.selected === n.id ? 2.5 : 1.2
          ctx.stroke()
        }
      }

      // Place badges
      const r = Math.min(14, 8 + k * 0.6)
      const badge = (id: string, poi: PoiType, x: number, y: number) => {
        const [sx, sy] = toScreen(x, y)
        if (sx < -20 || sy < -20 || sx > v.w + 20 || sy > v.h + 20) return
        const st = o.placeStates[id]
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = st === 'Destroyed' ? '#44403c' : POI_COLOR[poi]
        ctx.shadowColor = 'rgba(0,0,0,.35)'
        ctx.shadowBlur = 4
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.lineWidth = o.selected === id ? 3 : 1.6
        ctx.strokeStyle = o.selected === id ? '#d4a24c' : (PLACE_STATE_COLOR[st ?? ''] ?? '#f5ecd7')
        ctx.stroke()
        const icon = o.icons[poi]
        if (icon) ctx.drawImage(icon, sx - r * 0.62, sy - r * 0.62, r * 1.24, r * 1.24)
        placed.push([sx - r, sy - r, r * 2, r * 2])
      }
      if (art.fountain) badge(marketId, 'market', art.fountain[0], art.fountain[1] - 9)
      for (const l of pois) badge(l.id, l.poi!, l.cx, l.cy)

      // Names when close enough to read them
      ctx.textBaseline = 'alphabetic'
      if (k > 1.6) {
        if (art.fountain) {
          const [sx, sy] = toScreen(art.fountain[0], art.fountain[1] - 9)
          label(o.names[marketId] ?? 'Market Square', sx, sy - r - 5, '600 11.5px Inter, sans-serif', INK)
        }
        for (const l of pois) {
          const [sx, sy] = toScreen(l.cx, l.cy)
          if (sx < -80 || sy < -30 || sx > v.w + 80 || sy > v.h + 30) continue
          label(o.names[l.id] ?? l.name ?? '', sx, sy - r - 5, '600 11.5px Inter, sans-serif', INK)
        }
      }
    },
    hit(x, y, v) {
      const tolPx = Math.min(14, 8 + v.k * 0.6) + 2
      const tol = tolPx / v.k
      if (v.k > 2.2) {
        let best: { id: string; d: number } | null = null
        for (const n of people) {
          const d = Math.hypot(n.x - x, n.y - y)
          if (d < 7 / v.k && (!best || d < best.d)) best = { id: n.id, d }
        }
        if (best) return { id: best.id }
      }
      if (art.fountain && Math.hypot(art.fountain[0] - x, art.fountain[1] - 9 - y) < tol) return { id: marketId }
      for (const l of pois) if (Math.hypot(l.cx - x, l.cy - y) < tol) return { id: l.id, enter: l.id }
      const p: P = [x, y]
      const lot = lotAt(c, p)
      if (lot) return { id: lot.id, enter: lot.id } satisfies Hit
      if (c.plaza && pointInPoly(p, c.plaza)) return { id: marketId }
      return null
    },
  }
}

export function lotAt(c: City, p: P): Lot | null {
  for (const l of c.lots) {
    if (Math.abs(l.cx - p[0]) > 30 || Math.abs(l.cy - p[1]) > 30) continue
    if (pointInPoly(p, l.poly)) return l
  }
  return null
}

function tower(ctx: CanvasRenderingContext2D, p: P, r: number) {
  ctx.beginPath()
  ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
  ctx.fillStyle = WALL
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  ctx.stroke()
}
