import { averageHp, SIZE_CELLS } from '../data/monsters'
import type { GameData, Monster, Token } from '../store/game'
import { applyAdvantage, roll, rollExprWithBonus, type Advantage, type RollResult } from './dice'
import { clamp, uid } from './util'

type RollFn = (expr: string, label?: string, who?: string) => RollResult

export function setHp(d: GameData, id: string, hp: number) {
  const c = d.combat.combatants.find((x) => x.id === id)
  if (!c) return
  c.hp = clamp(hp, 0, c.maxHp)
  // Keep the character sheet in sync for party members
  const pc = c.refId ? d.characters.find((x) => x.id === c.refId) : undefined
  if (pc && c.side === 'party') pc.hp = c.hp
}

export function nextTurn(d: GameData, dir: 1 | -1) {
  const n = d.combat.combatants.length
  if (!n) return
  let t = d.combat.turn + dir
  if (t >= n) {
    t = 0
    d.combat.round += 1
  } else if (t < 0) {
    t = n - 1
    d.combat.round = Math.max(1, d.combat.round - 1)
  }
  d.combat.turn = t
}

export type AttackOutcome = { hit: boolean; crit: boolean; damage: number; text: string }

/** Rolls to hit against an AC and, on a hit, rolls damage (crits double the dice). Logs both rolls. */
export function rollAttack(rollDice: RollFn, opts: { who?: string; targetName: string; targetAc: number; bonus: number; damage: string; adv: Advantage }): AttackOutcome {
  const r = rollDice(applyAdvantage(rollExprWithBonus(opts.bonus), opts.adv), `Attack → ${opts.targetName} (AC ${opts.targetAc})`, opts.who)
  const crit = r.crit === 'hit'
  const hit = crit || (r.crit !== 'miss' && r.total >= opts.targetAc)
  let text = `${r.total} vs AC ${opts.targetAc}: ${crit ? 'CRITICAL HIT!' : hit ? 'Hit' : 'Miss'}`
  let damage = 0
  if (hit && opts.damage.trim()) {
    const dmgExpr = crit ? opts.damage.replace(/(\d*)d(\d+)/gi, (_, n, s) => `${(Number(n) || 1) * 2}d${s}`) : opts.damage
    try {
      damage = Math.max(0, rollDice(dmgExpr, `Damage → ${opts.targetName}`, opts.who).total)
      text += ` for ${damage} damage`
    } catch (e) {
      text += ` (damage: ${(e as Error).message})`
    }
  }
  return { hit, crit, damage, text }
}

/** Finds the nearest free spot for a token of the given size, spiralling out from a cell. */
export function freeSpot(d: GameData, size: number, near: { x: number; y: number }, taken: Token[] = d.map.tokens): { x: number; y: number } {
  const { cols, rows } = d.map
  const blocked = (cx: number, cy: number) => taken.some((t) => Math.abs(t.x - cx) < (t.size + size) / 2 && Math.abs(t.y - cy) < (t.size + size) / 2)
  const sx = Math.round(near.x - size / 2)
  const sy = Math.round(near.y - size / 2)
  for (let ring = 0; ring < Math.max(cols, rows); ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
        const tx = clamp(sx + dx, 0, cols - size)
        const ty = clamp(sy + dy, 0, rows - size)
        const cx = tx + size / 2
        const cy = ty + size / 2
        if (!blocked(cx, cy)) return { x: cx, y: cy }
      }
    }
  }
  return { x: near.x, y: near.y }
}

/**
 * Drops copies of an enemy onto the battle map and into the combat tracker (which holds their HP).
 * Names continue the numbering of any copies already in play.
 */
export function spawnMonster(d: GameData, m: Monster, opts: { count: number; rollHp: boolean; near?: { x: number; y: number } }): string[] {
  const size = SIZE_CELLS[m.size]
  const already = d.combat.combatants.filter((c) => c.monsterId === m.id || c.name === m.name || c.name.startsWith(`${m.name} `)).length
  const numbered = opts.count > 1 || already > 0
  const near = opts.near ?? { x: d.map.cols * 0.7, y: d.map.rows / 2 }
  const ids: string[] = []
  for (let i = 0; i < opts.count; i++) {
    let hp = averageHp(m)
    if (opts.rollHp) {
      try {
        hp = Math.max(1, roll(m.hp).total)
      } catch {
        // Not dice notation: keep the fixed value
      }
    }
    const name = numbered ? `${m.name} ${already + i + 1}` : m.name
    const combatantId = uid()
    d.combat.combatants.push({ id: combatantId, name, initBonus: m.initBonus, init: null, hp, maxHp: hp, ac: m.ac, conditions: [], side: 'foe', monsterId: m.id })
    const spot = freeSpot(d, size, near)
    const id = uid()
    d.map.tokens.push({ id, label: name, color: m.color, x: spot.x, y: spot.y, size, side: 'foe', icon: m.icon, combatantId, monsterId: m.id })
    ids.push(id)
  }
  return ids
}

/** Puts every character on the map (and into combat if they aren't already), linked so HP stays in sync. */
export function spawnParty(d: GameData) {
  let near = { x: d.map.cols * 0.25, y: d.map.rows / 2 }
  for (const pc of d.characters) {
    if (d.map.tokens.some((t) => t.refId === pc.id)) continue
    let c = d.combat.combatants.find((x) => x.refId === pc.id)
    if (!c) {
      c = { id: uid(), name: pc.name, initBonus: Math.floor((pc.abilities.dex - 10) / 2), init: null, hp: pc.hp, maxHp: pc.maxHp, ac: pc.ac, conditions: [], side: 'party', refId: pc.id }
      d.combat.combatants.push(c)
    }
    const spot = freeSpot(d, 1, near)
    near = spot
    d.map.tokens.push({ id: uid(), label: pc.name, color: pc.color, x: spot.x, y: spot.y, size: 1, side: 'party', icon: 'User', combatantId: c.id, refId: pc.id })
  }
}

/** Removes a token; foes also leave the combat tracker. */
export function removeToken(d: GameData, id: string) {
  const t = d.map.tokens.find((k) => k.id === id)
  d.map.tokens = d.map.tokens.filter((k) => k.id !== id)
  if (t?.combatantId && t.side === 'foe') {
    d.combat.combatants = d.combat.combatants.filter((c) => c.id !== t.combatantId)
    d.combat.turn = clamp(d.combat.turn, 0, Math.max(0, d.combat.combatants.length - 1))
  }
}
