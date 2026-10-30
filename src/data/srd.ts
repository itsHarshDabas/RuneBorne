// Rules data drawn from the System Reference Document 5.2 (SRD 5.2) by Wizards of the Coast LLC,
// licensed under CC-BY-4.0: https://creativecommons.org/licenses/by/4.0/
// Only names and numbers are stored here. Add your own homebrew freely; every picker also accepts typed custom values.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]

export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

export const SKILLS: { name: string; ability: Ability }[] = [
  { name: 'Acrobatics', ability: 'dex' },
  { name: 'Animal Handling', ability: 'wis' },
  { name: 'Arcana', ability: 'int' },
  { name: 'Athletics', ability: 'str' },
  { name: 'Deception', ability: 'cha' },
  { name: 'History', ability: 'int' },
  { name: 'Insight', ability: 'wis' },
  { name: 'Intimidation', ability: 'cha' },
  { name: 'Investigation', ability: 'int' },
  { name: 'Medicine', ability: 'wis' },
  { name: 'Nature', ability: 'int' },
  { name: 'Perception', ability: 'wis' },
  { name: 'Performance', ability: 'cha' },
  { name: 'Persuasion', ability: 'cha' },
  { name: 'Religion', ability: 'int' },
  { name: 'Sleight of Hand', ability: 'dex' },
  { name: 'Stealth', ability: 'dex' },
  { name: 'Survival', ability: 'wis' },
]

export type ClassInfo = {
  name: string
  hitDie: number
  primary: Ability[]
  saves: Ability[]
  spellAbility?: Ability
  skillCount: number
  skillOptions: string[] | 'any'
}

export const CLASSES: ClassInfo[] = [
  { name: 'Barbarian', hitDie: 12, primary: ['str'], saves: ['str', 'con'], skillCount: 2, skillOptions: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
  { name: 'Bard', hitDie: 8, primary: ['cha'], saves: ['dex', 'cha'], spellAbility: 'cha', skillCount: 3, skillOptions: 'any' },
  { name: 'Cleric', hitDie: 8, primary: ['wis'], saves: ['wis', 'cha'], spellAbility: 'wis', skillCount: 2, skillOptions: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
  { name: 'Druid', hitDie: 8, primary: ['wis'], saves: ['int', 'wis'], spellAbility: 'wis', skillCount: 2, skillOptions: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
  { name: 'Fighter', hitDie: 10, primary: ['str', 'dex'], saves: ['str', 'con'], skillCount: 2, skillOptions: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Persuasion', 'Perception', 'Survival'] },
  { name: 'Monk', hitDie: 8, primary: ['dex', 'wis'], saves: ['str', 'dex'], skillCount: 2, skillOptions: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
  { name: 'Paladin', hitDie: 10, primary: ['str', 'cha'], saves: ['wis', 'cha'], spellAbility: 'cha', skillCount: 2, skillOptions: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
  { name: 'Ranger', hitDie: 10, primary: ['dex', 'wis'], saves: ['str', 'dex'], spellAbility: 'wis', skillCount: 3, skillOptions: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
  { name: 'Rogue', hitDie: 8, primary: ['dex'], saves: ['dex', 'int'], skillCount: 4, skillOptions: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
  { name: 'Sorcerer', hitDie: 6, primary: ['cha'], saves: ['con', 'cha'], spellAbility: 'cha', skillCount: 2, skillOptions: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
  { name: 'Warlock', hitDie: 8, primary: ['cha'], saves: ['wis', 'cha'], spellAbility: 'cha', skillCount: 2, skillOptions: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
  { name: 'Wizard', hitDie: 6, primary: ['int'], saves: ['int', 'wis'], spellAbility: 'int', skillCount: 2, skillOptions: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion'] },
]

export type SpeciesInfo = { name: string; size: string; speed: number; traits: string[] }

export const SPECIES: SpeciesInfo[] = [
  { name: 'Dragonborn', size: 'Medium', speed: 30, traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Darkvision', 'Draconic Flight (lvl 5)'] },
  { name: 'Dwarf', size: 'Medium', speed: 30, traits: ['Darkvision 120 ft', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'] },
  { name: 'Elf', size: 'Medium', speed: 30, traits: ['Darkvision', 'Elven Lineage', 'Fey Ancestry', 'Keen Senses', 'Trance'] },
  { name: 'Gnome', size: 'Small', speed: 30, traits: ['Darkvision', 'Gnomish Cunning', 'Gnomish Lineage'] },
  { name: 'Goliath', size: 'Medium', speed: 35, traits: ['Giant Ancestry', 'Large Form (lvl 5)', 'Powerful Build'] },
  { name: 'Halfling', size: 'Small', speed: 30, traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'] },
  { name: 'Human', size: 'Medium or Small', speed: 30, traits: ['Resourceful', 'Skillful', 'Versatile'] },
  { name: 'Orc', size: 'Medium', speed: 30, traits: ['Adrenaline Rush', 'Darkvision 120 ft', 'Relentless Endurance'] },
  { name: 'Tiefling', size: 'Medium or Small', speed: 30, traits: ['Darkvision', 'Fiendish Legacy', 'Otherworldly Presence'] },
]

export type BackgroundInfo = { name: string; abilities: Ability[]; skills: string[]; feat: string }

export const BACKGROUNDS: BackgroundInfo[] = [
  { name: 'Acolyte', abilities: ['int', 'wis', 'cha'], skills: ['Insight', 'Religion'], feat: 'Magic Initiate (Cleric)' },
  { name: 'Criminal', abilities: ['dex', 'con', 'int'], skills: ['Sleight of Hand', 'Stealth'], feat: 'Alert' },
  { name: 'Sage', abilities: ['con', 'int', 'wis'], skills: ['Arcana', 'History'], feat: 'Magic Initiate (Wizard)' },
  { name: 'Soldier', abilities: ['str', 'dex', 'con'], skills: ['Athletics', 'Intimidation'], feat: 'Savage Attacker' },
]

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
]

/** 2024 point-buy costs, 27 points, scores 8-15 before background bonuses. */
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
export const POINT_BUY_BUDGET = 27
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4)
}

export function findClass(name: string) {
  return CLASSES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())
}
export function findSpecies(name: string) {
  return SPECIES.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())
}
export function findBackground(name: string) {
  return BACKGROUNDS.find((b) => b.name.toLowerCase() === name.trim().toLowerCase())
}
