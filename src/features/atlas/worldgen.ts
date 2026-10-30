import { Delaunay } from 'd3-delaunay'
import { createNoise2D } from 'simplex-noise'
import { makeRng, type Rng } from '../world/random'
import { placeName, regionName, worldName } from '../world/names'
import { chaikin, MinHeap, type P } from './geom'

// The continent: a Voronoi cell map with a heightmap, drainage-based rivers, climate biomes,
// realms grown from their capitals, settlements placed by suitability and roads found with A*.
// Everything comes from the seed, so a world only needs its seed (plus GM edits) to be saved.

export const ATLAS_W = 1600
export const ATLAS_H = 1000
const CELLS = 10000

export type BiomeId =
  | 'ocean' | 'lake' | 'glacier' | 'tundra' | 'taiga' | 'steppe' | 'grassland' | 'forest' | 'rainforest'
  | 'savanna' | 'desert' | 'jungle' | 'swamp' | 'highland' | 'peaks'

export const BIOMES: Record<BiomeId, { label: string; color: string }> = {
  ocean: { label: 'Sea', color: '#4a6f8a' },
  lake: { label: 'Lake', color: '#6b93a8' },
  glacier: { label: 'Glacier', color: '#e4ecef' },
  tundra: { label: 'Tundra', color: '#b3ae8f' },
  taiga: { label: 'Taiga', color: '#6f8a5c' },
  steppe: { label: 'Steppe', color: '#c9c48f' },
  grassland: { label: 'Grassland', color: '#b5c07f' },
  forest: { label: 'Forest', color: '#7c9a5e' },
  rainforest: { label: 'Old forest', color: '#5f8452' },
  savanna: { label: 'Savanna', color: '#d0c27c' },
  desert: { label: 'Desert', color: '#e2d29c' },
  jungle: { label: 'Jungle', color: '#6e9a4c' },
  swamp: { label: 'Swamp', color: '#7d8f63' },
  highland: { label: 'Highlands', color: '#a99f7f' },
  peaks: { label: 'Mountains', color: '#c3bcae' },
}
const BIOME_IDS = Object.keys(BIOMES) as BiomeId[]

export type BurgType = 'capital' | 'city' | 'town' | 'village'
export type SiteType = 'dungeon' | 'ruin' | 'cave' | 'tower' | 'crypt'
export type Burg = {
  id: string
  cell: number
  x: number
  y: number
  name: string
  type: BurgType
  state: number
  port: boolean
  /** Direction from the town towards open water, if it is on the coast. */
  coastAngle: number | null
  /** Direction the river flows through the town, if any. */
  riverAngle: number | null
  population: number
}
export type Site = { id: string; cell: number; x: number; y: number; name: string; type: SiteType }
export type Realm = { id: number; name: string; color: string; capital: string; labelX: number; labelY: number; cells: number }
export type River = { id: number; points: P[]; widths: number[] }
export type Road = { points: P[]; kind: 'road' | 'trail' }

export type Atlas = {
  seed: number
  name: string
  n: number
  x: Float64Array
  y: Float64Array
  delaunay: Delaunay<P>
  neighbors: number[][]
  height: Float32Array
  /** 0 land, 1 ocean, 2 lake */
  water: Uint8Array
  biome: Uint8Array
  temp: Float32Array
  moist: Float32Array
  flux: Float32Array
  state: Int16Array
  rivers: River[]
  riverCell: Uint8Array
  realms: Realm[]
  burgs: Burg[]
  sites: Site[]
  roads: Road[]
  /** Smoothed outlines: land against ocean, lakes, and realm borders. */
  coasts: P[][]
  lakes: P[][]
  borders: P[][]
  realmShapes: P[][][]
  biomeOf: (cell: number) => BiomeId
  cellAt: (x: number, y: number) => number
}

const REALM_COLORS = ['#c2410c', '#1d4ed8', '#15803d', '#a21caf', '#b45309', '#0e7490', '#be123c', '#4d7c0f', '#6d28d9', '#0f766e', '#9a3412', '#4338ca']

const cache = new Map<number, Atlas>()

export function generateAtlas(seed: number): Atlas {
  const hit = cache.get(seed)
  if (hit) return hit
  const atlas = build(seed)
  cache.set(seed, atlas)
  return atlas
}

function build(seed: number): Atlas {
  const rng = makeRng(`atlas:${seed}`)
  const noise = createNoise2D(rng.next)
  const noise2 = createNoise2D(rng.next)
  const fbm = (x: number, y: number, oct = 5, nz = noise) => {
    let t = 0
    let a = 1
    let f = 1
    let norm = 0
    for (let i = 0; i < oct; i++) {
      t += nz(x * f, y * f) * a
      norm += a
      a *= 0.5
      f *= 2.02
    }
    return t / norm
  }

  // ---------- cells ----------
  const spacing = Math.sqrt((ATLAS_W * ATLAS_H) / CELLS)
  const pts: P[] = []
  for (let gy = 0; gy * spacing < ATLAS_H; gy++) {
    for (let gx = 0; gx * spacing < ATLAS_W; gx++) {
      pts.push([
        Math.min(ATLAS_W - 0.5, (gx + 0.5) * spacing + rng.range(-0.45, 0.45) * spacing),
        Math.min(ATLAS_H - 0.5, (gy + 0.5) * spacing + rng.range(-0.45, 0.45) * spacing),
      ])
    }
  }
  const delaunay = Delaunay.from(pts)
  const n = pts.length
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  pts.forEach(([px, py], i) => {
    x[i] = px
    y[i] = py
  })
  const neighbors: number[][] = Array.from({ length: n }, (_, i) => [...delaunay.neighbors(i)])

  // ---------- height ----------
  const height = new Float32Array(n)
  const blobs = Array.from({ length: rng.int(3, 6) }, () => ({
    x: rng.range(0.18, 0.82) * ATLAS_W,
    y: rng.range(0.2, 0.8) * ATLAS_H,
    r: rng.range(170, 420),
    a: rng.range(0.55, 1),
  }))
  const ridgeAngle = rng.range(0, Math.PI)
  for (let i = 0; i < n; i++) {
    const px = x[i]
    const py = y[i]
    let h = 0
    for (const b of blobs) h += b.a * Math.exp(-(((px - b.x) ** 2 + (py - b.y) ** 2) / (b.r * b.r)))
    h += fbm(px / 420, py / 420, 4) * 0.55 + fbm(px / 110, py / 110, 3, noise2) * 0.12
    // Mountain ranges: ridged noise stretched along one direction
    const rx = (px * Math.cos(ridgeAngle) + py * Math.sin(ridgeAngle)) / 260
    const ry = (-px * Math.sin(ridgeAngle) + py * Math.cos(ridgeAngle)) / 700
    const ridge = 1 - Math.abs(noise2(rx, ry))
    h += Math.pow(ridge, 3) * 0.35 * Math.max(0, h)
    // Sea around the edge of the map
    const edge = Math.min(px, ATLAS_W - px, py, ATLAS_H - py) / (Math.min(ATLAS_W, ATLAS_H) * 0.16)
    h -= (1 - Math.min(1, edge)) ** 2 * 0.9
    height[i] = h
  }
  // Sea level by percentile so every world has a sensible amount of land
  const sorted = [...height].sort((a, b) => a - b)
  const landFrac = rng.range(0.36, 0.46)
  const sea = sorted[Math.floor(n * (1 - landFrac))]
  const max = sorted[n - 1]
  const min = sorted[0]
  for (let i = 0; i < n; i++) {
    const h = height[i]
    // Land heights are curved so lowlands dominate and mountains stay as ranges
    height[i] = h >= sea ? 0.2 + 0.8 * Math.pow((h - sea) / (max - sea), 1.5) : (0.2 * (h - min)) / (sea - min)
  }

  // ---------- water: ocean (connected to the edge) and lakes ----------
  const water = new Uint8Array(n)
  const isWater = (i: number) => height[i] < 0.2
  const seen = new Uint8Array(n)
  const stack: number[] = []
  for (let i = 0; i < n; i++) {
    if (isWater(i) && (x[i] < spacing * 1.5 || y[i] < spacing * 1.5 || x[i] > ATLAS_W - spacing * 1.5 || y[i] > ATLAS_H - spacing * 1.5)) {
      stack.push(i)
      seen[i] = 1
    }
  }
  while (stack.length) {
    const c = stack.pop()!
    water[c] = 1
    for (const nb of neighbors[c]) if (!seen[nb] && isWater(nb)) {
      seen[nb] = 1
      stack.push(nb)
    }
  }
  for (let i = 0; i < n; i++) if (isWater(i) && !water[i]) water[i] = 2
  // Tiny islands and puddles read as noise; remove them
  const components = (pred: (i: number) => boolean) => {
    const label = new Int32Array(n).fill(-1)
    const groups: number[][] = []
    for (let i = 0; i < n; i++) {
      if (label[i] >= 0 || !pred(i)) continue
      const g: number[] = []
      const st = [i]
      label[i] = groups.length
      while (st.length) {
        const c = st.pop()!
        g.push(c)
        for (const nb of neighbors[c]) if (label[nb] < 0 && pred(nb)) {
          label[nb] = groups.length
          st.push(nb)
        }
      }
      groups.push(g)
    }
    return groups
  }
  for (const g of components((i) => water[i] === 0)) if (g.length < 6) for (const c of g) {
    water[c] = 1
    height[c] = 0.18
  }
  for (const g of components((i) => water[i] === 2)) if (g.length < 3) for (const c of g) {
    water[c] = 0
    height[c] = 0.21
  }

  // ---------- climate ----------
  // Distance to the sea in cells, for moisture and coasts
  const seaDist = new Int32Array(n).fill(1 << 20)
  const q: number[] = []
  for (let i = 0; i < n; i++) if (water[i] === 1) {
    seaDist[i] = 0
    q.push(i)
  }
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]
    for (const nb of neighbors[c]) if (seaDist[nb] > seaDist[c] + 1) {
      seaDist[nb] = seaDist[c] + 1
      q.push(nb)
    }
  }
  const temp = new Float32Array(n)
  const moist = new Float32Array(n)
  const coldNorth = rng.chance(0.5)
  for (let i = 0; i < n; i++) {
    const lat = coldNorth ? y[i] / ATLAS_H : 1 - y[i] / ATLAS_H
    temp[i] = Math.min(1, Math.max(0, 0.08 + lat * 0.9 + fbm(x[i] / 500, y[i] / 500, 3, noise2) * 0.15 - Math.max(0, height[i] - 0.45) * 0.9))
    moist[i] = Math.min(1, Math.max(0, 0.5 + fbm(x[i] / 380 + 50, y[i] / 380, 4) * 0.55 + Math.max(0, 0.25 - seaDist[i] * 0.012)))
  }

  // ---------- drainage: priority flood fills pits so every drop of rain reaches the sea ----------
  const filled = new Float32Array(height)
  const done = new Uint8Array(n)
  const heap = new MinHeap()
  for (let i = 0; i < n; i++) if (water[i] === 1) {
    done[i] = 1
    heap.push(i, height[i])
  }
  while (heap.size) {
    const c = heap.pop()
    for (const nb of neighbors[c]) {
      if (done[nb]) continue
      done[nb] = 1
      filled[nb] = Math.max(height[nb], filled[c] + 1e-5)
      heap.push(nb, filled[nb])
    }
  }
  const down = new Int32Array(n).fill(-1)
  for (let i = 0; i < n; i++) {
    if (water[i] === 1) continue
    let best = -1
    let bh = filled[i]
    for (const nb of neighbors[i]) if (filled[nb] < bh) {
      bh = filled[nb]
      best = nb
    }
    down[i] = best
  }
  const flux = new Float32Array(n)
  const order = [...Array(n).keys()].filter((i) => water[i] !== 1).sort((a, b) => filled[b] - filled[a])
  for (const i of order) flux[i] += 0.4 + moist[i]
  for (const i of order) if (down[i] >= 0) flux[down[i]] += flux[i]
  // Wetter soil along big rivers
  for (const i of order) moist[i] = Math.min(1, moist[i] + Math.min(0.25, flux[i] / 400))

  // ---------- biomes ----------
  const biome = new Uint8Array(n)
  const B = (id: BiomeId) => BIOME_IDS.indexOf(id)
  for (let i = 0; i < n; i++) {
    const h = height[i]
    const t = temp[i]
    const m = moist[i]
    let b: BiomeId
    if (water[i] === 1) b = 'ocean'
    else if (water[i] === 2) b = 'lake'
    else if (t < 0.12) b = 'glacier'
    else if (h > 0.78) b = 'peaks'
    else if (h > 0.64) b = 'highland'
    else if (t < 0.25) b = 'tundra'
    else if (t < 0.4) b = m > 0.45 ? 'taiga' : 'tundra'
    else if (m < 0.32) b = t > 0.65 ? 'desert' : 'steppe'
    else if (m < 0.5) b = t > 0.7 ? 'savanna' : 'grassland'
    else if (m < 0.72) b = t > 0.75 ? 'jungle' : 'forest'
    else b = h < 0.3 && t > 0.45 ? 'swamp' : t > 0.75 ? 'jungle' : 'rainforest'
    biome[i] = B(b)
  }
  const biomeOf = (i: number) => BIOME_IDS[biome[i]]

  // ---------- rivers ----------
  const RIVER_MIN = 28
  const riverCell = new Uint8Array(n)
  for (const i of order) if (water[i] === 0 && flux[i] > RIVER_MIN && down[i] >= 0) riverCell[i] = 1
  const rivers: River[] = []
  const traced = new Uint8Array(n)
  // Start at sources: river cells with no river flowing into them
  const hasUpstream = new Uint8Array(n)
  for (let i = 0; i < n; i++) if (riverCell[i] && down[i] >= 0) hasUpstream[down[i]] = 1
  for (const s of order) {
    if (!riverCell[s] || hasUpstream[s]) continue
    const cells: number[] = []
    let c = s
    while (c >= 0) {
      cells.push(c)
      if (traced[c] || water[c] !== 0) break
      traced[c] = 1
      c = down[c]
    }
    if (cells.length < 4) continue
    const last = cells[cells.length - 1]
    const pts2: P[] = cells.map((k) => [x[k], y[k]])
    const widths = cells.map((k) => 0.6 + Math.sqrt(flux[k]) / 8)
    if (water[last] !== 0) {
      // End at the shore rather than the middle of the sea cell
      const prev = cells[cells.length - 2]
      pts2[pts2.length - 1] = [(x[prev] + x[last]) / 2, (y[prev] + y[last]) / 2]
      widths[widths.length - 1] = widths[widths.length - 2]
    } else {
      widths[widths.length - 1] = 0.6 + Math.sqrt(flux[last]) / 8
    }
    // Meander: nudge interior points sideways with noise before smoothing
    for (let k = 1; k < pts2.length - 1; k++) {
      const [ax, ay] = pts2[k - 1]
      const [bx, by] = pts2[k + 1]
      const dx = bx - ax
      const dy = by - ay
      const len = Math.hypot(dx, dy) || 1
      const off = noise(pts2[k][0] / 40, pts2[k][1] / 40) * spacing * 0.35
      pts2[k] = [pts2[k][0] - (dy / len) * off, pts2[k][1] + (dx / len) * off]
    }
    widths[0] = 0.3
    const smooth = chaikin(pts2, 3, false)
    // Spread the widths over the smoothed points
    const sw = smooth.map((_, k) => {
      const t = (k / (smooth.length - 1)) * (widths.length - 1)
      const a = Math.floor(t)
      const b = Math.min(widths.length - 1, a + 1)
      return widths[a] + (widths[b] - widths[a]) * (t - a)
    })
    rivers.push({ id: rivers.length, points: smooth, widths: sw })
  }

  // ---------- outlines ----------
  const voronoi = delaunay.voronoi([0, 0, ATLAS_W, ATLAS_H])
  const cc = voronoi.circumcenters
  const tris = delaunay.triangles
  const half = delaunay.halfedges
  const nextHalf = (e: number) => (e % 3 === 2 ? e - 2 : e + 1)
  /** All Voronoi edges that separate a cell matching `a` from a neighbour matching `b`, chained into lines. */
  function chains(a: (i: number) => boolean, b: (i: number, j: number) => boolean, closedOnly: boolean): P[][] {
    const edges = new Map<number, number[]>()
    const add = (u: number, v: number) => {
      if (!edges.has(u)) edges.set(u, [])
      if (!edges.has(v)) edges.set(v, [])
      edges.get(u)!.push(v)
      edges.get(v)!.push(u)
    }
    for (let e = 0; e < tris.length; e++) {
      const o = half[e]
      if (o < e) continue
      const i = tris[e]
      const j = tris[nextHalf(e)]
      if ((a(i) && b(i, j)) || (a(j) && b(j, i))) add(Math.floor(e / 3), Math.floor(o / 3))
    }
    const used = new Set<string>()
    const key = (u: number, v: number) => (u < v ? `${u}-${v}` : `${v}-${u}`)
    const out: P[][] = []
    const walk = (start: number, closedWanted: boolean) => {
      for (const first of edges.get(start)!) {
        if (used.has(key(start, first))) continue
        const line = [start]
        let prev = start
        let cur = first
        used.add(key(prev, cur))
        for (;;) {
          line.push(cur)
          if (cur === start) break
          const nxt = edges.get(cur)!.find((w) => !used.has(key(cur, w)))
          if (nxt === undefined) break
          used.add(key(cur, nxt))
          prev = cur
          cur = nxt
        }
        void prev
        const closed = line[line.length - 1] === start
        if (closedWanted && !closed) continue
        const pts3: P[] = (closed ? line.slice(0, -1) : line).map((t) => [cc[t * 2], cc[t * 2 + 1]])
        out.push(closed ? chaikin(pts3, 3, true) : chaikin(pts3, 3, false))
      }
    }
    // Open chains start at vertices with an odd number of edges
    if (!closedOnly) for (const [v, list] of edges) if (list.length % 2 === 1) walk(v, false)
    for (const v of edges.keys()) walk(v, closedOnly)
    return out
  }
  const coasts = chains((i) => water[i] !== 1, (_, j) => water[j] === 1, true)
  const lakes = chains((i) => water[i] === 2, (_, j) => water[j] === 0, true)

  // ---------- settlements ----------
  const score = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (water[i] !== 0) continue
    const b = biomeOf(i)
    let s = { grassland: 1, forest: 0.8, steppe: 0.65, savanna: 0.65, rainforest: 0.6, taiga: 0.45, jungle: 0.45, swamp: 0.3, highland: 0.35, tundra: 0.25, desert: 0.2, peaks: 0.02, glacier: 0, ocean: 0, lake: 0 }[b]
    if (riverCell[i]) s += 0.5 + Math.min(0.6, flux[i] / 300)
    if (seaDist[i] === 1) s += 0.35
    if (neighbors[i].some((nb) => water[nb] === 2)) s += 0.35
    s *= 1 - Math.max(0, height[i] - 0.5)
    score[i] = s * rng.range(0.75, 1.25)
  }
  const land = [...Array(n).keys()].filter((i) => water[i] === 0)
  const byScore = [...land].sort((a, b) => score[b] - score[a])
  const burgCells: { cell: number; type: BurgType }[] = []
  const farEnough = (c: number, d: number) => burgCells.every((b) => Math.hypot(x[b.cell] - x[c], y[b.cell] - y[c]) > d)
  const realmCount = Math.max(4, Math.min(10, Math.round(land.length / 560)))
  for (const c of byScore) {
    if (burgCells.length >= realmCount) break
    if (farEnough(c, Math.sqrt((land.length * spacing * spacing) / realmCount) * 0.7)) burgCells.push({ cell: c, type: 'capital' })
  }
  const pick = (count: number, gap: number, type: BurgType) => {
    let added = 0
    for (const c of byScore) {
      if (added >= count) break
      if (score[c] <= 0.15 || !farEnough(c, gap)) continue
      burgCells.push({ cell: c, type })
      added++
    }
  }
  pick(Math.round(realmCount * 1.2), 70, 'city')
  pick(Math.round(land.length / 160), 42, 'town')
  pick(Math.round(land.length / 70), 24, 'village')

  // ---------- realms: grow from capitals by travel cost ----------
  const state = new Int16Array(n).fill(-1)
  const cost = new Float32Array(n).fill(Infinity)
  const rheap = new MinHeap()
  const capitals = burgCells.filter((b) => b.type === 'capital')
  capitals.forEach((b, k) => {
    cost[b.cell] = 0
    state[b.cell] = k
    rheap.push(b.cell, 0)
  })
  while (rheap.size) {
    const c = rheap.pop()
    for (const nb of neighbors[c]) {
      if (water[nb] === 1) continue
      const step = 1 + Math.max(0, height[nb] - 0.55) * 14 + (riverCell[nb] && !riverCell[c] ? 2 : 0) + (water[nb] === 2 ? 3 : 0)
      const nc = cost[c] + step
      if (nc < cost[nb] && nc < 140) {
        cost[nb] = nc
        state[nb] = state[c]
        rheap.push(nb, nc)
      }
    }
  }

  const usedNames = new Set<string>()
  const uniqueName = (r: Rng) => {
    let nm = placeName(r)
    for (let t = 0; usedNames.has(nm) && t < 20; t++) nm = placeName(r)
    usedNames.add(nm)
    return nm
  }
  const burgs: Burg[] = burgCells.map((b, k) => {
    const c = b.cell
    const waterNb = neighbors[c].filter((nb) => water[nb] === 1)
    const coastAngle = waterNb.length ? Math.atan2(waterNb.reduce((s, nb) => s + y[nb], 0) / waterNb.length - y[c], waterNb.reduce((s, nb) => s + x[nb], 0) / waterNb.length - x[c]) : null
    const riverAngle = riverCell[c] && down[c] >= 0 ? Math.atan2(y[down[c]] - y[c], x[down[c]] - x[c]) : null
    const r = makeRng(`${seed}:burg:${k}`)
    const base = { capital: 18000, city: 9000, town: 2500, village: 400 }[b.type]
    return {
      id: `b${k}`, cell: c, x: x[c], y: y[c], name: uniqueName(r), type: b.type, state: state[c], port: coastAngle !== null && b.type !== 'village',
      coastAngle, riverAngle, population: Math.round(base * r.range(0.6, 1.5)),
    }
  })

  const realms: Realm[] = capitals.map((b, k) => {
    const r = makeRng(`${seed}:realm:${k}`)
    // Label at the realm cell furthest from its border
    const cells = land.filter((i) => state[i] === k)
    const depth = new Int32Array(n).fill(-1)
    const qq: number[] = []
    for (const i of cells) if (neighbors[i].some((nb) => state[nb] !== k)) {
      depth[i] = 0
      qq.push(i)
    }
    for (let qi = 0; qi < qq.length; qi++) {
      const c = qq[qi]
      for (const nb of neighbors[c]) if (state[nb] === k && depth[nb] < 0) {
        depth[nb] = depth[c] + 1
        qq.push(nb)
      }
    }
    let best = b.cell
    for (const i of cells) if (depth[i] > depth[best]) best = i
    const nm = regionName(r)
    return { id: k, name: nm.startsWith('The ') ? nm : `${r.pick(['Kingdom of', 'Duchy of', 'Realm of', 'Free Lands of', 'Principality of'])} ${nm}`, color: REALM_COLORS[k % REALM_COLORS.length], capital: burgs[k].id, labelX: x[best], labelY: y[best], cells: cells.length }
  })
  const borders = chains((i) => state[i] >= 0, (i, j) => state[j] >= 0 && state[j] !== state[i] && water[j] === 0 && water[i] === 0, false)
  const realmShapes = realms.map((r) => chains((i) => state[i] === r.id && water[i] !== 1, (_, j) => state[j] !== r.id || water[j] === 1, true))

  // ---------- roads (A* over the cell graph; reuse makes later roads follow earlier ones) ----------
  const onRoad = new Uint8Array(n)
  function route(from: number, to: number): number[] | null {
    const g = new Map<number, number>([[from, 0]])
    const prev = new Map<number, number>()
    const h = (i: number) => Math.hypot(x[i] - x[to], y[i] - y[to]) / spacing
    const open = new MinHeap()
    open.push(from, h(from))
    let guard = 0
    while (open.size && guard++ < 20000) {
      const c = open.pop()
      if (c === to) {
        const path = [c]
        let k = c
        while (prev.has(k)) {
          k = prev.get(k)!
          path.push(k)
        }
        return path.reverse()
      }
      for (const nb of neighbors[c]) {
        if (water[nb] !== 0) continue
        const slope = Math.abs(height[nb] - height[c]) * 30
        const step = (onRoad[nb] ? 0.35 : 1) * (1 + slope + Math.max(0, height[nb] - 0.62) * 8 + (riverCell[nb] && !riverCell[c] ? 1.5 : 0))
        const ng = g.get(c)! + step
        if (ng < (g.get(nb) ?? Infinity)) {
          g.set(nb, ng)
          prev.set(nb, c)
          open.push(nb, ng + h(nb))
        }
      }
    }
    return null
  }
  const roads: Road[] = []
  const addRoad = (a: Burg, b: Burg, kind: Road['kind']) => {
    const path = route(a.cell, b.cell)
    if (!path || path.length < 2) return
    for (const c of path) onRoad[c] = 1
    roads.push({ points: chaikin(path.map((c) => [x[c], y[c]] as P), 2, false), kind })
  }
  const major = burgs.filter((b) => b.type === 'capital' || b.type === 'city')
  // Connect major towns with a minimum spanning tree (Prim), plus a couple of extra links
  const inTree = new Set([major[0]?.id])
  while (major.length && inTree.size < major.length) {
    let best: [Burg, Burg, number] | null = null
    for (const a of major) {
      if (!inTree.has(a.id)) continue
      for (const b of major) {
        if (inTree.has(b.id)) continue
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (!best || d < best[2]) best = [a, b, d]
      }
    }
    if (!best) break
    inTree.add(best[1].id)
    if (best[2] < 700) addRoad(best[0], best[1], 'road')
  }
  for (const b of burgs) {
    if (b.type === 'capital' || b.type === 'city') continue
    const near = burgs
      .filter((o) => o.id !== b.id && (b.type === 'village' || o.type !== 'village'))
      .sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0]
    if (near && Math.hypot(near.x - b.x, near.y - b.y) < 260) addRoad(b, near, b.type === 'village' ? 'trail' : 'road')
  }

  // ---------- adventure sites ----------
  const sites: Site[] = []
  const siteRng = makeRng(`${seed}:sites`)
  const SITE_NAMES: Record<SiteType, string[]> = {
    dungeon: ['Dungeon', 'Catacombs', 'Undercroft', 'Vaults'],
    ruin: ['Ruins', 'Fallen Keep', 'Broken Tower', 'Old Fort'],
    cave: ['Caves', 'Hollow', 'Grotto', 'Deep'],
    tower: ['Tower', 'Spire', 'Watch'],
    crypt: ['Crypt', 'Barrow', 'Tomb', 'Mausoleum'],
  }
  for (let tries = 0; tries < 400 && sites.length < 26; tries++) {
    const c = siteRng.pick(land)
    if (burgs.some((b) => Math.hypot(b.x - x[c], b.y - y[c]) < 26) || sites.some((s) => Math.hypot(s.x - x[c], s.y - y[c]) < 45)) continue
    const type: SiteType = height[c] > 0.62 ? siteRng.pick(['cave', 'cave', 'dungeon', 'tower']) : siteRng.pick(['dungeon', 'ruin', 'ruin', 'crypt', 'tower', 'cave'])
    sites.push({ id: `s${sites.length}`, cell: c, x: x[c], y: y[c], type, name: `${placeName(siteRng)} ${siteRng.pick(SITE_NAMES[type])}` })
  }

  const nameRng = makeRng(`${seed}:name`)
  return {
    seed, name: worldName(nameRng), n, x, y, delaunay, neighbors, height, water, biome, temp, moist, flux, state,
    rivers, riverCell, realms, burgs, sites, roads, coasts, lakes, borders, realmShapes, biomeOf,
    cellAt: (px, py) => delaunay.find(px, py),
  }
}
