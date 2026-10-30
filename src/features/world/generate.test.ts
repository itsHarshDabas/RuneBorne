import { describe, expect, it } from 'vitest'
import { generateBuilding, generateDungeon, generateRegion, generateSettlement, generateWorld, isLand, WORLD_H, WORLD_W } from './generate'

describe('world generation', () => {
  it('is deterministic and produces a sensible continent', () => {
    for (const seed of [1, 42, 1234, 99999, 31337]) {
      const w = generateWorld(seed)
      let land = 0
      let total = 0
      for (let y = 0; y < WORLD_H; y += 10) for (let x = 0; x < WORLD_W; x += 10) {
        total++
        if (isLand(w.terrain.biome(x, y))) land++
      }
      const frac = land / total
      console.log(seed, w.name, 'land', frac.toFixed(2), 'regions', w.regions.length)
      expect(frac).toBeGreaterThan(0.2)
      expect(frac).toBeLessThan(0.75)
      expect(w.regions.length).toBeGreaterThanOrEqual(5)
      const r = generateRegion(w, w.regions[0].id)
      const r2 = generateRegion(w, w.regions[0].id)
      expect(r2).toEqual(r)
      const towns = r.places.filter((p) => p.kind === 'settlement')
      expect(towns.length).toBeGreaterThan(0)
      const t = towns[0]
      if (t.kind !== 'settlement') throw new Error()
      const s = generateSettlement(seed, t.id, t.type, t.name)
      console.log('  ', t.type, t.name, 'buildings', s.buildings.length, 'pois', s.buildings.filter((b) => b.poi).length, 'npcs', s.npcs.length, 'places', r.places.length)
      expect(s.buildings.some((b) => b.poi === 'tavern')).toBe(true)
      const poi = s.buildings.find((b) => b.poi)!
      expect(generateBuilding(seed, poi).rooms.length).toBeGreaterThan(1)
      expect(generateDungeon(seed, `${w.regions[0].id}/d0`).rooms.length).toBeGreaterThanOrEqual(8)
    }
  })
})
