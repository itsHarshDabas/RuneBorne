import {
  generateBuilding, generateDungeon, generateRegion, generateSettlement, SETTLEMENT_SIZE,
  type Building, type Interior, type Region, type RegionMap, type RegionPlace, type SettlementMap, type World,
} from './generate'

export type Level =
  | { kind: 'world'; path: '' }
  | { kind: 'region'; path: string; region: Region; map: RegionMap }
  | { kind: 'settlement'; path: string; region: Region; place: RegionPlace; map: SettlementMap }
  | { kind: 'site'; path: string; region: Region; place: RegionPlace; interior: Interior }
  | { kind: 'building'; path: string; region: Region; place: RegionPlace; town: SettlementMap; building: Building; interior: Interior }

const cache = new Map<string, Level>()

/** Turns a path like "r3/s1/b12" into fully generated level data. Returns the deepest valid level. */
export function resolveLevel(world: World, path: string): Level {
  const key = `${world.seed}|${path}`
  const hit = cache.get(key)
  if (hit) return hit
  const level = build(world, path)
  cache.set(key, level)
  return level
}

function build(world: World, path: string): Level {
  const parts = path.split('/').filter(Boolean)
  const region = world.regions.find((r) => r.id === parts[0])
  if (!region) return { kind: 'world', path: '' }
  const map = generateRegion(world, region.id)
  if (parts.length === 1) return { kind: 'region', path: region.id, region, map }

  const place = map.places.find((p) => p.id === `${parts[0]}/${parts[1]}`)
  if (!place) return { kind: 'region', path: region.id, region, map }
  if (place.kind === 'site') return { kind: 'site', path: place.id, region, place, interior: generateDungeon(world.seed, place.id) }

  const town = generateSettlement(world.seed, place.id, place.type, place.name)
  if (parts.length === 2) return { kind: 'settlement', path: place.id, region, place, map: town }
  const building = town.buildings.find((b) => b.id === parts.slice(0, 3).join('/'))
  if (!building) return { kind: 'settlement', path: place.id, region, place, map: town }
  return { kind: 'building', path: building.id, region, place, town, building, interior: generateBuilding(world.seed, building) }
}

export function parentPath(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}

/** The visible area of a level, in that level's own coordinates. */
export function levelBox(level: Level): { x: number; y: number; w: number; h: number } {
  switch (level.kind) {
    case 'world':
      return { x: 0, y: 0, w: 1000, h: 640 }
    case 'region': {
      const [x0, y0, x1, y1] = level.region.bbox
      const pad = Math.max(x1 - x0, y1 - y0) * 0.08
      return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }
    }
    case 'settlement': {
      const reach = level.map.radius * (level.map.type === 'city' ? 1.2 : 1.75)
      const c = SETTLEMENT_SIZE / 2
      return { x: c - reach, y: c - reach, w: reach * 2, h: reach * 2 }
    }
    case 'site':
    case 'building':
      return { x: 0, y: 0, w: level.interior.cols * 20, h: level.interior.rows * 20 }
  }
}
