import { Delaunay } from 'd3-delaunay'
import { createNoise2D } from 'simplex-noise'
import { NPC_SECRETS, NPC_TRAITS } from '../../data/homebrew'
import { makeRng, type Rng } from '../world/random'
import { personName, tavernName } from '../world/names'
import { area, centroid, chaikin, dist, insetConvex, longestEdge, MinHeap, pointInPoly, splitConvex, type P, type Poly } from './geom'
import { COMMONERS, POI_LABEL, POI_OWNER, POIS, type PoiType } from './pois'
import type { Burg } from './worldgen'

// Medieval town plans: Voronoi "patches" in a spiral around the market, an inner core behind walls,
// streets found as shortest paths from the gates to the plaza, wards with their own building density,
// lots made by recursively splitting each block, farmland outside, and coast or river where the world has them.

export type Ward = 'market' | 'castle' | 'temple' | 'patriarch' | 'merchant' | 'craftsmen' | 'slum' | 'military' | 'park' | 'farm' | 'wild' | 'common'
export type Lot = { id: string; poly: Poly; ward: Ward; cx: number; cy: number; poi?: PoiType; name?: string; big?: boolean }
export type Field = { poly: Poly; tone: number; angle: number }
export type CityNpc = { id: string; name: string; role: string; trait: string; secret: string; x: number; y: number; placeId?: string }
export type City = {
  id: string
  name: string
  type: Burg['type']
  size: number
  center: P
  patches: { poly: Poly; ward: Ward; inner: boolean; water: boolean }[]
  wall: Poly | null
  towers: P[]
  gates: P[]
  citadel: Poly | null
  streets: P[][]
  roads: P[][]
  sea: Poly | null
  river: { points: P[]; width: number } | null
  bridges: { p: P; angle: number; len: number }[]
  plaza: Poly | null
  lots: Lot[]
  fields: Field[]
  trees: P[]
  npcs: CityNpc[]
}

const SPEC = {
  capital: { patches: 46, outer: 70, walls: 1 },
  city: { patches: 34, outer: 60, walls: 1 },
  town: { patches: 20, outer: 44, walls: 0.7 },
  village: { patches: 9, outer: 34, walls: 0 },
} as const

const LOT_AREA: Partial<Record<Ward, number>> = { craftsmen: 95, merchant: 140, patriarch: 330, slum: 55, military: 260, common: 120, castle: 400 }
const EMPTY: Partial<Record<Ward, number>> = { craftsmen: 0.05, merchant: 0.08, patriarch: 0.3, slum: 0.04, military: 0.15, common: 0.35, castle: 0.1 }

const cache = new Map<string, City>()

export function generateCity(seed: number, burg: Burg): City {
  const key = `${seed}|${burg.id}`
  const hit = cache.get(key)
  if (hit) return hit
  const city = build(seed, burg)
  cache.set(key, city)
  return city
}

function build(seed: number, burg: Burg): City {
  const rng = makeRng(`${seed}/${burg.id}/city`)
  const noise = createNoise2D(rng.next)
  const spec = SPEC[burg.type]
  const step = burg.type === 'village' ? 30 : 24
  const total = spec.patches + spec.outer

  // ---------- patches in a spiral ----------
  const pts: P[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  const a0 = rng.range(0, Math.PI * 2)
  for (let i = 0; i < total; i++) {
    const r = i === 0 ? 0 : 6 + Math.sqrt(i) * step * (i < spec.patches ? 1 : 1.12)
    const a = a0 + i * golden
    const j = i === 0 ? 0 : step * 0.18
    pts.push([Math.cos(a) * r + rng.range(-j, j), Math.sin(a) * r + rng.range(-j, j)])
  }
  const outerR = 6 + Math.sqrt(total) * step * 1.12
  const size = outerR * 2.05
  const C: P = [size / 2, size / 2]
  for (const p of pts) {
    p[0] += C[0]
    p[1] += C[1]
  }
  // Ring of far points so the outer patches stay bounded and roughly round
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    pts.push([C[0] + Math.cos(a) * outerR * 1.25, C[1] + Math.sin(a) * outerR * 1.25])
  }
  const bounds: [number, number, number, number] = [0, 0, size, size]
  // Relax the inner patches a little so blocks are even
  for (let it = 0; it < 2; it++) {
    const v = Delaunay.from(pts).voronoi(bounds)
    for (let i = 1; i < spec.patches; i++) {
      const poly = v.cellPolygon(i)
      if (poly) pts[i] = centroid(poly.slice(0, -1) as P[])
    }
  }
  const delaunay = Delaunay.from(pts)
  const voronoi = delaunay.voronoi(bounds)
  const count = total
  const polys: Poly[] = Array.from({ length: count }, (_, i) => (voronoi.cellPolygon(i) ?? []).slice(0, -1) as Poly)

  // ---------- water ----------
  let sea: Poly | null = null
  let seaTest: (p: P) => boolean = () => false
  if (burg.coastAngle !== null) {
    const dir: P = [Math.cos(burg.coastAngle), Math.sin(burg.coastAngle)]
    const nrm: P = [-dir[1], dir[0]]
    const off = Math.sqrt(spec.patches) * step * rng.range(0.75, 1.05)
    const line: P[] = []
    for (let t = -size; t <= size; t += 12) {
      const o = off + noise(t / 90, 3) * step * 0.9
      line.push([C[0] + dir[0] * o + nrm[0] * t, C[1] + dir[1] * o + nrm[1] * t])
    }
    const smooth = chaikin(line, 2, false)
    const far = size * 2
    sea = [...smooth, [smooth[smooth.length - 1][0] + dir[0] * far, smooth[smooth.length - 1][1] + dir[1] * far], [smooth[0][0] + dir[0] * far, smooth[0][1] + dir[1] * far]]
    const s = sea
    seaTest = (p) => pointInPoly(p, s)
  }
  let river: City['river'] = null
  let riverPts: P[] = []
  const riverWidth = burg.type === 'village' ? 9 : burg.type === 'town' ? 12 : 16
  if (burg.riverAngle !== null) {
    const dir: P = [Math.cos(burg.riverAngle), Math.sin(burg.riverAngle)]
    const nrm: P = [-dir[1], dir[0]]
    // Keep the market square on one bank
    const shift = (rng.chance(0.5) ? 1 : -1) * rng.range(1.1, 1.6) * step
    const line: P[] = []
    for (let t = -size; t <= size; t += 14) {
      const o = shift + noise(t / 70, 9) * step * 1.1
      line.push([C[0] + dir[0] * t + nrm[0] * o, C[1] + dir[1] * t + nrm[1] * o])
    }
    riverPts = chaikin(line, 3, false)
    river = { points: riverPts, width: riverWidth }
  }
  const nearRiver = (p: P, pad: number) => {
    for (let i = 0; i < riverPts.length - 1; i++) {
      const a = riverPts[i]
      const b = riverPts[i + 1]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
      if (Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]) < riverWidth / 2 + pad) return true
    }
    return false
  }

  const water = polys.map((poly, i) => i > 0 && poly.length > 2 && seaTest(centroid(poly)))
  const inner = polys.map((_, i) => i < spec.patches && !water[i])

  // ---------- walls ----------
  const walled = rng.next() < spec.walls
  const tris = delaunay.triangles
  const half = delaunay.halfedges
  const cc = voronoi.circumcenters
  const nextHalf = (e: number) => (e % 3 === 2 ? e - 2 : e + 1)
  const vtx = (t: number): P => [cc[t * 2], cc[t * 2 + 1]]
  // Voronoi vertex graph for streets
  const graph = new Map<number, { to: number; len: number; cells: [number, number] }[]>()
  for (let e = 0; e < tris.length; e++) {
    const o = half[e]
    if (o < e) continue
    const t1 = Math.floor(e / 3)
    const t2 = Math.floor(o / 3)
    const len = dist(vtx(t1), vtx(t2))
    const cells: [number, number] = [tris[e], tris[nextHalf(e)]]
    if (!graph.has(t1)) graph.set(t1, [])
    if (!graph.has(t2)) graph.set(t2, [])
    graph.get(t1)!.push({ to: t2, len, cells })
    graph.get(t2)!.push({ to: t1, len, cells })
  }
  const wetCache = new Map<number, boolean>()
  const wetVert = (v: number) => {
    let w = wetCache.get(v)
    if (w === undefined) wetCache.set(v, (w = nearRiver(vtx(v), 1)))
    return w
  }
  const inside = (p: P) => p[0] > 0 && p[1] > 0 && p[0] < size && p[1] < size

  let wall: Poly | null = null
  let wallVerts: number[] = []
  if (walled) {
    // Boundary between inner and other patches, as a loop of Voronoi vertices
    const next = new Map<number, number[]>()
    for (let e = 0; e < tris.length; e++) {
      const o = half[e]
      if (o < 0) continue
      const i = tris[e]
      const j = tris[nextHalf(e)]
      if (inner[i] && !inner[j]) {
        const u = Math.floor(e / 3)
        const w = Math.floor(o / 3)
        if (!next.has(u)) next.set(u, [])
        if (!next.has(w)) next.set(w, [])
        next.get(u)!.push(w)
        next.get(w)!.push(u)
      }
    }
    let best: number[] = []
    const used = new Set<string>()
    for (const startV of next.keys()) {
      const loop = [startV]
      let prev = -1
      let cur = startV
      for (let g = 0; g < 500; g++) {
        const nb = next.get(cur)!.find((w) => w !== prev && !used.has(`${Math.min(cur, w)}-${Math.max(cur, w)}`))
        if (nb === undefined) break
        used.add(`${Math.min(cur, nb)}-${Math.max(cur, nb)}`)
        prev = cur
        cur = nb
        if (cur === startV) break
        loop.push(cur)
      }
      if (loop.length > best.length) best = loop
    }
    if (best.length > 5) {
      wallVerts = best
      wall = best.map(vtx)
    }
  }
  const wallPoly = wall
  const insideWall = (p: P) => (wallPoly ? pointInPoly(p, wallPoly) : dist(p, C) < Math.sqrt(spec.patches) * step * 0.95)

  // ---------- gates and streets ----------
  const gateCount = burg.type === 'capital' ? 5 : burg.type === 'city' ? 4 : 3
  const gates: P[] = []
  const gateVerts: number[] = []
  if (wall) {
    const angles = Array.from({ length: gateCount }, (_, i) => a0 + (i / gateCount) * Math.PI * 2 + rng.range(-0.3, 0.3))
    for (const ang of angles) {
      let bestV = -1
      let bestD = Infinity
      for (const v of wallVerts) {
        const p = vtx(v)
        if (seaTest(p)) continue
        const d = Math.abs(Math.atan2(Math.sin(Math.atan2(p[1] - C[1], p[0] - C[0]) - ang), Math.cos(Math.atan2(p[1] - C[1], p[0] - C[0]) - ang)))
        if (d < bestD && !gateVerts.includes(v)) {
          bestD = d
          bestV = v
        }
      }
      if (bestV >= 0) {
        gateVerts.push(bestV)
        gates.push(vtx(bestV))
      }
    }
  }
  // Plaza: the central patch becomes the market square
  const plaza = water[0] ? null : polys[0]
  const plazaVerts = new Set<number>()
  for (let e = 0; e < tris.length; e++) if (tris[e] === 0 && half[e] >= 0) plazaVerts.add(Math.floor(e / 3))

  const streetUse = new Map<string, number>()
  const ekey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  function route(from: number, goal: (v: number) => boolean, avoidWall: boolean): number[] | null {
    const g = new Map<number, number>([[from, 0]])
    const prev = new Map<number, number>()
    const open = new MinHeap()
    open.push(from, 0)
    let guard = 0
    while (open.size && guard++ < 6000) {
      const c = open.pop()
      if (goal(c) && c !== from) {
        const path = [c]
        let k = c
        while (prev.has(k)) {
          k = prev.get(k)!
          path.push(k)
        }
        return path.reverse()
      }
      for (const ed of graph.get(c) ?? []) {
        const p = vtx(ed.to)
        if (!inside(p) || seaTest(p)) continue
        if (avoidWall && wallVerts.includes(ed.to) && !gateVerts.includes(ed.to)) continue
        const reuse = streetUse.has(ekey(c, ed.to)) ? 0.4 : 1
        const wet = riverPts.length && wetVert(ed.to) ? 5 : 1
        const ng = g.get(c)! + ed.len * reuse * wet
        if (ng < (g.get(ed.to) ?? Infinity)) {
          g.set(ed.to, ng)
          prev.set(ed.to, c)
          open.push(ed.to, ng)
        }
      }
    }
    return null
  }
  const streets: P[][] = []
  const roads: P[][] = []
  const startVerts = gateVerts.length
    ? gateVerts
    : // Villages: streets start where the spiral meets the fields
      Array.from({ length: gateCount }, (_, i) => {
        const ang = a0 + (i / gateCount) * Math.PI * 2
        const target: P = [C[0] + Math.cos(ang) * step * 2.6, C[1] + Math.sin(ang) * step * 2.6]
        let bestV = -1
        let bestD = Infinity
        for (const v of graph.keys()) {
          const d = dist(vtx(v), target)
          if (d < bestD && !seaTest(vtx(v))) {
            bestD = d
            bestV = v
          }
        }
        return bestV
      })
  // A wall vertex only has one free edge, so gates link to the nearest free vertex on each side
  const wallSet = new Set(wallVerts)
  const nearestFree = (p: P, side: boolean | null) => {
    let bestV = -1
    let bestD = Infinity
    for (const v of graph.keys()) {
      if (wallSet.has(v)) continue
      const q = vtx(v)
      if (!inside(q) || seaTest(q)) continue
      if (side !== null && wallPoly && pointInPoly(q, wallPoly) !== side) continue
      const d = dist(q, p)
      if (d < bestD) {
        bestD = d
        bestV = v
      }
    }
    return bestV
  }
  for (const gv of startVerts) {
    if (gv < 0) continue
    const gp = vtx(gv)
    const inStart = wall ? nearestFree(gp, true) : gv
    const outStart = wall ? nearestFree(gp, false) : gv
    const inward = inStart >= 0 ? (plazaVerts.has(inStart) ? [inStart] : route(inStart, (v) => plazaVerts.has(v), true)) : null
    if (inward) {
      for (let i = 0; i < inward.length - 1; i++) streetUse.set(ekey(inward[i], inward[i + 1]), 1)
      streets.push([...(wall ? [gp] : []), ...inward.map(vtx)])
    }
    // Road out to the edge of the map, away from the centre
    const ga = Math.atan2(gp[1] - C[1], gp[0] - C[0])
    const out = outStart >= 0 ? route(outStart, (v) => dist(vtx(v), C) > outerR * 0.98 && Math.abs(angleDiff(Math.atan2(vtx(v)[1] - C[1], vtx(v)[0] - C[0]), ga)) < 0.7, true) : null
    if (out) roads.push(chaikin([...(wall ? [gp] : []), ...out.map(vtx)], 2, false))
  }
  // A ring street just inside the wall for bigger towns
  if (wall && burg.type !== 'town') {
    const ring = wallVerts.map(vtx).map((p) => [p[0] + (C[0] - p[0]) * 0.1, p[1] + (C[1] - p[1]) * 0.1] as P)
    streets.push([...ring, ring[0]])
  }

  // ---------- wards ----------
  const wards: Ward[] = polys.map(() => 'farm')
  const innerIdx = polys.map((_, i) => i).filter((i) => inner[i])
  const byDist = [...innerIdx].sort((p, q) => dist(centroid(polys[p]), C) - dist(centroid(polys[q]), C))
  let citadel: Poly | null = null
  for (const i of byDist) wards[i] = 'craftsmen'
  if (plaza) wards[0] = 'market'
  if (burg.type === 'village') {
    for (const i of innerIdx) if (i !== 0) wards[i] = 'common'
  } else {
    const n = byDist.length
    byDist.forEach((i, rank) => {
      if (i === 0) return
      const t = rank / n
      wards[i] = t < 0.25 ? rng.pick(['merchant', 'merchant', 'patriarch', 'craftsmen']) : t < 0.7 ? rng.pick(['craftsmen', 'craftsmen', 'merchant', 'patriarch']) : rng.pick(['craftsmen', 'craftsmen', 'slum', 'military'])
    })
    const nearPlaza = byDist.find((i) => i !== 0 && wards[i] !== 'market')
    if (nearPlaza !== undefined) wards[nearPlaza] = 'temple'
    const parks = burg.type === 'town' ? 1 : 2
    for (let k = 0; k < parks; k++) {
      const i = rng.pick(byDist.slice(Math.floor(byDist.length * 0.3)))
      if (wards[i] !== 'temple') wards[i] = 'park'
    }
    if ((burg.type === 'capital' || burg.type === 'city') && wall) {
      // Castle on the wall, away from the sea
      const edge = byDist.filter((i) => i !== 0 && wards[i] !== 'temple' && polys[i].some((p) => wall!.some((w) => dist(w, p) < 1)))
      const pickI = edge.sort((p, q) => area(polys[q]) * (seaTest(centroid(polys[q])) ? 0 : 1) - area(polys[p]))[0]
      if (pickI !== undefined) {
        wards[pickI] = 'castle'
        citadel = insetConvex(polys[pickI], 2) ?? polys[pickI]
      }
    }
  }
  for (let i = 0; i < count; i++) {
    if (water[i]) {
      wards[i] = 'wild'
      continue
    }
    if (inner[i]) continue
    const c = centroid(polys[i])
    const d = dist(c, C)
    const nearRoad = roads.some((r) => r.some((p) => dist(p, c) < step * 1.4))
    if (burg.type !== 'village' && insideWall(c)) wards[i] = 'craftsmen'
    else if (burg.type !== 'village' && nearRoad && d < outerR * 0.62 && rng.chance(0.55)) wards[i] = 'slum'
    else wards[i] = d > outerR * 0.88 || rng.chance(0.12) ? 'wild' : 'farm'
  }

  // ---------- lots ----------
  const lots: Lot[] = []
  const fields: Field[] = []
  const trees: P[] = []
  const blocked = (p: P) => seaTest(p) || (riverPts.length > 0 && nearRiver(p, 2))
  function subdivide(poly: Poly, minArea: number, out: Poly[], depth = 0) {
    const a = Math.abs(area(poly))
    if (a < minArea * rng.range(0.7, 1.5) || depth > 12) {
      out.push(poly)
      return
    }
    const ei = longestEdge(poly)
    const p1 = poly[ei]
    const p2 = poly[(ei + 1) % poly.length]
    const t = rng.range(0.38, 0.62)
    const mid: P = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]
    const ex = p2[0] - p1[0]
    const ey = p2[1] - p1[1]
    // Cut across the long edge, sometimes slightly skewed
    const skew = rng.range(-0.15, 0.15)
    const d: P = [-ey + ex * skew, ex + ey * skew]
    const [l, r] = splitConvex(poly, mid, d)
    if (l.length < 3 || r.length < 3) {
      out.push(poly)
      return
    }
    subdivide(l, minArea, out, depth + 1)
    subdivide(r, minArea, out, depth + 1)
  }
  const randomIn = (poly: Poly, n: number, into: P[]) => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of poly) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
      const p: P = [rng.range(minX, maxX), rng.range(minY, maxY)]
      if (pointInPoly(p, poly) && !blocked(p)) {
        into.push(p)
        k++
      }
    }
  }
  polys.forEach((poly, i) => {
    if (poly.length < 3) return
    const ward = wards[i]
    if (water[i]) return
    if (ward === 'market') return
    if (ward === 'park') {
      const inset = insetConvex(poly, 4)
      if (inset) randomIn(inset, Math.round(Math.abs(area(inset)) / 70), trees)
      return
    }
    if (ward === 'wild') {
      if (rng.chance(0.5)) randomIn(poly, Math.round(Math.abs(area(poly)) / 160), trees)
      return
    }
    if (ward === 'farm') {
      const inset = insetConvex(poly, 3)
      if (!inset) return
      // Long strips, cut parallel to each other
      const c = centroid(inset)
      const ang = Math.atan2(c[1] - C[1], c[0] - C[0]) + rng.range(-0.4, 0.4)
      const dir: P = [Math.cos(ang), Math.sin(ang)]
      let rest: Poly = inset
      const width = rng.range(10, 18)
      const strips: Poly[] = []
      for (let k = 0; k < 20 && rest.length > 2; k++) {
        // Cut a strip off the far side by projecting onto the perpendicular
        const nrm: P = [-dir[1], dir[0]]
        let minProj = Infinity
        for (const p of rest) minProj = Math.min(minProj, p[0] * nrm[0] + p[1] * nrm[1])
        const cutAt = minProj + width
        const p0: P = [nrm[0] * cutAt, nrm[1] * cutAt]
        const [aPart, bPart] = splitConvex(rest, p0, dir)
        const first = aPart.length > 2 && Math.abs(area(aPart)) > 1 ? aPart : null
        const second = bPart.length > 2 && Math.abs(area(bPart)) > 1 ? bPart : null
        // The strip is the side nearer minProj
        const isStrip = (q: Poly) => centroid(q)[0] * nrm[0] + centroid(q)[1] * nrm[1] < cutAt
        if (first && second) {
          const strip = isStrip(first) ? first : second
          strips.push(strip)
          rest = strip === first ? second : first
        } else {
          strips.push(rest)
          break
        }
      }
      strips.forEach((s, k) => {
        const f = insetConvex(s, 0.8)
        if (f && !blocked(centroid(f))) fields.push({ poly: f, tone: (k + i) % 3, angle: ang })
      })
      if (rng.chance(0.25)) {
        const farmhouse = insetConvex(strips[0] ?? inset, 3)
        if (farmhouse && Math.abs(area(farmhouse)) < 400 && !blocked(centroid(farmhouse))) lots.push(makeLot(farmhouse, 'farm'))
      }
      return
    }
    // Building blocks: leave room for streets, then split into lots
    const block = insetConvex(poly, ward === 'slum' ? 2 : 3.2)
    if (!block) return
    if (ward === 'temple' || ward === 'castle') {
      const core = insetConvex(block, ward === 'castle' ? 9 : 6)
      if (core) lots.push({ ...makeLot(core, ward), big: true })
      if (ward === 'temple') {
        const yard: P[] = []
        randomIn(block, 10, yard)
        trees.push(...yard.filter((p) => !core || !pointInPoly(p, insetConvex(core, -3) ?? core)).slice(0, 4))
      }
      return
    }
    const parts: Poly[] = []
    subdivide(block, LOT_AREA[ward] ?? 120, parts)
    for (const part of parts) {
      if (rng.chance(EMPTY[ward] ?? 0.1)) {
        if (ward === 'patriarch' || ward === 'common') randomIn(part, 2, trees)
        continue
      }
      // Village houses stand apart with yards; town houses share walls
      const b = insetConvex(part, ward === 'slum' ? 0.5 : ward === 'common' ? 2.6 : 0.9)
      if (!b || Math.abs(area(b)) < 12) continue
      const c = centroid(b)
      if (blocked(c) || b.some((p) => blocked(p))) continue
      lots.push(makeLot(b, ward))
    }
  })
  function makeLot(poly: Poly, ward: Ward): Lot {
    const c = centroid(poly)
    return { id: '', poly, ward, cx: c[0], cy: c[1] }
  }
  // Stable ids: sort by position so the same city always numbers buildings the same way
  lots.sort((p, q) => p.cy - q.cy || p.cx - q.cx)
  lots.forEach((l, i) => (l.id = `${burg.id}/h${i}`))

  // ---------- bridges ----------
  const bridges: City['bridges'] = []
  if (riverPts.length) {
    for (const s of [...streets, ...roads]) {
      for (let i = 0; i < s.length - 1; i++) {
        for (let j = 0; j < riverPts.length - 1; j++) {
          const x = crossing(s[i], s[i + 1], riverPts[j], riverPts[j + 1])
          if (!x || bridges.some((b) => dist(b.p, x) < 12)) continue
          bridges.push({ p: x, angle: Math.atan2(s[i + 1][1] - s[i][1], s[i + 1][0] - s[i][0]), len: riverWidth + 7 })
        }
      }
    }
  }

  // ---------- points of interest ----------
  const usedName = new Set<string>()
  const person = (r: Rng) => {
    let nm = personName(r)
    for (let t = 0; usedName.has(nm) && t < 10; t++) nm = personName(r)
    usedName.add(nm)
    return nm
  }
  const PREF: Partial<Record<PoiType, Ward[]>> = {
    tavern: ['craftsmen', 'merchant', 'slum', 'common'], inn: ['merchant', 'craftsmen', 'common'], blacksmith: ['craftsmen', 'slum', 'common'],
    general: ['merchant', 'craftsmen', 'common'], alchemist: ['merchant', 'craftsmen'], magic: ['patriarch', 'merchant'], library: ['patriarch', 'merchant'],
    temple: ['temple', 'patriarch', 'merchant', 'common'], shrine: ['common', 'craftsmen'], guard: ['military', 'castle', 'craftsmen'],
    manor: ['castle', 'patriarch'], bank: ['merchant', 'patriarch'], stables: ['slum', 'craftsmen', 'common'], guild: ['merchant', 'craftsmen'],
  }
  const taken: Lot[] = []
  for (const poi of POIS[burg.type]) {
    if (poi === 'market') continue
    const prefs = PREF[poi] ?? ['craftsmen']
    let lot: Lot | undefined
    for (const w of prefs) {
      const options = lots.filter((l) => !l.poi && l.ward === w && taken.every((t) => dist([t.cx, t.cy], [l.cx, l.cy]) > step * 0.9))
      if (options.length) {
        // Inns and stables like gates, the rest like the centre
        const near = poi === 'inn' || poi === 'stables' ? (gates[0] ?? C) : C
        options.sort((p, q) => dist([p.cx, p.cy], near) - dist([q.cx, q.cy], near))
        lot = options[Math.min(options.length - 1, rng.int(0, Math.min(3, options.length - 1)))]
        break
      }
    }
    lot ??= lots.find((l) => !l.poi && l.ward !== 'farm')
    if (!lot) continue
    lot.poi = poi
    lot.name = poi === 'tavern' || poi === 'inn' ? tavernName(rng) : ['library', 'temple', 'guard', 'bank', 'guild'].includes(poi) ? `${burg.name} ${POI_LABEL[poi]}` : poi === 'manor' ? `House ${person(rng).split(' ')[1]}` : `${person(rng).split(' ')[1]}'s ${POI_LABEL[poi]}`
    taken.push(lot)
  }

  // ---------- people ----------
  const npcs: CityNpc[] = []
  const npc = (role: string, x: number, y: number, placeId?: string) =>
    npcs.push({ id: `${burg.id}/n${npcs.length}`, name: person(rng), role, trait: rng.pick(NPC_TRAITS), secret: rng.pick(NPC_SECRETS), x, y, placeId })
  for (const l of lots) {
    if (!l.poi) continue
    POI_OWNER[l.poi].forEach((role, k) => {
      if (k > 0 && !rng.chance(0.6)) return
      npc(role, l.cx + rng.range(-3, 3), l.cy + rng.range(-3, 3), l.id)
    })
  }
  if (plaza) for (const role of POI_OWNER.market) npc(role, centroid(plaza)[0] + rng.range(-12, 12), centroid(plaza)[1] + rng.range(-12, 12), `${burg.id}/market`)
  const streetPts = streets.flat().filter((p) => insideWall(p) && !blocked(p))
  const commoners = { capital: 18, city: 14, town: 9, village: 6 }[burg.type]
  for (let k = 0; k < commoners && streetPts.length; k++) {
    const p = rng.pick(streetPts)
    npc(rng.pick(COMMONERS), p[0] + rng.range(-3, 3), p[1] + rng.range(-3, 3))
  }

  // Towers along the wall, bigger at gates
  const towers: P[] = []
  if (wall) for (const p of wall) if (!seaTest(p) && towers.every((t) => dist(t, p) > 14) && gates.every((g) => dist(g, p) > 4)) towers.push(p)

  return {
    id: burg.id, name: burg.name, type: burg.type, size, center: C,
    patches: polys.map((poly, i) => ({ poly, ward: wards[i], inner: inner[i], water: water[i] })),
    wall, towers, gates, citadel, streets: streets.map((s) => s), roads, sea, river, bridges, plaza, lots, fields, trees, npcs,
  }
}

function angleDiff(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b))
}

function crossing(a: P, b: P, c: P, d: P): P | null {
  const r: P = [b[0] - a[0], b[1] - a[1]]
  const q: P = [d[0] - c[0], d[1] - c[1]]
  const den = r[0] * q[1] - r[1] * q[0]
  if (Math.abs(den) < 1e-9) return null
  const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null
}
