import { describe, expect, it } from 'vitest'
import { ITEM_BY_ID, ITEMS, SHOP_STOCK } from '../data/items'
import { emptyGame, normalizeGame, type Character } from '../store/game'
import { newCharacter } from './character'
import { roll } from './dice'
import { addItem, applyItem, formatPrice, pay, roundPrice, shopStock, toInv, totalCp } from './items'

const rollDice = (expr: string) => roll(expr)

describe('items', () => {
  it('has unique ids and every shop staple exists', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
    for (const spec of Object.values(SHOP_STOCK)) for (const id of spec.ids ?? []) expect(ITEM_BY_ID.has(id), id).toBe(true)
  })

  it('pays with change and refuses what you cannot afford', () => {
    const c = { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }
    expect(pay(c, 2.5)).toBe(true)
    expect(c).toEqual({ cp: 0, sp: 5, ep: 0, gp: 7, pp: 0 })
    expect(pay(c, 100)).toBe(false)
    expect(totalCp(c)).toBe(750)
    expect(formatPrice(0.04)).toBe('4 cp')
    expect(formatPrice(0.5)).toBe('5 sp')
    expect(formatPrice(1500)).toBe('1,500 gp')
    expect([roundPrice(44.75), roundPrice(4.31), roundPrice(0.237)]).toEqual([45, 4.3, 0.24])
  })

  it('stocks every shop the same way each time', () => {
    for (const poi of Object.keys(SHOP_STOCK)) {
      const a = shopStock(42, `b1/h${poi}`, poi, 'city', ITEMS)
      expect(a.length, poi).toBeGreaterThan(2)
      expect(shopStock(42, `b1/h${poi}`, poi, 'city', ITEMS)).toEqual(a)
    }
  })

  it('drinks a potion, heals, and uses it up', () => {
    const d = emptyGame()
    const ch: Character = newCharacter({ maxHp: 30, hp: 5 })
    d.characters.push(ch)
    addItem(ch.items, toInv(ITEM_BY_ID.get('potion-of-healing')!, 2))
    d.combat.combatants.push({ id: 'x', name: ch.name, initBonus: 0, init: 10, hp: 5, maxHp: 30, ac: 10, conditions: [], side: 'party', refId: ch.id })
    const text = applyItem(d, rollDice, ch.id, ch.items[0].id)
    expect(ch.hp).toBeGreaterThanOrEqual(9)
    expect(ch.hp).toBeLessThanOrEqual(15)
    expect(d.combat.combatants[0].hp).toBe(ch.hp)
    expect(ch.items[0].qty).toBe(1)
    expect(text).toMatch(/regained/)
  })

  it('spends wand charges instead of the wand', () => {
    const d = emptyGame()
    const ch = newCharacter()
    d.characters.push(ch)
    addItem(ch.items, toInv(ITEM_BY_ID.get('wand-of-magic-missiles')!))
    applyItem(d, rollDice, ch.id, ch.items[0].id)
    expect(ch.items[0].charges).toBe(6)
    expect(ch.items).toHaveLength(1)
  })

  it('turns an old text inventory into items', () => {
    const old = { ...newCharacter(), inventory: 'Rope\n\n3 torches ' } as Character & { inventory?: string }
    delete (old as { items?: unknown }).items
    const out = normalizeGame({ characters: [old] })
    expect(out.characters![0].items.map((i) => i.name)).toEqual(['Rope', '3 torches'])
    expect(out.stash?.items).toEqual([])
  })
})
