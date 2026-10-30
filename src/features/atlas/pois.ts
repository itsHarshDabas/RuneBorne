// Points of interest that appear in towns, with who runs them and what rooms they have.
import type { BurgType } from './worldgen'

export type PoiType =
  | 'tavern' | 'inn' | 'blacksmith' | 'general' | 'alchemist' | 'magic' | 'library' | 'temple' | 'shrine'
  | 'guard' | 'manor' | 'bank' | 'stables' | 'guild' | 'market' | 'farm' | 'house'

export const POI_LABEL: Record<PoiType, string> = {
  tavern: 'Tavern', inn: 'Inn', blacksmith: 'Blacksmith', general: 'General Store', alchemist: 'Alchemist', magic: 'Magic Shop',
  library: 'Library', temple: 'Temple', shrine: 'Shrine', guard: 'Guard Post', manor: 'Noble Manor', bank: 'Bank',
  stables: 'Stables', guild: 'Guildhall', market: 'Market', farm: 'Farm', house: 'House',
}

export const POI_OWNER: Record<PoiType, string[]> = {
  tavern: ['Barkeep', 'Serving hand'], inn: ['Innkeeper', 'Stablehand'], blacksmith: ['Smith', 'Apprentice'],
  general: ['Shopkeeper'], alchemist: ['Alchemist', 'Assistant'], magic: ['Arcanist'], library: ['Librarian', 'Scholar'],
  temple: ['High Priest', 'Acolyte'], shrine: ['Hermit priest'], guard: ['Guard Captain', 'Guard'], manor: ['Lord', 'Butler'],
  bank: ['Banker'], stables: ['Stablemaster'], guild: ['Guildmaster', 'Clerk'], market: ['Merchant', 'Fishmonger'],
  farm: ['Farmer'], house: ['Resident'],
}

export const POIS: Record<BurgType, PoiType[]> = {
  capital: ['market', 'tavern', 'tavern', 'inn', 'inn', 'blacksmith', 'general', 'alchemist', 'magic', 'library', 'temple', 'guard', 'guard', 'manor', 'manor', 'bank', 'stables', 'guild'],
  city: ['market', 'tavern', 'tavern', 'inn', 'blacksmith', 'general', 'alchemist', 'magic', 'library', 'temple', 'guard', 'guard', 'manor', 'bank', 'stables', 'guild'],
  town: ['market', 'tavern', 'inn', 'blacksmith', 'general', 'alchemist', 'library', 'temple', 'guard', 'stables'],
  village: ['tavern', 'general', 'shrine', 'blacksmith'],
}

export const COMMONERS = ['Farmer', 'Beggar', 'Child', 'Merchant', 'Guard', 'Drunk', 'Pilgrim', 'Street urchin', 'Washer', 'Minstrel', 'Cutpurse', 'Fishmonger', 'Town crier', 'Mercenary', 'Old gossip', 'Courier']

export const ROOM_LABELS: Partial<Record<PoiType, string[]>> = {
  tavern: ['Common Room', 'Kitchen', 'Cellar', 'Storeroom', 'Private Booth', 'Back Office'],
  inn: ['Common Room', 'Kitchen', 'Guest Room', 'Guest Room', 'Guest Room', 'Innkeeper\'s Room'],
  blacksmith: ['Forge', 'Storefront', 'Coal Store', 'Living Quarters'],
  general: ['Shop Floor', 'Storeroom', 'Office', 'Living Quarters'],
  alchemist: ['Shop Floor', 'Laboratory', 'Herb Store', 'Living Quarters'],
  magic: ['Showroom', 'Enchanting Room', 'Vault', 'Study'],
  library: ['Reading Hall', 'Stacks', 'Archive', 'Scriptorium', 'Restricted Section', 'Map Room'],
  temple: ['Nave', 'Altar', 'Vestry', 'Cloister', 'Crypt Stairs'],
  shrine: ['Shrine', 'Cell'],
  guard: ['Guard Room', 'Armoury', 'Cells', 'Barracks', 'Captain\'s Office'],
  manor: ['Great Hall', 'Dining Room', 'Study', 'Bedchamber', 'Kitchen', 'Servants\' Quarters', 'Gallery'],
  bank: ['Counting Room', 'Vault', 'Office', 'Waiting Room'],
  stables: ['Stalls', 'Tack Room', 'Hayloft'],
  guild: ['Meeting Hall', 'Office', 'Records', 'Lounge'],
  farm: ['Main Room', 'Kitchen', 'Bedroom', 'Barn'],
  house: ['Main Room', 'Kitchen', 'Bedroom', 'Storage'],
}

export const DUNGEON_CONTENTS = [
  'Empty, but something was here recently.', 'A monster lair. Roll for what lives here.', 'A hidden trap (DC 13 to spot).',
  'Treasure: roll on the loot table.', 'A strange puzzle locks the next door.', 'A forgotten shrine. Pray and roll a d20.',
  'A prisoner begs to be freed.', 'Collapsed rubble hides a secret passage.', 'An old campsite with a journal.',
]
