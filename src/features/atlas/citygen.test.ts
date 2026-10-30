import { describe, expect, it } from 'vitest'
import { generateCity } from './citygen'
import { generateAtlas } from './worldgen'

describe('city generation', () => {
  it('lays out every kind of settlement with lots, streets and places', () => {
    const a = generateAtlas(42)
    const picks = [
      a.burgs.find((b) => b.type === 'capital')!,
      a.burgs.find((b) => b.type === 'city' && b.coastAngle !== null) ?? a.burgs.find((b) => b.type === 'city')!,
      a.burgs.find((b) => b.type === 'town' && b.riverAngle !== null) ?? a.burgs.find((b) => b.type === 'town')!,
      a.burgs.find((b) => b.type === 'village')!,
    ]
    for (const b of picks) {
      const t0 = performance.now()
      const c = generateCity(42, b)
      const ms = performance.now() - t0
      console.log(b.type, b.name, `${Math.round(ms)}ms`, 'coast', b.coastAngle !== null, 'river', b.riverAngle !== null, 'lots', c.lots.length, 'pois', c.lots.filter((l) => l.poi).length, 'streets', c.streets.length, 'roads', c.roads.length, 'wall', !!c.wall, 'gates', c.gates.length, 'fields', c.fields.length, 'npcs', c.npcs.length, 'bridges', c.bridges.length)
      expect(c.lots.length).toBeGreaterThan(b.type === 'village' ? 5 : 60)
      expect(c.streets.length).toBeGreaterThan(0)
      expect(c.lots.filter((l) => l.poi).length).toBeGreaterThanOrEqual(3)
      expect(new Set(c.lots.map((l) => l.id)).size).toBe(c.lots.length)
      for (const l of c.lots) for (const p of l.poly) expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true)
    }
  })
})
