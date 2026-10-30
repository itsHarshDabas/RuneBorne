import { create } from 'zustand'

export const TABS = ['Dice', 'Characters', 'Spell Forge', 'NPCs', 'Combat', 'Items', 'Map', 'Notes', 'Generators', 'Saves'] as const
export type Tab = (typeof TABS)[number]

export type MapMode = 'world' | 'battle'

/** UI-only state that should not be saved with the campaign. */
export const useUi = create<{
  tab: Tab
  rollingAs: string
  mapMode: MapMode
  setTab: (t: Tab) => void
  setRollingAs: (who: string) => void
  setMapMode: (m: MapMode) => void
}>((set) => ({
  tab: 'Dice',
  rollingAs: 'DM',
  mapMode: 'world',
  setTab: (tab) => set({ tab }),
  setRollingAs: (rollingAs) => set({ rollingAs }),
  setMapMode: (mapMode) => set({ mapMode, tab: 'Map' }),
}))
