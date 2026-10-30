import { create } from 'zustand'

export const TABS = ['Dice', 'Characters', 'Spell Forge', 'NPCs', 'Combat', 'Map', 'Notes', 'Generators', 'Saves'] as const
export type Tab = (typeof TABS)[number]

/** UI-only state that should not be saved with the campaign. */
export const useUi = create<{ tab: Tab; rollingAs: string; setTab: (t: Tab) => void; setRollingAs: (who: string) => void }>((set) => ({
  tab: 'Dice',
  rollingAs: 'DM',
  setTab: (tab) => set({ tab }),
  setRollingAs: (rollingAs) => set({ rollingAs }),
}))
