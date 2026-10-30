import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Attitude } from '../data/homebrew'
import type { Ability } from '../data/srd'
import { formatTerms, roll, type RollResult } from '../lib/dice'
import { uid } from '../lib/util'
import { starterBestiary } from '../data/monsters'

export type Abilities = Record<Ability, number>
export type TarotDraw = { card: string; position: string; reversed: boolean }

export type Character = {
  id: string
  name: string
  player: string
  level: number
  className: string
  species: string
  background: string
  bloodline: string
  abilities: Abilities
  saveProfs: Ability[]
  skillProfs: string[]
  maxHp: number
  hp: number
  tempHp: number
  ac: number
  speed: number
  mana: number
  maxMana: number
  spellAbility: Ability
  tarot: TarotDraw[]
  features: string
  inventory: string
  notes: string
  color: string
}

export type Spell = {
  id: string
  name: string
  school: string
  description: string
  casterId: string
  learnRoll: number
  learnDc: number
  learned: boolean
  powerRoll: number
  tier: string
  damage: string
  manaCost: number
  createdAt: number
}

export type NpcLogEntry = { id: string; text: string; time: number }

export type Npc = {
  id: string
  name: string
  role: string
  species: string
  attitude: Attitude
  chaMod: number
  trait: string
  want: string
  secret: string
  notes: string
  hp: number
  ac: number
  log: NpcLogEntry[]
}

export type Combatant = {
  id: string
  name: string
  initBonus: number
  init: number | null
  hp: number
  maxHp: number
  ac: number
  conditions: string[]
  side: 'party' | 'foe' | 'ally'
  refId?: string
  /** The enemy template this came from, so its attacks can be rolled. */
  monsterId?: string
}

export type Note = { id: string; title: string; body: string; tags: string; updatedAt: number }

export const CREATURE_SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const
export type CreatureSize = (typeof CREATURE_SIZES)[number]
export type Attack = { id: string; name: string; bonus: number; damage: string; notes: string }
/** A reusable enemy template the DM builds once and drops on the map as many times as needed. */
export type Monster = {
  id: string
  name: string
  size: CreatureSize
  type: string
  cr: string
  ac: number
  hp: string
  speed: string
  initBonus: number
  abilities: Abilities
  attacks: Attack[]
  traits: string
  color: string
  icon: string
}

export type TokenSide = 'party' | 'foe' | 'ally' | 'neutral'
/** x/y are the token's centre in grid cells; size is how many cells wide it is. */
export type Token = { id: string; label: string; color: string; x: number; y: number; size: number; side: TokenSide; icon?: string; combatantId?: string; monsterId?: string; refId?: string }
export type BattleGen = { preset: string; seed: number }
/** Either an uploaded/exported image or a generated map (stored as preset + seed, so it costs no storage). */
export type MapBoard = { image: string; gen: BattleGen | null; cols: number; rows: number; showGrid: boolean; snap: boolean; tokens: Token[] }

export type LogEntry = {
  id: string
  who: string
  label: string
  expr: string
  total: number
  detail: string
  crit?: 'hit' | 'miss'
  time: number
}

export const PLACE_STATES = ['Normal', 'Closed', 'Occupied', 'Abandoned', 'Destroyed', 'Cleared', 'Hidden'] as const
export type PlaceState = (typeof PLACE_STATES)[number]
export const MAP_NPC_STATES = ['Normal', 'Friendly', 'Hostile', 'Away', 'Missing', 'Captured', 'Dead'] as const
export type MapNpcState = (typeof MAP_NPC_STATES)[number]
export type PlaceEdit = { name?: string; state?: PlaceState; notes?: string }
export type MapNpcEdit = { name?: string; role?: string; state?: MapNpcState; notes?: string }
export type CustomMapNpc = { id: string; at: string; x: number; y: number; name: string; role: string }
/** A generated world is stored as its seed plus whatever the GM changed, so it is identical on every load. */
export type WorldSave = { seed: number; createdAt: number; places: Record<string, PlaceEdit>; npcs: Record<string, MapNpcEdit>; customNpcs: CustomMapNpc[] }

export type Macro = { id: string; name: string; expr: string }

export type Settings = {
  statRerolls: number
  tarotRedraws: number
  learnDc: number
  powerDie: string
  manaDie: string
  houseRules: string
}

export type GameData = {
  version: 1
  campaignName: string
  characters: Character[]
  spells: Spell[]
  npcs: Npc[]
  combat: { round: number; turn: number; combatants: Combatant[] }
  notes: Note[]
  map: MapBoard
  bestiary: Monster[]
  world: WorldSave | null
  log: LogEntry[]
  macros: Macro[]
  settings: Settings
  activeCharacterId: string | null
}

type Actions = {
  /** Mutate the game with an immer draft. */
  edit: (fn: (draft: GameData) => void) => void
  /** Roll dice, add it to the shared log and return the result. Throws on bad notation. */
  rollDice: (expr: string, label?: string, who?: string) => RollResult
  replaceAll: (data: GameData) => void
  newCampaign: (name: string) => void
}

export const DEFAULT_SETTINGS: Settings = {
  statRerolls: 2,
  tarotRedraws: 1,
  learnDc: 12,
  powerDie: '1d20',
  manaDie: '1d6',
  houseRules: '',
}

export function emptyGame(name = 'New Campaign'): GameData {
  return {
    version: 1,
    campaignName: name,
    characters: [],
    spells: [],
    npcs: [],
    combat: { round: 1, turn: 0, combatants: [] },
    notes: [],
    map: emptyMap(),
    bestiary: starterBestiary(),
    world: null,
    log: [],
    macros: [
      { id: 'm1', name: 'Stat roll', expr: '4d6dl1' },
      { id: 'm2', name: 'Fireball-ish', expr: '8d6' },
      { id: 'm3', name: 'Exploding d6', expr: '1d6!' },
    ],
    settings: { ...DEFAULT_SETTINGS },
    activeCharacterId: null,
  }
}

export function pickData(s: GameData): GameData {
  const { version, campaignName, characters, spells, npcs, combat, notes, map, bestiary, world, log, macros, settings, activeCharacterId } = s
  return { version, campaignName, characters, spells, npcs, combat, notes, map, bestiary, world, log, macros, settings, activeCharacterId }
}

export function emptyMap(): MapBoard {
  return { image: '', gen: { preset: 'forest', seed: 1 }, cols: 30, rows: 20, showGrid: true, snap: true, tokens: [] }
}

/** Brings saves from older versions up to date (adds missing fields, converts old % token positions to grid cells). */
export function normalizeGame(data: Partial<GameData>): Partial<GameData> {
  const out = { ...data }
  const map = data.map as (Partial<MapBoard> & { grid?: number }) | undefined
  if (map && map.cols === undefined) {
    const cols = 30
    const rows = 20
    out.map = {
      image: map.image ?? '',
      gen: map.image ? null : emptyMap().gen,
      cols,
      rows,
      showGrid: map.showGrid ?? true,
      snap: true,
      tokens: (map.tokens ?? []).map((t) => ({ ...t, x: (t.x / 100) * cols, y: (t.y / 100) * rows, size: 1, side: 'neutral' as const })),
    }
  }
  if (!Array.isArray(data.bestiary)) out.bestiary = starterBestiary()
  return out
}


export const useGame = create<GameData & Actions>()(
  persist(
    immer((set) => ({
      ...emptyGame('My First Campaign'),
      edit: (fn) => set((s) => void fn(s)),
      rollDice: (expr, label = '', who = 'DM') => {
        const r = roll(expr)
        set((s) => {
          s.log.unshift({
            id: uid(),
            who,
            label,
            expr: r.expr,
            total: r.total,
            detail: formatTerms(r),
            crit: r.crit,
            time: Date.now(),
          })
          if (s.log.length > 300) s.log.length = 300
        })
        return r
      },
      replaceAll: (data) => set(() => ({ ...emptyGame(), ...normalizeGame(data), settings: { ...DEFAULT_SETTINGS, ...data.settings } })),
      newCampaign: (name) => set(() => emptyGame(name)),
    })),
    {
      name: 'runeborne-game',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => pickData(s),
      merge: (persisted, current) => {
        const p = persisted ? normalizeGame(persisted as Partial<GameData>) : undefined
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p?.settings } }
      },
    },
  ),
)

export function useCharacter(id: string | null | undefined) {
  return useGame((s) => s.characters.find((c) => c.id === id))
}
