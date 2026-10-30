import { averageRoll, mod } from '../lib/dice'
import { uid } from '../lib/util'
import type { Abilities, CreatureSize, Monster } from '../store/game'

export const CREATURE_TYPES = [
  'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead',
]

export const CR_VALUES = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))]

/** Grid cells a creature of each size takes up (Tiny shares a cell, so it is drawn smaller). */
export const SIZE_CELLS: Record<CreatureSize, number> = { Tiny: 1, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4 }

export function crNumber(cr: string): number {
  if (cr.includes('/')) {
    const [a, b] = cr.split('/').map(Number)
    return b ? a / b : 0
  }
  return Number(cr) || 0
}

/** SRD rule: proficiency bonus by challenge rating. */
export function profByCr(cr: string): number {
  return 2 + Math.floor(Math.max(0, crNumber(cr) - 1) / 4)
}

export function averageHp(m: Pick<Monster, 'hp'>): number {
  return averageRoll(m.hp) ?? (Number(m.hp) || 1)
}

const abil = (str: number, dex: number, con: number, int: number, wis: number, cha: number): Abilities => ({ str, dex, con, int, wis, cha })

type Starter = Omit<Monster, 'id' | 'attacks' | 'initBonus'> & { attacks: [string, number, string, string][] }

// Starter templates based on monsters in the SRD (CC-BY-4.0). Edit or delete freely.
const STARTERS: Starter[] = [
  { name: 'Goblin', size: 'Small', type: 'Humanoid', cr: '1/4', ac: 15, hp: '2d6', speed: '30 ft', abilities: abil(8, 14, 10, 10, 8, 8), color: '#65a30d', icon: 'Skull',
    attacks: [['Scimitar', 4, '1d6+2', 'Slashing, reach 5 ft'], ['Shortbow', 4, '1d6+2', 'Piercing, range 80/320 ft']],
    traits: 'Nimble Escape: can Disengage or Hide as a bonus action.' },
  { name: 'Bandit', size: 'Medium', type: 'Humanoid', cr: '1/8', ac: 12, hp: '2d8+2', speed: '30 ft', abilities: abil(11, 12, 12, 10, 10, 10), color: '#a16207', icon: 'Swords',
    attacks: [['Scimitar', 3, '1d6+1', 'Slashing, reach 5 ft'], ['Light Crossbow', 3, '1d8+1', 'Piercing, range 80/320 ft']], traits: '' },
  { name: 'Cultist', size: 'Medium', type: 'Humanoid', cr: '1/8', ac: 12, hp: '2d8', speed: '30 ft', abilities: abil(11, 12, 10, 10, 11, 10), color: '#7c3aed', icon: 'VenetianMask',
    attacks: [['Scimitar', 3, '1d6+1', 'Slashing, reach 5 ft']], traits: 'Dark Devotion: advantage on saves against being charmed or frightened.' },
  { name: 'Skeleton', size: 'Medium', type: 'Undead', cr: '1/4', ac: 13, hp: '2d8+4', speed: '30 ft', abilities: abil(10, 14, 15, 6, 8, 5), color: '#d6d3d1', icon: 'Bone',
    attacks: [['Shortsword', 4, '1d6+2', 'Piercing, reach 5 ft'], ['Shortbow', 4, '1d6+2', 'Piercing, range 80/320 ft']],
    traits: 'Vulnerable to bludgeoning. Immune to poison and exhaustion.' },
  { name: 'Zombie', size: 'Medium', type: 'Undead', cr: '1/4', ac: 8, hp: '3d8+9', speed: '20 ft', abilities: abil(13, 6, 16, 3, 6, 5), color: '#4d7c0f', icon: 'Biohazard',
    attacks: [['Slam', 3, '1d6+1', 'Bludgeoning, reach 5 ft']],
    traits: 'Undead Fortitude: when dropped to 0 HP (not by radiant damage or a crit), CON save DC 5 + damage taken to drop to 1 HP instead.' },
  { name: 'Wolf', size: 'Medium', type: 'Beast', cr: '1/4', ac: 13, hp: '2d8+2', speed: '40 ft', abilities: abil(12, 15, 12, 3, 12, 6), color: '#78716c', icon: 'PawPrint',
    attacks: [['Bite', 4, '2d4+2', 'Piercing. DC 11 STR save or knocked prone']], traits: 'Pack Tactics: advantage on attacks if an ally is within 5 ft of the target.' },
  { name: 'Orc', size: 'Medium', type: 'Humanoid', cr: '1/2', ac: 13, hp: '2d8+6', speed: '30 ft', abilities: abil(16, 12, 16, 7, 11, 10), color: '#15803d', icon: 'Axe',
    attacks: [['Greataxe', 5, '1d12+3', 'Slashing, reach 5 ft'], ['Javelin', 5, '1d6+3', 'Piercing, range 30/120 ft']], traits: 'Aggressive: bonus action to move up to its speed toward an enemy.' },
  { name: 'Giant Spider', size: 'Large', type: 'Beast', cr: '1', ac: 14, hp: '4d10+4', speed: '30 ft, climb 30 ft', abilities: abil(14, 16, 12, 2, 11, 4), color: '#44403c', icon: 'Bug',
    attacks: [['Bite', 5, '1d8+3', 'Piercing, plus 2d8 poison (DC 11 CON save for half)'], ['Web (recharge 5-6)', 5, '', 'Range 30/60 ft. Target is restrained (DC 12 STR to escape)']],
    traits: 'Spider Climb. Web Sense. Web Walker.' },
  { name: 'Ogre', size: 'Large', type: 'Giant', cr: '2', ac: 11, hp: '7d10+21', speed: '40 ft', abilities: abil(19, 8, 16, 5, 7, 7), color: '#b45309', icon: 'Hammer',
    attacks: [['Greatclub', 6, '2d8+4', 'Bludgeoning, reach 5 ft'], ['Javelin', 6, '2d6+4', 'Piercing, range 30/120 ft']], traits: '' },
  { name: 'Owlbear', size: 'Large', type: 'Monstrosity', cr: '3', ac: 13, hp: '7d10+21', speed: '40 ft', abilities: abil(20, 12, 17, 3, 12, 7), color: '#92400e', icon: 'Bird',
    attacks: [['Beak', 7, '1d10+5', 'Piercing, reach 5 ft'], ['Claws', 7, '2d8+5', 'Slashing, reach 5 ft']], traits: 'Multiattack: one beak and one claws attack. Keen Sight and Smell.' },
]

export function starterBestiary(): Monster[] {
  return STARTERS.map((s) => ({
    ...s,
    id: uid(),
    initBonus: mod(s.abilities.dex),
    attacks: s.attacks.map(([name, bonus, damage, notes]) => ({ id: uid(), name, bonus, damage, notes })),
  }))
}

export function blankMonster(): Monster {
  return {
    id: uid(), name: 'New enemy', size: 'Medium', type: 'Humanoid', cr: '1', ac: 13, hp: '4d8+4', speed: '30 ft', initBonus: 1,
    abilities: abil(12, 12, 12, 10, 10, 10), attacks: [{ id: uid(), name: 'Strike', bonus: 4, damage: '1d8+2', notes: '' }], traits: '', color: '#dc2626', icon: 'Skull',
  }
}

/**
 * RuneBorne homebrew quick-build: rough AC, HP and attack numbers for a challenge rating,
 * so the DM can make a fair-ish enemy in one click and then tweak it.
 */
export function quickBuild(m: Monster, cr: string): Monster {
  const n = crNumber(cr)
  const prof = profByCr(cr)
  const hpAvg = Math.max(4, Math.round(6 + n * 15))
  const hitDie = m.size === 'Large' ? 10 : m.size === 'Huge' ? 12 : m.size === 'Gargantuan' ? 20 : m.size === 'Small' || m.size === 'Tiny' ? 6 : 8
  const conMod = Math.min(5, Math.max(0, Math.round(n / 3)))
  const dice = Math.max(1, Math.round(hpAvg / ((hitDie + 1) / 2 + conMod)))
  const main = Math.min(5, 2 + Math.round(n / 4))
  const perHit = Math.max(3, Math.round(4 + n * 3.5))
  const dmgDice = Math.max(1, Math.round((perHit - main) / 4.5))
  return {
    ...m,
    cr,
    ac: Math.min(19, 12 + Math.round(n / 3)),
    hp: `${dice}d${hitDie}${conMod ? `+${dice * conMod}` : ''}`,
    abilities: { ...m.abilities, str: 10 + main * 2, con: 10 + conMod * 2 },
    attacks: m.attacks.length
      ? m.attacks.map((a, i) => (i === 0 ? { ...a, bonus: prof + main, damage: `${dmgDice}d8+${main}` } : { ...a, bonus: prof + main }))
      : [{ id: uid(), name: 'Strike', bonus: prof + main, damage: `${dmgDice}d8+${main}`, notes: '' }],
  }
}
