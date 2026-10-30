import { battleMapCanvas, CELL_PX, type MapRoom, type PaintedMap } from '../battle/generate'
import { makeRng } from '../world/random'
import type { Lot } from './citygen'
import type { Hit, Scene } from './MapCanvas'
import { DUNGEON_CONTENTS, POI_LABEL, type PoiType } from './pois'
import type { Site } from './worldgen'

// The innermost level: a painted floor plan for a building or a dungeon. It is the same painter the
// battle maps use, so "use as battle map" just stores the preset and seed.

export type Room = MapRoom & { id: string; detail?: string }
export type Interior = { id: string; preset: string; seed: number; cols: number; rows: number; painted: PaintedMap; rooms: Room[] }

const BUILDING_SIZE: Partial<Record<PoiType, [number, number]>> = {
  tavern: [24, 16], inn: [24, 16], manor: [30, 20], temple: [26, 18], library: [26, 18], guard: [22, 16], guild: [22, 16], bank: [18, 14],
  stables: [22, 14], blacksmith: [16, 12], general: [16, 12], alchemist: [16, 12], magic: [16, 12], shrine: [12, 10], farm: [14, 10],
}
const SITE_MAP: Record<Site['type'], { preset: string; cols: number; rows: number }> = {
  dungeon: { preset: 'dungeon', cols: 36, rows: 24 },
  crypt: { preset: 'dungeon', cols: 28, rows: 18 },
  tower: { preset: 'dungeon', cols: 22, rows: 22 },
  cave: { preset: 'cave', cols: 32, rows: 22 },
  ruin: { preset: 'ruins', cols: 30, rows: 20 },
}

/** Stable numeric seed for anything with an id inside a world. */
export function seedOf(worldSeed: number, id: string) {
  let h = 2166136261 ^ worldSeed
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) % 1_000_000_000
}

export function lotKind(lot: Lot): PoiType {
  return lot.poi ?? (lot.ward === 'farm' ? 'farm' : 'house')
}

export function lotTitle(lot: Lot) {
  return lot.name ?? POI_LABEL[lotKind(lot)]
}

export function buildingInterior(worldSeed: number, lot: Lot): Interior {
  const kind = lotKind(lot)
  const [cols, rows] = BUILDING_SIZE[kind] ?? (lot.big ? [20, 14] : [12, 9])
  const preset = `house:${kind}`
  const seed = seedOf(worldSeed, lot.id)
  const painted = battleMapCanvas(preset, seed, cols, rows)
  return { id: lot.id, preset, seed, cols, rows, painted, rooms: painted.rooms.map((r, i) => ({ ...r, id: `${lot.id}/r${i}` })) }
}

export function siteInterior(worldSeed: number, site: Site): Interior {
  const { preset, cols, rows } = SITE_MAP[site.type]
  const seed = seedOf(worldSeed, site.id)
  const painted = battleMapCanvas(preset, seed, cols, rows)
  const rng = makeRng(`${seed}/rooms`)
  return {
    id: site.id, preset, seed, cols, rows, painted,
    rooms: painted.rooms.map((r, i) => ({ ...r, id: `${site.id}/r${i}`, label: `Room ${r.label}`, detail: rng.pick(DUNGEON_CONTENTS) })),
  }
}

/** Where the people of a building stand: spread over its rooms, in scene units. */
export function placePeople<T extends { id: string }>(interior: Interior, people: T[]): (T & { x: number; y: number })[] {
  const rooms = interior.rooms.length ? interior.rooms : [{ x: 1, y: 1, w: interior.cols - 2, h: interior.rows - 2 }]
  return people.map((p, i) => {
    const r = rooms[i % rooms.length]
    const slot = Math.floor(i / rooms.length)
    const gx = r.x + Math.min(r.w - 0.5, 1 + ((slot * 1.7) % Math.max(1, r.w - 1.5)))
    const gy = r.y + Math.min(r.h - 0.5, r.h / 2 + 0.5)
    return { ...p, x: gx * CELL_PX, y: gy * CELL_PX }
  })
}

export type InteriorOverlay = {
  selected: string | null
  names: Record<string, string>
  roomStates: Record<string, string>
  people: { id: string; x: number; y: number; name: string; color: string }[]
  /** Dungeon rooms are numbered, building rooms named. */
  numbered: boolean
}

const ROOM_STATE: Record<string, string> = { Closed: '#94a3b8', Occupied: '#ef4444', Abandoned: '#78716c', Destroyed: '#1c1917', Cleared: '#4ade80', Hidden: '#a78bfa' }

export function interiorScene(it: Interior, o: InteriorOverlay): Scene {
  const C = CELL_PX
  return {
    key: `interior:${it.id}`,
    width: it.cols * C,
    height: it.rows * C,
    background: '#1b1714',
    maxZoom: 5,
    base: it.painted.canvas,
    drawWorld(ctx, v) {
      for (const r of it.rooms) {
        const st = o.roomStates[r.id]
        if (st && ROOM_STATE[st]) {
          ctx.fillStyle = ROOM_STATE[st] + '33'
          ctx.fillRect(r.x * C, r.y * C, r.w * C, r.h * C)
        }
        if (o.selected === r.id) {
          ctx.strokeStyle = '#d4a24c'
          ctx.lineWidth = 3 / v.k
          ctx.strokeRect(r.x * C + 2, r.y * C + 2, r.w * C - 4, r.h * C - 4)
        }
      }
    },
    drawScreen(ctx, v, toScreen) {
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'
      for (const r of it.rooms) {
        const [sx, sy] = toScreen((r.x + r.w / 2) * C, (r.y + 0.55) * C)
        const text = o.names[r.id] ?? r.label
        ctx.font = o.numbered ? '700 15px Cinzel, Georgia, serif' : '600 12px Inter, sans-serif'
        ctx.strokeStyle = 'rgba(20,16,12,.85)'
        ctx.lineWidth = 4
        ctx.strokeText(text, sx, sy + 4)
        ctx.fillStyle = '#efe6d4'
        ctx.fillText(text, sx, sy + 4)
      }
      for (const p of o.people) {
        const [sx, sy] = toScreen(p.x, p.y)
        const r = Math.max(6, Math.min(14, C * 0.32 * v.k))
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.shadowColor = 'rgba(0,0,0,.5)'
        ctx.shadowBlur = 5
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = o.selected === p.id ? '#d4a24c' : '#1a1714'
        ctx.lineWidth = o.selected === p.id ? 3 : 1.6
        ctx.stroke()
        ctx.font = '600 11px Inter, sans-serif'
        ctx.strokeStyle = 'rgba(20,16,12,.85)'
        ctx.lineWidth = 3.5
        ctx.strokeText(p.name, sx, sy - r - 5)
        ctx.fillStyle = '#efe6d4'
        ctx.fillText(p.name, sx, sy - r - 5)
      }
    },
    hit(x, y, v) {
      const tol = Math.max(8, Math.min(16, C * 0.32 * v.k)) / v.k
      for (const p of o.people) if (Math.hypot(p.x - x, p.y - y) < tol) return { id: p.id }
      const gx = x / C
      const gy = y / C
      const r = it.rooms.find((q) => gx >= q.x && gx < q.x + q.w && gy >= q.y && gy < q.y + q.h)
      return r ? ({ id: r.id } satisfies Hit) : null
    },
  }
}
