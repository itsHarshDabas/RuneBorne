import { describe, expect, it } from 'vitest'
import { generateAtlas } from './worldgen'

describe('atlas generation', () => {
  it('builds a deterministic continent with rivers, realms, towns and roads', () => {
    for (const seed of [1, 42, 777, 31337]) {
      const t0 = performance.now()
      const a = generateAtlas(seed)
      const ms = performance.now() - t0
      let land = 0
      for (let i = 0; i < a.n; i++) if (a.water[i] === 0) land++
      console.log(seed, a.name, `${Math.round(ms)}ms`, 'cells', a.n, 'land', (land / a.n).toFixed(2), 'rivers', a.rivers.length, 'realms', a.realms.length, 'burgs', a.burgs.length, 'roads', a.roads.length, 'sites', a.sites.length, 'coasts', a.coasts.length, 'lakes', a.lakes.length, 'borders', a.borders.length)
      expect(land / a.n).toBeGreaterThan(0.25)
      expect(a.realms.length).toBeGreaterThanOrEqual(4)
      expect(a.burgs.filter((b) => b.type === 'town').length).toBeGreaterThan(5)
      expect(a.rivers.length).toBeGreaterThan(3)
      expect(a.roads.length).toBeGreaterThan(5)
      expect(a.coasts.length).toBeGreaterThan(0)
      for (const b of a.burgs) expect(a.water[b.cell]).toBe(0)
    }
    expect(generateAtlas(42).burgs.map((b) => b.name)).toEqual(generateAtlas(42).burgs.map((b) => b.name))
  })
})
