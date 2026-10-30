import { describe, expect, it } from 'vitest'
import { starterBestiary } from '../data/monsters'
import { emptyGame, normalizeGame, type GameData } from '../store/game'
import { removeToken, spawnMonster } from './combat'

describe('spawnMonster', () => {
  it('adds numbered tokens and combatants that share an id link, without overlapping', () => {
    const d = emptyGame()
    const goblin = d.bestiary.find((m) => m.name === 'Goblin')!
    spawnMonster(d, goblin, { count: 3, rollHp: false })
    spawnMonster(d, goblin, { count: 1, rollHp: true })
    expect(d.combat.combatants.map((c) => c.name)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3', 'Goblin 4'])
    expect(d.combat.combatants[0].hp).toBe(7)
    for (const t of d.map.tokens) expect(d.combat.combatants.some((c) => c.id === t.combatantId)).toBe(true)
    const spots = new Set(d.map.tokens.map((t) => `${t.x},${t.y}`))
    expect(spots.size).toBe(4)
  })

  it('gives large creatures a 2x2 footprint and removes foes from combat with their token', () => {
    const d = emptyGame()
    const ogre = d.bestiary.find((m) => m.name === 'Ogre')!
    spawnMonster(d, ogre, { count: 1, rollHp: false })
    const t = d.map.tokens[0]
    expect(t.size).toBe(2)
    expect(Number.isInteger(t.x)).toBe(true)
    removeToken(d, t.id)
    expect(d.combat.combatants).toHaveLength(0)
  })
})

describe('normalizeGame', () => {
  it('converts old percentage tokens to grid cells and adds the starter bestiary', () => {
    const old = { ...emptyGame(), map: { image: 'x.png', grid: 50, showGrid: true, tokens: [{ id: 'a', label: 'Orc', color: '#f00', x: 50, y: 50 }] } } as unknown as GameData
    delete (old as Partial<GameData>).bestiary
    const n = normalizeGame(old)
    expect(n.map!.tokens[0]).toMatchObject({ x: 15, y: 10, size: 1 })
    expect(n.map!.gen).toBeNull()
    expect(n.bestiary!.length).toBe(starterBestiary().length)
  })
})
