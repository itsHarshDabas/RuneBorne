// Items: an SRD 5.2-based catalog (names, costs, weights and dice are game mechanics under CC-BY-4.0;
// descriptions are our own short summaries) plus a few RuneBorne homebrew items for the mana system.

export const ITEM_KINDS = ['potion', 'scroll', 'weapon', 'armor', 'gear', 'tool', 'book', 'map', 'food', 'treasure', 'magic', 'trinket'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]
export const KIND_LABEL: Record<ItemKind, string> = {
  potion: 'Potions', scroll: 'Scrolls', weapon: 'Weapons', armor: 'Armor', gear: 'Gear', tool: 'Tools', book: 'Books', map: 'Maps',
  food: 'Food & drink', treasure: 'Treasure', magic: 'Magic items', trinket: 'Trinkets',
}

export const RARITIES = ['mundane', 'common', 'uncommon', 'rare', 'very rare', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]
export const RARITY_COLOR: Record<Rarity, string> = {
  mundane: '#a8a29e', common: '#e7e5e4', uncommon: '#4ade80', rare: '#60a5fa', 'very rare': '#c084fc', legendary: '#fb923c',
}

/** What happens when an item is used from a character's inventory. */
export type ItemEffect =
  | { type: 'heal'; dice: string }
  | { type: 'mana'; dice: string }
  | { type: 'damage'; dice: string }
  | { type: 'spell'; spell: string; dice?: string; heal?: boolean }
  | { type: 'read' }

export type ItemDef = {
  id: string
  name: string
  kind: ItemKind
  rarity: Rarity
  /** Price in gold pieces (0.1 = 1 sp, 0.01 = 1 cp). */
  cost: number
  /** Pounds per item. */
  weight: number
  description: string
  effect?: ItemEffect
  /** Used up when used (potions, scrolls, ammo). */
  consumable?: boolean
  /** Uses before it runs dry (wands, healer's kits). */
  charges?: number
  /** Readable text for books, maps and letters. The GM can rewrite it per copy. */
  text?: string
  custom?: boolean
}

type Def = Omit<ItemDef, 'id'>
const make = (kind: ItemKind, rarity: Rarity, list: [string, number, number, string, Partial<Def>?][]): ItemDef[] =>
  list.map(([name, cost, weight, description, extra]) => ({ id: slug(name), name, kind, rarity, cost, weight, description, ...extra }))

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const potion = (dice: string): Partial<Def> => ({ effect: { type: 'heal', dice }, consumable: true })
const scroll = (spell: string, dice?: string, heal?: boolean): Partial<Def> => ({ effect: { type: 'spell', spell, dice, heal }, consumable: true })
const book = (text: string): Partial<Def> => ({ effect: { type: 'read' }, text })

export const ITEMS: ItemDef[] = [
  ...make('potion', 'common', [
    ['Potion of Healing', 50, 0.5, 'A red liquid that glimmers when shaken. Drink it to regain 2d4 + 2 hit points.', potion('2d4+2')],
    ['Antitoxin', 50, 0, 'Grants advantage on saves against poison for 1 hour.', { consumable: true }],
    ['Potion of Climbing', 75, 0.5, 'For 1 hour you gain a climb speed equal to your speed and advantage on climbing checks.', { consumable: true }],
    ['Mana Draught', 60, 0.5, 'RuneBorne homebrew. A blue, fizzing tonic that restores 1d6 + 2 mana.', { effect: { type: 'mana', dice: '1d6+2' }, consumable: true }],
  ]),
  ...make('potion', 'uncommon', [
    ['Potion of Greater Healing', 150, 0.5, 'Regain 4d4 + 4 hit points.', potion('4d4+4')],
    ['Potion of Fire Breath', 150, 0.5, 'For 1 hour, use a bonus action to exhale fire at a target within 30 ft (DC 13 Dex save, 4d6 fire). Three breaths.', { effect: { type: 'damage', dice: '4d6' }, consumable: true }],
    ['Potion of Water Breathing', 100, 0.5, 'You can breathe underwater for 24 hours.', { consumable: true }],
    ['Potion of Animal Friendship', 100, 0.5, 'Charm beasts with low intelligence for 1 hour.', { consumable: true }],
    ['Potion of Resistance', 300, 0.5, 'Resistance to one damage type for 1 hour.', { consumable: true }],
    ['Greater Mana Draught', 200, 0.5, 'RuneBorne homebrew. Restores 2d6 + 4 mana.', { effect: { type: 'mana', dice: '2d6+4' }, consumable: true }],
  ]),
  ...make('potion', 'rare', [
    ['Potion of Superior Healing', 450, 0.5, 'Regain 8d4 + 8 hit points.', potion('8d4+8')],
    ['Potion of Heroism', 180, 0.5, 'For 1 hour you have 10 temporary hit points and are under the effect of Bless.', { consumable: true }],
    ['Potion of Invisibility', 180, 0.5, 'You become invisible for 1 hour, or until you attack or cast a spell.', { consumable: true }],
    ['Potion of Speed', 400, 0.5, 'Gain the effect of Haste for 1 minute (no concentration).', { consumable: true }],
  ]),
  ...make('potion', 'very rare', [
    ['Potion of Supreme Healing', 1350, 0.5, 'Regain 10d4 + 20 hit points.', potion('10d4+20')],
    ['Potion of Flying', 500, 0.5, 'Gain a fly speed equal to your speed for 1 hour.', { consumable: true }],
  ]),
  ...make('gear', 'mundane', [
    ["Alchemist's Fire", 50, 1, 'Throw at a creature within 20 ft. On a hit it takes 1d4 fire damage at the start of each of its turns until it puts the fire out.', { effect: { type: 'damage', dice: '1d4' }, consumable: true }],
    ['Acid (vial)', 25, 1, 'Throw at a creature within 20 ft (Dex save). 2d6 acid damage.', { effect: { type: 'damage', dice: '2d6' }, consumable: true }],
    ['Holy Water (flask)', 25, 1, 'Throw at a creature within 20 ft. 2d8 radiant damage to fiends and undead.', { effect: { type: 'damage', dice: '2d8' }, consumable: true }],
    ['Backpack', 2, 5, 'Holds up to 30 lb of gear.'],
    ['Bedroll', 1, 7, 'A roll of blankets for sleeping rough.'],
    ['Rope (50 ft)', 1, 5, 'Hempen rope. Can be burst with a DC 20 Strength check.'],
    ['Torch', 0.01, 1, 'Burns for 1 hour, bright light 20 ft and dim light 20 ft more.', { consumable: true }],
    ['Lantern, Hooded', 5, 2, 'Burns oil for 6 hours, bright light 30 ft.'],
    ['Oil (flask)', 0.1, 1, 'Fuel for lanterns, or splash it and set it alight.', { consumable: true }],
    ['Tinderbox', 0.5, 1, 'Flint, fire steel and tinder for lighting fires.'],
    ['Waterskin', 0.2, 5, 'Holds 4 pints of water.'],
    ['Crowbar', 2, 5, 'Advantage on Strength checks where leverage helps.'],
    ['Grappling Hook', 2, 4, 'Tie it to a rope and throw it up a wall.'],
    ['Caltrops (bag)', 1, 2, 'Covers a 5 ft square. Creatures entering must save or take 1 piercing damage and slow down.', { consumable: true }],
    ['Ball Bearings (bag)', 1, 2, 'Spread them on the floor to make creatures slip.', { consumable: true }],
    ['Manacles', 2, 6, 'Bind a Small or Medium creature. DC 20 to escape.'],
    ['Candle', 0.01, 0, 'Burns for 1 hour, bright light 5 ft.', { consumable: true }],
    ['Chalk', 0.01, 0, 'For marking walls and floors.', { consumable: true }],
    ['Mirror', 5, 0.5, 'A small steel hand mirror.'],
    ['Component Pouch', 25, 2, 'Holds the material components most spells need.'],
    ['Holy Symbol', 5, 1, 'An amulet, emblem or reliquary used as a divine focus.'],
    ['Arcane Focus (crystal)', 10, 1, 'A crystal used to channel arcane spells.'],
    ['Map Case', 1, 1, 'A waterproof leather tube for maps and scrolls.'],
    ['Ink and Quill', 10, 0, 'A bottle of ink and a good quill.'],
    ['Arrows (20)', 1, 1, 'Ammunition for bows.', { consumable: true }],
    ['Crossbow Bolts (20)', 1, 1.5, 'Ammunition for crossbows.', { consumable: true }],
  ]),
  ...make('tool', 'mundane', [
    ["Healer's Kit", 5, 3, 'Ten uses. Stabilize a dying creature without a check.', { charges: 10 }],
    ["Thieves' Tools", 25, 1, 'Picks and files for locks and traps.'],
    ["Climber's Kit", 25, 12, 'Pitons, boot tips and a harness.'],
    ["Herbalism Kit", 5, 3, 'Used to make antitoxin and potions of healing.'],
    ["Alchemist's Supplies", 50, 8, 'Used to make acid, alchemist\'s fire and more.'],
    ["Smith's Tools", 20, 8, 'Hammers and tongs for metalwork.'],
    ['Spyglass', 1000, 1, 'Objects seen through it are magnified to twice their size.'],
  ]),
  ...make('weapon', 'mundane', [
    ['Dagger', 2, 1, '1d4 piercing. Finesse, light, thrown (20/60).'],
    ['Shortsword', 10, 2, '1d6 piercing. Finesse, light.'],
    ['Longsword', 15, 3, '1d8 slashing. Versatile (1d10).'],
    ['Greatsword', 50, 6, '2d6 slashing. Heavy, two-handed.'],
    ['Rapier', 25, 2, '1d8 piercing. Finesse.'],
    ['Handaxe', 5, 2, '1d6 slashing. Light, thrown (20/60).'],
    ['Battleaxe', 10, 4, '1d8 slashing. Versatile (1d10).'],
    ['Mace', 5, 4, '1d6 bludgeoning.'],
    ['Warhammer', 15, 5, '1d8 bludgeoning. Versatile (1d10).'],
    ['Spear', 1, 3, '1d6 piercing. Thrown (20/60), versatile (1d8).'],
    ['Quarterstaff', 0.2, 4, '1d6 bludgeoning. Versatile (1d8).'],
    ['Shortbow', 25, 2, '1d6 piercing. Range 80/320, two-handed.'],
    ['Longbow', 50, 2, '1d8 piercing. Range 150/600, heavy, two-handed.'],
    ['Light Crossbow', 25, 5, '1d8 piercing. Range 80/320, loading, two-handed.'],
  ]),
  ...make('armor', 'mundane', [
    ['Leather Armor', 10, 10, 'Light armor. AC 11 + Dex modifier.'],
    ['Studded Leather Armor', 45, 13, 'Light armor. AC 12 + Dex modifier.'],
    ['Chain Shirt', 50, 20, 'Medium armor. AC 13 + Dex modifier (max 2).'],
    ['Scale Mail', 50, 45, 'Medium armor. AC 14 + Dex modifier (max 2). Disadvantage on Stealth.'],
    ['Chain Mail', 75, 55, 'Heavy armor. AC 16. Strength 13 needed. Disadvantage on Stealth.'],
    ['Plate Armor', 1500, 65, 'Heavy armor. AC 18. Strength 15 needed. Disadvantage on Stealth.'],
    ['Shield', 10, 6, '+2 AC while carried.'],
  ]),
  ...make('scroll', 'common', [
    ['Scroll of Light', 30, 0, 'Cantrip. An object you touch sheds bright light for 1 hour.', scroll('Light')],
    ['Scroll of Cure Wounds', 60, 0, 'Level 1. A creature you touch regains 2d8 hit points.', scroll('Cure Wounds', '2d8', true)],
    ['Scroll of Healing Word', 60, 0, 'Level 1. A creature you can see within 60 ft regains 2d4 hit points.', scroll('Healing Word', '2d4', true)],
    ['Scroll of Magic Missile', 60, 0, 'Level 1. Three darts of force, 1d4 + 1 each, that never miss.', scroll('Magic Missile', '3d4+3')],
    ['Scroll of Shield', 60, 0, 'Level 1. +5 AC until the start of your next turn, as a reaction.', scroll('Shield')],
    ['Scroll of Detect Magic', 60, 0, 'Level 1. Sense magic within 30 ft for 10 minutes.', scroll('Detect Magic')],
    ['Scroll of Identify', 60, 0, 'Level 1. Learn the properties of one magic item.', scroll('Identify')],
    ['Scroll of Feather Fall', 60, 0, 'Level 1. Up to five falling creatures drift down safely.', scroll('Feather Fall')],
    ['Scroll of Sleep', 60, 0, 'Level 1. Creatures in a 5 ft radius must save or fall unconscious.', scroll('Sleep')],
  ]),
  ...make('scroll', 'uncommon', [
    ['Scroll of Misty Step', 120, 0, 'Level 2. Teleport up to 30 ft to a space you can see.', scroll('Misty Step')],
    ['Scroll of Fireball', 200, 0, 'Level 3. A 20 ft radius burst, 8d6 fire (Dex save for half).', scroll('Fireball', '8d6')],
    ['Scroll of Lightning Bolt', 200, 0, 'Level 3. A 100 ft line, 8d6 lightning (Dex save for half).', scroll('Lightning Bolt', '8d6')],
    ['Scroll of Revivify', 300, 0, 'Level 3. Return a creature that died in the last minute to life with 1 HP (consumes 300 gp of diamonds).', scroll('Revivify')],
  ]),
  ...make('scroll', 'rare', [
    ['Scroll of Teleport', 1200, 0, 'Level 7. Move yourself and up to eight willing creatures to a place you know.', scroll('Teleport')],
  ]),
  ...make('book', 'mundane', [
    ['Blank Book', 25, 5, 'A leather-bound book of empty pages.', book('')],
    ['Spellbook', 50, 3, 'Holds the spells a wizard has learned.', book('Spells copied here:\n- ')],
    ['Bestiary of the Northern Wilds', 40, 4, 'A hunter\'s field guide, well thumbed.', book('Wolves hunt in threes and circle before they bite. Owlbears hate fire but love honey. Never camp where the crows go quiet.')],
    ['Treatise on Runes', 75, 3, 'An old scholar\'s notes on runic magic.', book('Every rune has a cost. Carve it in stone and it lasts, carve it in flesh and it remembers. The seventh rune is missing from every copy of this book.')],
    ['Diary', 5, 1, 'Someone\'s private diary.', book('Day 12: The cellar door was open again. I locked it myself.')],
    ['Prayer Book', 15, 2, 'Psalms and rites of a local faith.', book('')],
  ]),
  ...make('map', 'mundane', [
    ['Regional Map', 5, 0, 'A map of the surrounding region. Write in what it shows.', book('Roads, rivers and the nearest towns.')],
    ['City Map', 3, 0, 'A street map of a town or city.', book('')],
    ['Treasure Map', 25, 0, 'A torn map with an X on it.', book('Ten paces from the hanging tree, under the white stone.')],
    ['Dungeon Sketch', 10, 0, 'A rough sketch of tunnels drawn by a previous explorer.', book('Left at the skull. Do NOT open the green door.')],
  ]),
  ...make('food', 'mundane', [
    ['Rations (1 day)', 0.5, 2, 'Dried meat, hardtack and nuts.', { consumable: true }],
    ['Ale (mug)', 0.04, 1, 'Cheap and warm.', { consumable: true }],
    ['Wine (bottle)', 2, 1.5, 'A decent red.', { consumable: true }],
    ['Inn Meal', 0.3, 0, 'A hot meal and a seat by the fire.', { consumable: true }],
    ['Night at an Inn', 0.5, 0, 'A bed for the night in a modest inn.', { consumable: true }],
  ]),
  ...make('treasure', 'mundane', [
    ['Gem (10 gp)', 10, 0, 'Azurite, hematite or a similar small stone.'],
    ['Gem (50 gp)', 50, 0, 'Bloodstone, jasper or moonstone.'],
    ['Gem (100 gp)', 100, 0, 'Amber, garnet or jade.'],
    ['Art Object (25 gp)', 25, 1, 'A silver ewer, a carved bone statuette or a small gold bracelet.'],
    ['Art Object (250 gp)', 250, 1, 'A gold ring set with bloodstones or a carved ivory statue.'],
  ]),
  ...make('magic', 'uncommon', [
    ['Bag of Holding', 500, 15, 'Holds up to 500 lb in an extradimensional space but always weighs 15 lb.'],
    ['+1 Weapon', 500, 3, '+1 to attack and damage rolls made with this magic weapon.'],
    ['+1 Shield', 500, 6, 'An extra +1 AC on top of the usual shield bonus.'],
    ['Cloak of Protection', 500, 1, '+1 to AC and saving throws while worn (attunement).'],
    ['Boots of Elvenkind', 500, 1, 'Your steps make no sound. Advantage on Stealth checks that rely on moving quietly.'],
    ['Goggles of Night', 500, 0, 'Darkvision out to 60 ft.'],
    ['Wand of Magic Missiles', 500, 1, '7 charges. Spend 1 to cast Magic Missile (3d4 + 3).', { effect: { type: 'spell', spell: 'Magic Missile', dice: '3d4+3' }, charges: 7 }],
    ['Pearl of Power', 500, 0, 'RuneBorne version: once a day, restore 1d4 + 1 mana (attunement).', { effect: { type: 'mana', dice: '1d4+1' }, charges: 1 }],
    ['Rope of Climbing', 500, 3, '60 ft of silk rope that moves on command.'],
  ]),
  ...make('magic', 'common', [
    ['Driftglobe', 100, 1, 'A glass globe that sheds light and floats after you.'],
    ['Hat of Disguise', 100, 0, 'Cast Disguise Self at will while wearing it.'],
  ]),
  ...make('magic', 'rare', [
    ['Ring of Protection', 4000, 0, '+1 to AC and saving throws (attunement).'],
    ['Immovable Rod', 5000, 2, 'Press the button and it stays fixed in place, holding up to 8,000 lb.'],
    ['+2 Weapon', 4000, 3, '+2 to attack and damage rolls made with this magic weapon.'],
  ]),
  ...make('trinket', 'mundane', [
    ['Rusted Key with a Skull', 0, 0, 'Nobody knows what it opens.'],
    ['Cold Silver Ring', 5, 0, 'Always cold to the touch.'],
    ['Unsent Love Letter', 0, 0, 'Sealed with red wax.', book('My dearest, I will be at the old mill when the moon is full. Burn this.')],
    ['Feather that Falls Upward', 1, 0, 'Let go and it drifts to the ceiling.'],
    ['Music Box', 10, 1, 'Plays a slow funeral march.'],
    ['Mysterious Egg', 25, 2, 'Warm, and sometimes it ticks.'],
    ['Deck of Cards (no kings)', 1, 0, 'Every king has been removed.'],
  ]),
]

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]))

/** What each kind of shop sells. Shops pick a seeded selection from these. */
export const SHOP_STOCK: Record<string, { kinds?: ItemKind[]; ids?: string[]; size: number; maxRarity: Rarity }> = {
  alchemist: { kinds: ['potion'], ids: ['alchemist-s-fire', 'acid-vial', 'antitoxin', 'herbalism-kit', 'alchemist-s-supplies', 'healer-s-kit'], size: 10, maxRarity: 'rare' },
  magic: { kinds: ['scroll', 'magic'], size: 9, maxRarity: 'rare' },
  library: { kinds: ['book', 'map'], ids: ['scroll-of-identify', 'scroll-of-detect-magic', 'ink-and-quill', 'map-case', 'candle'], size: 10, maxRarity: 'uncommon' },
  blacksmith: { kinds: ['weapon', 'armor'], ids: ['crowbar', 'manacles', 'grappling-hook', 'smith-s-tools'], size: 12, maxRarity: 'mundane' },
  general: { kinds: ['gear', 'food'], ids: ['potion-of-healing', 'thieves-tools', 'climber-s-kit', 'regional-map'], size: 14, maxRarity: 'common' },
  temple: { ids: ['holy-water-flask', 'potion-of-healing', 'potion-of-greater-healing', 'holy-symbol', 'scroll-of-cure-wounds', 'scroll-of-healing-word', 'prayer-book', 'antitoxin', 'scroll-of-revivify', 'candle'], size: 7, maxRarity: 'uncommon' },
  shrine: { ids: ['holy-water-flask', 'potion-of-healing', 'holy-symbol', 'candle', 'prayer-book'], size: 4, maxRarity: 'common' },
  tavern: { kinds: ['food'], ids: ['rations-1-day', 'deck-of-cards-no-kings', 'treasure-map', 'diary'], size: 6, maxRarity: 'mundane' },
  inn: { kinds: ['food'], ids: ['rations-1-day', 'waterskin', 'candle', 'regional-map'], size: 6, maxRarity: 'mundane' },
  stables: { ids: ['rope-50-ft', 'bedroll', 'waterskin', 'rations-1-day', 'backpack', 'map-case'], size: 5, maxRarity: 'mundane' },
  guild: { kinds: ['tool', 'map'], size: 6, maxRarity: 'mundane' },
  bank: { kinds: ['treasure'], size: 5, maxRarity: 'mundane' },
  market: { kinds: ['food', 'gear', 'trinket'], ids: ['potion-of-healing'], size: 14, maxRarity: 'common' },
}

/** Loot by challenge rating: coins rolled as dice times a multiplier, plus a chance at items. */
export function lootTable(cr: number): { dice: string; mult: number; coin: 'cp' | 'sp' | 'gp' | 'pp'; itemChance: number; maxRarity: Rarity } {
  if (cr < 1) return { dice: '3d6', mult: 1, coin: 'sp', itemChance: 0.15, maxRarity: 'common' }
  if (cr <= 4) return { dice: '3d6', mult: 1, coin: 'gp', itemChance: 0.3, maxRarity: 'uncommon' }
  if (cr <= 10) return { dice: '2d8', mult: 10, coin: 'gp', itemChance: 0.5, maxRarity: 'rare' }
  if (cr <= 16) return { dice: '2d10', mult: 10, coin: 'pp', itemChance: 0.7, maxRarity: 'very rare' }
  return { dice: '2d8', mult: 100, coin: 'pp', itemChance: 0.9, maxRarity: 'legendary' }
}

export const rarityRank = (r: Rarity) => RARITIES.indexOf(r)
