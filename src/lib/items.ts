import { ITEMS, lootTable, rarityRank, SHOP_STOCK, type ItemDef } from '../data/items'
import { makeRng } from '../features/world/random'
import type { Character, Coins, GameData, InvItem } from '../store/game'
import type { RollResult } from './dice'
import { clamp, uid } from './util'

type RollFn = (expr: string, label?: string, who?: string) => RollResult

export const COIN_CP: Record<keyof Coins, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }

export function allItems(d: Pick<GameData, 'customItems'>): ItemDef[] {
  return [...ITEMS, ...d.customItems]
}

export function findItem(d: Pick<GameData, 'customItems'>, id: string): ItemDef | undefined {
  return d.customItems.find((i) => i.id === id) ?? ITEMS.find((i) => i.id === id)
}

export function toInv(def: ItemDef, qty = 1): InvItem {
  const { id, custom: _custom, ...rest } = def
  void _custom
  return { ...rest, id: uid(), defId: id, qty }
}

/** Adds to a list, stacking with an identical copy when there is one. */
export function addItem(list: InvItem[], item: InvItem) {
  const same = list.find((i) => i.defId && i.defId === item.defId && i.text === item.text && i.charges === item.charges && i.name === item.name && !i.equipped)
  if (same) same.qty += item.qty
  else list.push(item)
}

export function takeItem(list: InvItem[], id: string, qty = 1): InvItem | null {
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return null
  const it = list[i]
  const n = Math.min(qty, it.qty)
  it.qty -= n
  if (it.qty <= 0) list.splice(i, 1)
  return { ...it, id: uid(), qty: n, equipped: false }
}

export const totalCp = (c: Coins) => (Object.keys(COIN_CP) as (keyof Coins)[]).reduce((a, k) => a + (c[k] || 0) * COIN_CP[k], 0)

/** Pays a price in gold pieces, making change. Returns false (and changes nothing) when they cannot afford it. */
export function pay(c: Coins, gp: number): boolean {
  const cost = Math.round(gp * 100)
  let left = totalCp(c) - cost
  if (left < 0) return false
  // Keep platinum and electrum where possible; change comes back as gold, silver and copper
  const pp = Math.min(c.pp, Math.floor(left / 1000))
  left -= pp * 1000
  const ep = Math.min(c.ep, Math.floor(left / 50))
  left -= ep * 50
  const g = Math.floor(left / 100)
  left -= g * 100
  const s = Math.floor(left / 10)
  Object.assign(c, { pp, ep, gp: g, sp: s, cp: left - s * 10 })
  return true
}

export function formatPrice(gp: number): string {
  if (gp <= 0) return '—'
  const cp = Math.round(gp * 100)
  if (cp % 100 === 0) return `${(cp / 100).toLocaleString()} gp`
  if (cp >= 100) return `${(cp / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} gp`
  if (cp % 10 === 0) return `${cp / 10} sp`
  return `${cp} cp`
}

export function formatCoins(c: Coins): string {
  const parts = (['pp', 'gp', 'ep', 'sp', 'cp'] as const).filter((k) => c[k]).map((k) => `${c[k]} ${k}`)
  return parts.length ? parts.join(', ') : 'no coins'
}

export const carried = (items: InvItem[]) => items.reduce((a, i) => a + i.weight * i.qty, 0)
/** 2024 rules: a creature can carry 15 lb per point of Strength. */
export const capacity = (c: Character) => c.abilities.str * 15

/**
 * Uses one item from a character's pack: heals, restores mana, rolls damage or casts the scroll's spell.
 * Everything rolled goes to the roll log. Returns a line describing what happened.
 */
export function applyItem(d: GameData, rollDice: RollFn, charId: string, itemId: string): string {
  const ch = d.characters.find((c) => c.id === charId)
  const it = ch?.items.find((i) => i.id === itemId)
  if (!ch || !it) return ''
  if (it.charges !== undefined && it.charges <= 0) return `${it.name} has no charges left.`
  const e = it.effect
  let text = `${ch.name} used ${it.name}.`
  if (e?.type === 'heal' || (e?.type === 'spell' && e.heal && e.dice)) {
    const n = Math.max(0, rollDice(e.dice!, it.name, ch.name).total)
    const before = ch.hp
    ch.hp = clamp(ch.hp + n, 0, ch.maxHp)
    // Party members in the combat tracker heal too
    for (const cb of d.combat.combatants) if (cb.refId === ch.id && cb.side === 'party') cb.hp = ch.hp
    text = `${ch.name} ${e.type === 'spell' ? `cast ${e.spell}` : `drank ${it.name}`} and regained ${ch.hp - before} HP (rolled ${n}).`
  } else if (e?.type === 'mana') {
    const n = Math.max(0, rollDice(e.dice, it.name, ch.name).total)
    const before = ch.mana
    ch.mana = Math.min(ch.maxMana || ch.mana + n, ch.mana + n)
    text = `${ch.name} used ${it.name} and restored ${ch.mana - before} mana (rolled ${n}).`
  } else if (e?.type === 'damage') {
    const n = rollDice(e.dice, it.name, ch.name).total
    text = `${ch.name} used ${it.name}: ${n} damage.`
  } else if (e?.type === 'spell') {
    if (e.dice) text = `${ch.name} cast ${e.spell} from ${it.name}: ${rollDice(e.dice, e.spell, ch.name).total}.`
    else text = `${ch.name} cast ${e.spell} from ${it.name}.`
  }
  if (it.charges !== undefined) it.charges -= 1
  if (it.consumable) takeItem(ch.items, it.id, 1)
  return text
}

/** Shop prices land on sensible coins: whole gold above 10 gp, silver above 1 gp, copper below. */
export function roundPrice(gp: number): number {
  if (gp >= 10) return Math.round(gp)
  if (gp >= 1) return Math.round(gp * 10) / 10
  return Math.max(0.01, Math.round(gp * 100) / 100)
}

export type StockLine = { defId: string; price: number; qty: number }

/** A shop's stock is seeded by the world and the shop, so it is the same every visit. Prices vary a little per shop. */
export function shopStock(worldSeed: number, placeId: string, poi: string, townType: string, items: ItemDef[]): StockLine[] {
  const spec = SHOP_STOCK[poi]
  if (!spec) return []
  const rng = makeRng(`${worldSeed}/${placeId}/stock`)
  const markup = { capital: 0.95, city: 1, town: 1.05, village: 1.15 }[townType] ?? 1
  const pool = items.filter((i) => !i.custom && rarityRank(i.rarity) <= rarityRank(spec.maxRarity) && ((spec.kinds?.includes(i.kind) ?? false) || (spec.ids?.includes(i.id) ?? false)))
  const picked: ItemDef[] = []
  // Named staples first, then a random selection of the rest
  for (const id of spec.ids ?? []) {
    const it = pool.find((i) => i.id === id)
    if (it && rng.chance(0.85)) picked.push(it)
  }
  const rest = pool.filter((i) => !picked.includes(i))
  while (picked.length < spec.size && rest.length) picked.push(rest.splice(rng.int(0, rest.length - 1), 1)[0])
  return picked.map((it) => {
    const rare = rarityRank(it.rarity)
    const qty = it.consumable ? Math.ceil(rng.int(2, 8) / (1 + rare)) : rare >= 2 ? 1 : rng.int(1, 4)
    const price = roundPrice(it.cost * markup * rng.range(0.9, 1.15))
    return { defId: it.id, price, qty: Math.max(1, qty) }
  })
}

/** Rolls treasure for a defeated creature of the given CR. */
export function rollLoot(rollDice: RollFn, cr: number, items: ItemDef[], who = 'DM'): { coins: Partial<Coins>; items: ItemDef[]; text: string } {
  const t = lootTable(cr)
  const n = rollDice(t.dice, `Loot (CR ${cr > 0 && cr < 1 ? `1/${Math.round(1 / cr)}` : cr})`, who).total * t.mult
  const rng = makeRng(`${Date.now()}/${Math.random()}`)
  const found: ItemDef[] = []
  const pool = items.filter((i) => i.rarity !== 'mundane' || i.kind === 'treasure' || i.kind === 'trinket')
  for (let k = 0; k < 3; k++) {
    if (!rng.chance(t.itemChance / (k + 1))) break
    const ok = pool.filter((i) => rarityRank(i.rarity) <= rarityRank(t.maxRarity))
    if (ok.length) found.push(rng.pick(ok))
  }
  const text = `${n} ${t.coin}${found.length ? ` and ${found.map((f) => f.name).join(', ')}` : ''}`
  return { coins: { [t.coin]: n }, items: found, text }
}

export function effectLabel(it: Pick<ItemDef, 'effect'>): string {
  const e = it.effect
  if (!e) return ''
  if (e.type === 'heal') return `Heals ${e.dice}`
  if (e.type === 'mana') return `Restores ${e.dice} mana`
  if (e.type === 'damage') return `${e.dice} damage`
  if (e.type === 'spell') return `Casts ${e.spell}${e.dice ? ` (${e.dice})` : ''}`
  return 'Readable'
}
