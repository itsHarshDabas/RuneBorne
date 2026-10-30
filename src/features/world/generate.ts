// Procedural world generation. Every function here is pure: (seed, path) -> geometry.
// Levels: world (continent) -> region -> settlement or site -> building interior / dungeon.
import { NPC_SECRETS, NPC_TRAITS } from '../../data/homebrew'
import { personName, placeName, regionName, tavernName, worldName } from './names'
import { makeNoise, makeRng, type Rng } from './random'

export const WORLD_W = 1000
export const WORLD_H = 640

export type Biome = 'ocean' | 'shallows' | 'beach' | 'grass' | 'forest' | 'hills' | 'mountain' | 'snow' | 'desert' | 'swamp'

export const BIOME_COLORS: Record<Biome, [number, number, number]> = {
  ocean: [28, 52, 82],
  shallows: [44, 86, 118],
  beach: [196, 178, 128],
  grass: [104, 140, 78],
  forest: [56, 98, 58],
  hills: [128, 128, 86],
  mountain: [118, 106, 96],
  snow: [226, 228, 232],
  desert: [206, 172, 112],
  swamp: [74, 96, 72],
}

export const BIOME_LABEL: Record<Biome, string> = {
  ocean: 'Ocean', shallows: 'Coast', beach: 'Coast', grass: 'Plains', forest: 'Forest', hills: 'Hills',
  mountain: 'Mountains', snow: 'Frozen peaks', desert: 'Desert', swamp: 'Swamp',
}

export type Terrain = { height: (x: number, y: number) => number; biome: (x: number, y: number) => Biome }

export function makeTerrain(seed: number): Terrain {
  const hn = makeNoise(seed)
  const mn = makeNoise(seed ^ 0x9e3779b9)
  const height = (x: number, y: number) => {
    const nx = (x / WORLD_W) * 2 - 1
    const ny = (y / WORLD_H) * 2 - 1
    const edge = Math.max(Math.abs(nx), Math.abs(ny)) ** 3 * 0.35 + (nx * nx + ny * ny) * 0.22
    return hn(x / 160 + 50, y / 160 + 50, 6) * 1.1 + 0.08 - edge
  }
  // Pick sea level and peak from this world's own height distribution, so every seed gets ~45% land
  const samples: number[] = []
  for (let y = 0; y < WORLD_H; y += 16) for (let x = 0; x < WORLD_W; x += 16) samples.push(height(x, y))
  samples.sort((a, b) => a - b)
  const sea = samples[Math.floor(samples.length * 0.55)]
  const peak = samples[Math.floor(samples.length * 0.995)]
  const shallow = samples[Math.floor(samples.length * 0.45)]

  const biome = (x: number, y: number): Biome => {
    const h = height(x, y)
    if (h < shallow) return 'ocean'
    if (h < sea) return 'shallows'
    const e = (h - sea) / (peak - sea)
    if (e < 0.04) return 'beach'
    if (e > 0.85) return 'snow'
    if (e > 0.65) return 'mountain'
    if (e > 0.45) return 'hills'
    const m = mn(x / 120, y / 120, 4)
    if (m < 0.4) return 'desert'
    if (m > 0.6 && e < 0.15) return 'swamp'
    if (m > 0.5) return 'forest'
    return 'grass'
  }
  return { height, biome }
}

export function isLand(b: Biome) {
  return b !== 'ocean' && b !== 'shallows'
}

// ---------- World ----------

export type Region = { id: string; name: string; x: number; y: number; biome: Biome; danger: number; capital: boolean; bbox: [number, number, number, number] }
export type World = { seed: number; name: string; regions: Region[]; terrain: Terrain; regionAt: (x: number, y: number) => Region | null }

const worldCache = new Map<number, World>()

export function generateWorld(seed: number): World {
  const cached = worldCache.get(seed)
  if (cached) return cached
  const rng = makeRng(seed)
  const terrain = makeTerrain(seed)

  // Region centres: spaced-out points on land
  const centres: { x: number; y: number }[] = []
  for (let tries = 0; tries < 4000 && centres.length < 12; tries++) {
    const x = rng.range(40, WORLD_W - 40)
    const y = rng.range(40, WORLD_H - 40)
    const b = terrain.biome(x, y)
    if (!isLand(b) || b === 'snow') continue
    if (centres.some((c) => Math.hypot(c.x - x, c.y - y) < 120)) continue
    centres.push({ x, y })
  }

  const regions: Region[] = centres.map((c, i) => ({
    id: `r${i}`,
    name: regionName(makeRng(`${seed}/r${i}/name`)),
    x: c.x,
    y: c.y,
    biome: terrain.biome(c.x, c.y),
    danger: 1 + Math.floor(rng.next() * 5),
    capital: i === 0,
    bbox: [c.x, c.y, c.x, c.y],
  }))

  // Domain-warped nearest-centre lookup gives wiggly, natural-looking borders
  const warp = makeNoise(seed ^ 0x5bd1e995)
  const regionAt = (x: number, y: number): Region | null => {
    if (!isLand(terrain.biome(x, y))) return null
    const wx = x + (warp(x / 70, y / 70, 3) - 0.5) * 90
    const wy = y + (warp(x / 70 + 31, y / 70 + 17, 3) - 0.5) * 90
    let best: Region | null = null
    let bestD = Infinity
    for (const r of regions) {
      const d = (r.x - wx) ** 2 + (r.y - wy) ** 2
      if (d < bestD) {
        bestD = d
        best = r
      }
    }
    return best
  }

  // Region sizes and bounding boxes from a coarse scan; slivers get merged into neighbours
  const scan = () => {
    const cells = new Map<string, number>()
    for (const r of regions) r.bbox = [Infinity, Infinity, -Infinity, -Infinity]
    for (let y = 0; y < WORLD_H; y += 6) {
      for (let x = 0; x < WORLD_W; x += 6) {
        const r = regionAt(x, y)
        if (!r) continue
        cells.set(r.id, (cells.get(r.id) ?? 0) + 1)
        r.bbox = [Math.min(r.bbox[0], x), Math.min(r.bbox[1], y), Math.max(r.bbox[2], x + 6), Math.max(r.bbox[3], y + 6)]
      }
    }
    return cells
  }
  const cells = scan()
  for (let i = regions.length - 1; i >= 0; i--) if ((cells.get(regions[i].id) ?? 0) < 60) regions.splice(i, 1)
  if (!regions.some((r) => r.capital) && regions[0]) regions[0].capital = true
  scan()

  const world: World = { seed, name: worldName(rng), regions, terrain, regionAt }
  worldCache.set(seed, world)
  return world
}

// ---------- Region ----------

export type SettlementType = 'city' | 'town' | 'village'
export type SiteType = 'dungeon' | 'ruin' | 'cave' | 'tower' | 'crypt'
export type RegionPlace =
  | { id: string; kind: 'settlement'; type: SettlementType; name: string; x: number; y: number }
  | { id: string; kind: 'site'; type: SiteType; name: string; x: number; y: number }
export type RegionMap = { region: Region; places: RegionPlace[]; roads: [number, number][][] }

const SITE_NAMES: Record<SiteType, string[]> = {
  dungeon: ['Dungeon of', 'Halls of', 'Pits of', 'Vaults of'],
  ruin: ['Ruins of', 'Fallen', 'Old'],
  cave: ['Caves of', 'Grotto of', 'Hollow of'],
  tower: ['Tower of', 'Spire of', 'Watchtower of'],
  crypt: ['Crypt of', 'Tomb of', 'Barrow of'],
}

export function generateRegion(world: World, regionId: string): RegionMap {
  const region = world.regions.find((r) => r.id === regionId)!
  const rng = makeRng(`${world.seed}/${regionId}`)
  const [x0, y0, x1, y1] = region.bbox
  const places: RegionPlace[] = []
  const inRegion = (x: number, y: number) => world.regionAt(x, y)?.id === regionId
  const area = (x1 - x0) * (y1 - y0)
  const spacing = Math.sqrt(area) / 6

  const tryPlace = (minDist: number, ok: (x: number, y: number) => boolean) => {
    for (let t = 0; t < 400; t++) {
      const x = rng.range(x0, x1)
      const y = rng.range(y0, y1)
      if (!inRegion(x, y) || !ok(x, y)) continue
      if (places.some((p) => Math.hypot(p.x - x, p.y - y) < minDist)) continue
      return { x, y }
    }
    return null
  }

  const settlementTypes: SettlementType[] = [region.capital ? 'city' : 'town', 'town', 'village', 'village', 'village', 'village']
  const count = Math.max(3, Math.min(settlementTypes.length, Math.round(area / 9000)))
  for (let i = 0; i < count; i++) {
    const pos = tryPlace(spacing, (x, y) => !['mountain', 'snow', 'swamp'].includes(world.terrain.biome(x, y))) ?? tryPlace(spacing * 0.5, () => true)
    if (!pos) continue
    places.push({ id: `${regionId}/s${i}`, kind: 'settlement', type: settlementTypes[i], name: placeName(rng), ...pos })
  }

  const siteTypes: SiteType[] = ['dungeon', 'ruin', 'cave', 'tower', 'crypt']
  const sites = 2 + Math.floor(rng.next() * 3)
  for (let i = 0; i < sites; i++) {
    const type = rng.pick(siteTypes)
    const pos = tryPlace(spacing * 0.6, (x, y) => (type === 'cave' ? ['hills', 'mountain'].includes(world.terrain.biome(x, y)) || rng.chance(0.3) : true))
    if (!pos) continue
    places.push({ id: `${regionId}/d${i}`, kind: 'site', type, name: `${rng.pick(SITE_NAMES[type])} ${placeName(rng)}`, ...pos })
  }

  // Roads: minimum spanning tree between settlements, with a bit of wobble
  const towns = places.filter((p) => p.kind === 'settlement')
  const roads: [number, number][][] = []
  const connected = towns.slice(0, 1)
  const rest = towns.slice(1)
  while (rest.length) {
    let best: [number, number, number] = [0, 0, Infinity]
    connected.forEach((a, i) => rest.forEach((b, j) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < best[2]) best = [i, j, d]
    }))
    const a = connected[best[0]]
    const b = rest.splice(best[1], 1)[0]
    connected.push(b)
    const pts: [number, number][] = [[a.x, a.y]]
    const steps = 6
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      const wob = (rng.next() - 0.5) * best[2] * 0.12
      const nx = -(b.y - a.y) / best[2]
      const ny = (b.x - a.x) / best[2]
      pts.push([a.x + (b.x - a.x) * t + nx * wob, a.y + (b.y - a.y) * t + ny * wob])
    }
    pts.push([b.x, b.y])
    roads.push(pts)
  }

  return { region, places, roads }
}

// ---------- Settlement ----------

export type PoiType =
  | 'tavern' | 'inn' | 'blacksmith' | 'general' | 'alchemist' | 'magic' | 'library' | 'temple' | 'shrine'
  | 'guard' | 'manor' | 'bank' | 'stables' | 'guild' | 'market' | 'farm' | 'house'

export const POI_LABEL: Record<PoiType, string> = {
  tavern: 'Tavern', inn: 'Inn', blacksmith: 'Blacksmith', general: 'General Store', alchemist: 'Alchemist', magic: 'Magic Shop',
  library: 'Library', temple: 'Temple', shrine: 'Shrine', guard: 'Guard Post', manor: 'Noble Manor', bank: 'Bank',
  stables: 'Stables', guild: 'Guildhall', market: 'Market', farm: 'Farm', house: 'House',
}

const POI_OWNER: Record<PoiType, string[]> = {
  tavern: ['Barkeep', 'Serving hand'], inn: ['Innkeeper', 'Stablehand'], blacksmith: ['Smith', 'Apprentice'],
  general: ['Shopkeeper'], alchemist: ['Alchemist', 'Assistant'], magic: ['Arcanist'], library: ['Librarian', 'Scholar'],
  temple: ['High Priest', 'Acolyte'], shrine: ['Hermit priest'], guard: ['Guard Captain', 'Guard'], manor: ['Lord', 'Butler'],
  bank: ['Banker'], stables: ['Stablemaster'], guild: ['Guildmaster', 'Clerk'], market: ['Merchant', 'Fishmonger'],
  farm: ['Farmer'], house: ['Resident'],
}

const POIS: Record<SettlementType, PoiType[]> = {
  city: ['market', 'tavern', 'tavern', 'inn', 'blacksmith', 'general', 'alchemist', 'magic', 'library', 'temple', 'guard', 'guard', 'manor', 'bank', 'stables', 'guild'],
  town: ['market', 'tavern', 'inn', 'blacksmith', 'general', 'alchemist', 'library', 'temple', 'guard', 'stables'],
  village: ['tavern', 'general', 'shrine', 'blacksmith'],
}

const COMMONERS = ['Farmer', 'Beggar', 'Child', 'Merchant', 'Guard', 'Drunk', 'Pilgrim', 'Street urchin', 'Washer', 'Minstrel', 'Cutpurse', 'Fishmonger', 'Town crier', 'Mercenary', 'Old gossip', 'Courier']

export type Building = { id: string; x: number; y: number; w: number; h: number; angle: number; poi?: PoiType; name?: string }
export type MapNpcSeed = { id: string; name: string; role: string; trait: string; secret: string; x: number; y: number; placeId?: string }
export type SettlementMap = {
  id: string
  type: SettlementType
  name: string
  radius: number
  roads: [number, number][][]
  wall: [number, number][] | null
  buildings: Building[]
  fields: { x: number; y: number; w: number; h: number; angle: number }[]
  npcs: MapNpcSeed[]
}

export const SETTLEMENT_SIZE = 1000

export function generateSettlement(seed: number, id: string, type: SettlementType, name: string): SettlementMap {
  const rng = makeRng(`${seed}/${id}`)
  const C = SETTLEMENT_SIZE / 2
  const radius = type === 'city' ? 400 : type === 'town' ? 290 : 190
  const roads: [number, number][][] = []

  const mainCount = type === 'city' ? 6 : type === 'town' ? 4 : 3
  const offset = rng.range(0, Math.PI * 2)
  for (let i = 0; i < mainCount; i++) {
    const angle = offset + (i / mainCount) * Math.PI * 2 + rng.range(-0.25, 0.25)
    const pts: [number, number][] = []
    let a = angle
    for (let r = 30; r <= radius * 1.35; r += 25) {
      a += rng.range(-0.06, 0.06)
      pts.push([C + Math.cos(a) * r, C + Math.sin(a) * r])
    }
    roads.push(pts)
  }
  if (type !== 'village') {
    for (const ringR of type === 'city' ? [radius * 0.45, radius * 0.78] : [radius * 0.6]) {
      const pts: [number, number][] = []
      for (let s = 0; s <= 48; s++) {
        const a = (s / 48) * Math.PI * 2
        const r = ringR * (1 + Math.sin(a * 3 + offset) * 0.05)
        pts.push([C + Math.cos(a) * r, C + Math.sin(a) * r])
      }
      roads.push(pts)
    }
  }

  // Buildings along roads, rotated to face them
  const buildings: Building[] = []
  const taken: { x: number; y: number; r: number }[] = []
  const roadPts = roads.flat()
  const nearRoad = (x: number, y: number, d: number) => roadPts.some((p) => Math.hypot(p[0] - x, p[1] - y) < d)
  const free = (x: number, y: number, r: number) => taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r)
  const density = type === 'city' ? 0.95 : type === 'town' ? 0.8 : 0.45

  for (const road of roads) {
    for (let i = 0; i < road.length - 1; i++) {
      const [ax, ay] = road[i]
      const [bx, by] = road[i + 1]
      const angle = Math.atan2(by - ay, bx - ax)
      const len = Math.hypot(bx - ax, by - ay)
      for (let t = 0; t < len; t += 16) {
        for (const side of [-1, 1]) {
          const dist = Math.hypot(ax - C, ay - C)
          if (dist > radius || !rng.chance(density * (1 - (dist / radius) ** 3 * 0.6))) continue
          const w = rng.range(14, 24)
          const h = rng.range(12, 20)
          const off = 12 + h / 2 + rng.range(0, 4)
          const x = ax + Math.cos(angle) * t - Math.sin(angle) * off * side
          const y = ay + Math.sin(angle) * t + Math.cos(angle) * off * side
          const r = Math.max(w, h) / 2
          if (Math.hypot(x - C, y - C) < 55 || !free(x, y, r) || nearRoad(x, y, 11)) continue
          taken.push({ x, y, r })
          buildings.push({ id: `${id}/b${buildings.length}`, x, y, w, h, angle: (angle * 180) / Math.PI })
        }
      }
    }
  }
  // Back-lot fill for denser places
  const fill = type === 'city' ? 900 : type === 'town' ? 350 : 60
  for (let i = 0; i < fill; i++) {
    const a = rng.range(0, Math.PI * 2)
    const d = Math.sqrt(rng.next()) * radius * 0.95
    const x = C + Math.cos(a) * d
    const y = C + Math.sin(a) * d
    const w = rng.range(12, 20)
    const h = rng.range(10, 16)
    const r = Math.max(w, h) / 2
    if (Math.hypot(x - C, y - C) < 55 || !free(x, y, r) || nearRoad(x, y, 10)) continue
    taken.push({ x, y, r })
    buildings.push({ id: `${id}/b${buildings.length}`, x, y, w, h, angle: rng.range(0, 180) })
  }

  // Points of interest: nearest buildings to the centre get the important jobs
  const byCentre = [...buildings].sort((p, q) => Math.hypot(p.x - C, p.y - C) - Math.hypot(q.x - C, q.y - C))
  // Spread them out so every shop is visible and reachable
  const pois = POIS[type]
  const chosen: Building[] = []
  const minGap = radius * (type === 'city' ? 0.15 : 0.2)
  for (const poi of pois) {
    if (poi === 'market') continue
    const b =
      byCentre.find((c) => !c.poi && Math.hypot(c.x - C, c.y - C) > 70 && chosen.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > minGap)) ??
      byCentre.find((c) => !c.poi)
    if (!b) break
    chosen.push(b)
    b.poi = poi
    b.w *= 1.4
    b.h *= 1.3
    b.name = poi === 'tavern' || poi === 'inn' ? tavernName(rng) : `${personName(rng).split(' ')[1]}'s ${POI_LABEL[poi]}`
    if (poi === 'library' || poi === 'temple' || poi === 'manor' || poi === 'guard' || poi === 'bank' || poi === 'guild') b.name = `${name} ${POI_LABEL[poi]}`
  }
  if (pois.includes('market')) buildings.push({ id: `${id}/market`, x: C, y: C, w: 70, h: 70, angle: 0, poi: 'market', name: `${name} Market` })

  // Fields outside villages and towns
  const fields: SettlementMap['fields'] = []
  if (type !== 'city') {
    for (let i = 0; i < (type === 'village' ? 22 : 14); i++) {
      const a = rng.range(0, Math.PI * 2)
      const d = radius * rng.range(1.05, 1.6)
      fields.push({ x: C + Math.cos(a) * d, y: C + Math.sin(a) * d, w: rng.range(40, 90), h: rng.range(30, 60), angle: rng.range(0, 180) })
    }
    const farmB = byCentre.slice(-3)
    farmB.forEach((b) => {
      if (!b.poi) {
        b.poi = 'farm'
        b.name = `${personName(rng).split(' ')[1]} Farm`
      }
    })
  }

  // Wall
  let wall: [number, number][] | null = null
  if (type !== 'village') {
    wall = []
    for (let s = 0; s < 28; s++) {
      const a = (s / 28) * Math.PI * 2
      const r = radius * 1.06 * (1 + rng.range(-0.03, 0.03))
      wall.push([C + Math.cos(a) * r, C + Math.sin(a) * r])
    }
  }

  // NPCs: owners at points of interest, commoners in the streets
  const npcs: MapNpcSeed[] = []
  const usedNames = new Set<string>()
  const npc = (role: string, x: number, y: number, placeId?: string) => {
    let name = personName(rng)
    for (let tries = 0; usedNames.has(name) && tries < 10; tries++) name = personName(rng)
    usedNames.add(name)
    npcs.push({ id: `${id}/n${npcs.length}`, name, role, trait: rng.pick(NPC_TRAITS), secret: rng.pick(NPC_SECRETS), x, y, placeId })
  }
  for (const b of buildings) {
    if (!b.poi || b.poi === 'house') continue
    const roles = POI_OWNER[b.poi]
    roles.forEach((role, i) => {
      if (i > 0 && !rng.chance(0.6)) return
      // Stand just outside the front of the building
      const a = rng.range(0, Math.PI * 2)
      const d = Math.max(b.w, b.h) / 2 + 9 + i * 7
      npc(role, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, b.id)
    })
  }
  const commoners = type === 'city' ? 16 : type === 'town' ? 10 : 6
  for (let i = 0; i < commoners; i++) {
    const p = rng.pick(roadPts.filter((q) => Math.hypot(q[0] - C, q[1] - C) < radius))
    if (p) npc(rng.pick(COMMONERS), p[0] + rng.range(-6, 6), p[1] + rng.range(-6, 6))
  }

  return { id, type, name, radius, roads, wall, buildings, fields, npcs }
}

// ---------- Interiors: buildings and dungeons ----------

export type Room = { id: string; x: number; y: number; w: number; h: number; label: string; detail: string }
export type Interior = { id: string; kind: 'building' | 'dungeon'; cols: number; rows: number; rooms: Room[]; corridors: [number, number, number, number][]; doors: [number, number][] }

const ROOM_LABELS: Partial<Record<PoiType, string[]>> = {
  tavern: ['Common Room', 'Kitchen', 'Cellar', 'Storeroom', 'Private Booth', 'Back Office'],
  inn: ['Common Room', 'Kitchen', 'Guest Room', 'Guest Room', 'Guest Room', 'Innkeeper\'s Room'],
  blacksmith: ['Forge', 'Storefront', 'Coal Store', 'Living Quarters'],
  general: ['Shop Floor', 'Storeroom', 'Office', 'Living Quarters'],
  alchemist: ['Shop Floor', 'Laboratory', 'Herb Store', 'Living Quarters'],
  magic: ['Showroom', 'Enchanting Room', 'Vault', 'Study'],
  library: ['Reading Hall', 'Stacks', 'Archive', 'Scriptorium', 'Restricted Section', 'Map Room'],
  temple: ['Nave', 'Altar', 'Vestry', 'Cloister', 'Crypt Stairs'],
  shrine: ['Shrine', 'Cell'],
  guard: ['Guard Room', 'Armoury', 'Cells', 'Barracks', 'Captain\'s Office'],
  manor: ['Great Hall', 'Dining Room', 'Study', 'Bedchamber', 'Kitchen', 'Servants\' Quarters', 'Gallery'],
  bank: ['Counting Room', 'Vault', 'Office', 'Waiting Room'],
  stables: ['Stalls', 'Tack Room', 'Hayloft'],
  guild: ['Meeting Hall', 'Office', 'Records', 'Lounge'],
  farm: ['Main Room', 'Kitchen', 'Bedroom', 'Barn'],
  house: ['Main Room', 'Kitchen', 'Bedroom', 'Storage'],
}

const DUNGEON_CONTENTS = [
  'Empty, but something was here recently.', 'A monster lair. Roll for what lives here.', 'A hidden trap (DC 13 to spot).',
  'Treasure: roll on the loot table.', 'A strange puzzle locks the next door.', 'A forgotten shrine. Pray and roll a d20.',
  'A prisoner begs to be freed.', 'Collapsed rubble hides a secret passage.', 'An old campsite with a journal.',
]

export function generateBuilding(seed: number, building: Building): Interior {
  const rng = makeRng(`${seed}/${building.id}/inside`)
  const big = ['library', 'manor', 'temple', 'guild', 'inn', 'guard'].includes(building.poi ?? '')
  const cols = big ? 30 : 22
  const rows = big ? 20 : 15
  const labels = ROOM_LABELS[building.poi ?? 'house'] ?? ROOM_LABELS.house!
  const rooms: Room[] = []
  const doors: [number, number][] = []

  // Binary space partition into rooms
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    const canV = w >= 10
    const canH = h >= 8
    if (depth <= 0 || (!canV && !canH) || (rooms.length + depth > labels.length + 2 && rng.chance(0.4))) {
      rooms.push({ id: `${building.id}/room${rooms.length}`, x, y, w, h, label: '', detail: '' })
      return
    }
    if (canV && (!canH || w > h)) {
      const cut = Math.round(w * rng.range(0.35, 0.65))
      split(x, y, cut, h, depth - 1)
      split(x + cut, y, w - cut, h, depth - 1)
      doors.push([x + cut, y + Math.floor(h / 2)])
    } else {
      const cut = Math.round(h * rng.range(0.35, 0.65))
      split(x, y, w, cut, depth - 1)
      split(x, y + cut, w, h - cut, depth - 1)
      doors.push([x + Math.floor(w / 2), y + cut])
    }
  }
  split(1, 1, cols - 2, rows - 2, big ? 3 : 2)
  rooms.sort((a, b) => b.w * b.h - a.w * a.h).forEach((r, i) => (r.label = labels[i] ?? labels[labels.length - 1]))
  doors.push([Math.floor(cols / 2), rows - 1])
  return { id: building.id, kind: 'building', cols, rows, rooms, corridors: [], doors }
}

export function generateDungeon(seed: number, siteId: string): Interior {
  const rng = makeRng(`${seed}/${siteId}/dungeon`)
  const cols = 48
  const rows = 32
  const rooms: Room[] = []
  const target = rng.int(8, 13)
  for (let t = 0; t < 600 && rooms.length < target; t++) {
    const w = rng.int(4, 9)
    const h = rng.int(4, 7)
    const x = rng.int(1, cols - w - 1)
    const y = rng.int(1, rows - h - 1)
    if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue
    rooms.push({ id: `${siteId}/room${rooms.length}`, x, y, w, h, label: `${rooms.length + 1}`, detail: rng.pick(DUNGEON_CONTENTS) })
  }
  rooms[0].detail = 'Entrance. The air smells of old stone.'
  const centre = (r: Room) => [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)] as const
  // Boss in the room furthest from the entrance
  const [ex, ey] = centre(rooms[0])
  const far = rooms.slice(1).reduce((a, b) => (Math.hypot(centre(b)[0] - ex, centre(b)[1] - ey) > Math.hypot(centre(a)[0] - ex, centre(a)[1] - ey) ? b : a))
  far.detail = 'Boss chamber. Whatever rules this place waits here.'

  const corridors: Interior['corridors'] = []
  const joined = [0]
  const left = rooms.map((_, i) => i).slice(1)
  while (left.length) {
    let best: [number, number, number] = [0, 0, Infinity]
    joined.forEach((a) => left.forEach((b, j) => {
      const d = Math.hypot(centre(rooms[a])[0] - centre(rooms[b])[0], centre(rooms[a])[1] - centre(rooms[b])[1])
      if (d < best[2]) best = [a, j, d]
    }))
    const b = left.splice(best[1], 1)[0]
    joined.push(b)
    const [ax, ay] = centre(rooms[best[0]])
    const [bx, by] = centre(rooms[b])
    corridors.push([ax, ay, bx, ay], [bx, ay, bx, by])
  }
  // A couple of loops so it isn't a pure tree
  for (let i = 0; i < 2 && rooms.length > 4; i++) {
    const a = rooms[rng.int(0, rooms.length - 1)]
    const b = rooms[rng.int(0, rooms.length - 1)]
    if (a === b) continue
    const [ax, ay] = centre(a)
    const [bx, by] = centre(b)
    corridors.push([ax, ay, ax, by], [ax, by, bx, by])
  }
  return { id: siteId, kind: 'dungeon', cols, rows, rooms, corridors, doors: [] }
}

export function rngFor(seed: number, path: string): Rng {
  return makeRng(`${seed}/${path}`)
}
