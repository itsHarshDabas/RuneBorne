import { ABILITIES, findClass, findSpecies, proficiencyBonus, SKILLS, type Ability } from '../data/srd'
import type { Abilities, Character } from '../store/game'
import { mod } from './dice'
import { uid } from './util'

export const PLAYER_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#f87171', '#facc15', '#2dd4bf']

export function baseAbilities(n = 10): Abilities {
  return Object.fromEntries(ABILITIES.map((a) => [a, n])) as Abilities
}

export function newCharacter(partial: Partial<Character> = {}): Character {
  return {
    id: uid(),
    name: 'Unnamed Hero',
    player: '',
    level: 1,
    className: '',
    species: '',
    background: '',
    bloodline: 'None',
    abilities: baseAbilities(),
    saveProfs: [],
    skillProfs: [],
    maxHp: 8,
    hp: 8,
    tempHp: 0,
    ac: 10,
    speed: 30,
    mana: 0,
    maxMana: 0,
    spellAbility: 'int',
    tarot: [],
    features: '',
    items: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
    notes: '',
    color: PLAYER_COLORS[0],
    ...partial,
  }
}

export function skillBonus(c: Character, skill: string): number {
  const info = SKILLS.find((s) => s.name === skill)
  if (!info) return 0
  return mod(c.abilities[info.ability]) + (c.skillProfs.includes(skill) ? proficiencyBonus(c.level) : 0)
}

export function saveBonus(c: Character, a: Ability): number {
  return mod(c.abilities[a]) + (c.saveProfs.includes(a) ? proficiencyBonus(c.level) : 0)
}

export function startingHp(className: string, con: number): number {
  const hitDie = findClass(className)?.hitDie ?? 8
  return Math.max(1, hitDie + mod(con))
}

/** RuneBorne homebrew: casters start with 4 mana + 2 per point of spellcasting modifier. */
export function startingMana(className: string, abilities: Abilities, bloodline: string): number {
  const cls = findClass(className)
  const extra = bloodline === 'Primordial' ? 2 : 0
  if (!cls?.spellAbility) return extra
  return 4 + Math.max(0, mod(abilities[cls.spellAbility])) * 2 + extra
}

export function defaultSpeed(species: string): number {
  return findSpecies(species)?.speed ?? 30
}
