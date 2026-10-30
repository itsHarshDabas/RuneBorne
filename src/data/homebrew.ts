// RuneBorne's own homebrew content. Edit anything here; it is yours.

export type TarotCard = { name: string; numeral: string; upright: string; reversed: string }

export const TAROT: TarotCard[] = [
  { numeral: '0', name: 'The Fool', upright: 'Once per long rest, reroll any d20 after seeing the result. You must take the new roll.', reversed: 'Your first ability check each session is made with disadvantage, but you gain inspiration afterwards.' },
  { numeral: 'I', name: 'The Magician', upright: 'Learn one extra cantrip of the DM\'s choosing. Spell Forge learn rolls get +2.', reversed: 'Your spells cost 1 extra mana, but their power rolls get +2.' },
  { numeral: 'II', name: 'The High Priestess', upright: 'Once per session, ask the DM one yes-or-no question about a secret. They must answer truthfully.', reversed: 'You hear whispers. Once per session the DM tells you something true, but not when you want it.' },
  { numeral: 'III', name: 'The Empress', upright: 'Healing you give restores extra HP equal to your proficiency bonus.', reversed: 'Beasts are hostile to you until you show them kindness.' },
  { numeral: 'IV', name: 'The Emperor', upright: 'Advantage on checks to command or lead followers.', reversed: 'Authority figures start one step less friendly toward you.' },
  { numeral: 'V', name: 'The Hierophant', upright: 'You know the customs and rites of every temple you enter.', reversed: 'A religious order wants something from you. The DM decides what.' },
  { numeral: 'VI', name: 'The Lovers', upright: 'Choose an ally. When you stand next to them, both of you gain +1 AC.', reversed: 'A past romance or rivalry will return at the worst moment.' },
  { numeral: 'VII', name: 'The Chariot', upright: '+10 ft speed. Advantage on checks to control mounts and vehicles.', reversed: 'You cannot willingly retreat from a fight on your first turn.' },
  { numeral: 'VIII', name: 'Strength', upright: 'Once per long rest, turn a failed Strength check or save into a success.', reversed: 'You carry a beast-like temper. Fail a DC 10 Wisdom save when insulted and you lash out.' },
  { numeral: 'IX', name: 'The Hermit', upright: 'Advantage on Survival checks and on saves against being charmed.', reversed: 'You need an hour alone each day or you take disadvantage on Charisma checks.' },
  { numeral: 'X', name: 'Wheel of Fortune', upright: 'Gain 2 luck points per long rest. Spend one to roll an extra d20 and choose either result.', reversed: 'The DM may force a reroll on one of your rolls each session.' },
  { numeral: 'XI', name: 'Justice', upright: 'You can tell when someone tells a direct lie, once per long rest.', reversed: 'You cannot tell a direct lie without visibly flinching.' },
  { numeral: 'XII', name: 'The Hanged Man', upright: 'You can hold your breath for an hour and are immune to being frightened while restrained.', reversed: 'Your plans tend to stall. Initiative rolls take -2.' },
  { numeral: 'XIII', name: 'Death', upright: 'Advantage on death saving throws. Undead hesitate before attacking you.', reversed: 'You start with one level of Exhaustion that only removes after a heroic deed.' },
  { numeral: 'XIV', name: 'Temperance', upright: 'Short rests also restore half your mana (rounded down).', reversed: 'Potions and elixirs heal you for half.' },
  { numeral: 'XV', name: 'The Devil', upright: 'You can make one pact with a fiend. The DM names the price.', reversed: 'Something owns a piece of your soul. It will come to collect.' },
  { numeral: 'XVI', name: 'The Tower', upright: 'Once per long rest, deal an extra 2d8 damage on a hit.', reversed: 'When you roll a natural 1 in combat, something nearby breaks.' },
  { numeral: 'XVII', name: 'The Star', upright: 'You gain inspiration whenever you help someone at personal cost.', reversed: 'You are drawn to a lost cause. The DM gives you a quest you cannot ignore.' },
  { numeral: 'XVIII', name: 'The Moon', upright: 'Darkvision 60 ft, or +30 ft if you already have it.', reversed: 'You have strange dreams. Each long rest roll a d6: on a 1 you get no benefit from it.' },
  { numeral: 'XIX', name: 'The Sun', upright: 'You and allies within 10 ft have advantage on saves against being frightened.', reversed: 'You glow faintly. Disadvantage on Stealth checks in darkness.' },
  { numeral: 'XX', name: 'Judgement', upright: 'Once per campaign, return from death with 1 HP.', reversed: 'A past sin is known to someone powerful.' },
  { numeral: 'XXI', name: 'The World', upright: 'Learn one extra language and gain proficiency in one skill of your choice.', reversed: 'You are far from home. You cannot return until your fate is fulfilled.' },
]

export const TAROT_POSITIONS = ['Origin', 'Gift', 'Fate'] as const

export type Bloodline = { name: string; flavor: string; boon: string; bane: string }

export const BLOODLINES: Bloodline[] = [
  { name: 'None', flavor: 'Ordinary blood, extraordinary choices.', boon: '-', bane: '-' },
  { name: 'Draconic', flavor: 'An ancient dragon sits somewhere in your family tree.', boon: 'Resistance to one damage type (pick the dragon colour).', bane: 'Greed: disadvantage on saves against being bribed or tempted by treasure.' },
  { name: 'Fey', flavor: 'Your great-grandmother danced too long at a fairy ring.', boon: 'Advantage on saves against being charmed. You can speak with small animals.', bane: 'Cold iron burns you: 1 extra damage from iron weapons.' },
  { name: 'Infernal', flavor: 'A contract was signed in your family\'s blood.', boon: 'Resistance to fire damage.', bane: 'Holy water deals 1d6 damage to you.' },
  { name: 'Celestial', flavor: 'An angel walked among your ancestors.', boon: 'Once per long rest, heal 1d8 + level HP with a touch.', bane: 'Fiends and undead single you out in a fight.' },
  { name: 'Giant', flavor: 'You are big-boned. Very big-boned.', boon: 'Count as one size larger for carrying and grappling.', bane: 'Disadvantage on Stealth in tight spaces.' },
  { name: 'Shadow', flavor: 'You were born during an eclipse.', boon: 'Darkvision 60 ft. Advantage on Stealth in dim light.', bane: 'Disadvantage on attacks and Perception in direct sunlight.' },
  { name: 'Storm', flavor: 'Lightning struck the house the night you were born.', boon: 'Resistance to lightning and thunder damage.', bane: 'Metal armour gives you static shocks: -1 to Stealth.' },
  { name: 'Abyssal', flavor: 'Something chaotic stirs in your veins.', boon: 'Once per long rest, add 1d6 to an attack roll after seeing it.', bane: 'On a natural 1, roll on a wild chaos table the DM controls.' },
  { name: 'Primordial', flavor: 'Elemental spirits are your distant cousins.', boon: 'Learn one elemental cantrip. Mana max +2.', bane: 'Elementals see you as kin, or as a traitor.' },
  { name: 'Beastblood', flavor: 'A were-creature bit a grandparent, and it stuck around.', boon: 'Advantage on Perception checks that rely on smell.', bane: 'Silver weapons deal 1d4 extra damage to you.' },
  { name: 'Lich-touched', flavor: 'Your family made a bargain with something that never dies.', boon: 'Resistance to necrotic damage. You do not need to sleep.', bane: 'Healing magic heals you for half.' },
]

export const FIRST_NAMES = [
  'Aldric', 'Bryn', 'Caelum', 'Dara', 'Elowen', 'Fenwick', 'Garrick', 'Hesper', 'Ilsa', 'Jorund', 'Kael', 'Liora',
  'Maren', 'Nym', 'Orrin', 'Perrin', 'Quill', 'Rhosyn', 'Sable', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Xanthe',
  'Yorick', 'Zephyra', 'Bram', 'Cora', 'Dunstan', 'Faye', 'Grimma', 'Hollis', 'Isolde', 'Jasper', 'Korra', 'Lark',
]

export const LAST_NAMES = [
  'Ashdown', 'Blackbriar', 'Coldwater', 'Duskmantle', 'Emberly', 'Fairwind', 'Grimsby', 'Hollowell', 'Ironhand',
  'Juniper', 'Kettleburn', 'Longstride', 'Mossbottom', 'Nightingale', 'Oakhart', 'Pennywhistle', 'Quickfoot',
  'Ravensworth', 'Stonebrook', 'Thistledown', 'Underhill', 'Vale', 'Whitlock', 'Yarrow',
]

export const NPC_ROLES = [
  'Innkeeper', 'Blacksmith', 'Merchant', 'Guard captain', 'Priest', 'Street urchin', 'Noble', 'Wandering bard',
  'Hedge witch', 'Smuggler', 'Farmer', 'Retired adventurer', 'Scholar', 'Bounty hunter', 'Cultist', 'Herbalist',
]

export const NPC_TRAITS = [
  'Speaks in riddles', 'Laughs too loudly', 'Never makes eye contact', 'Collects teeth', 'Hums constantly',
  'Overly polite', 'Brutally honest', 'Paranoid about spies', 'Obsessed with cheese', 'Quotes old poems',
  'Constantly eating', 'Whispers everything', 'Tells tall tales', 'Bites their nails', 'Fiercely loyal',
  'Greedy but charming', 'Afraid of birds', 'Talks to their pet', 'Hates magic', 'Loves gossip',
]

export const NPC_WANTS = [
  'to pay off a debt', 'revenge on a former partner', 'a cure for a sick child', 'to be famous', 'a quiet life',
  'to find a lost sibling', 'forbidden knowledge', 'to escape this town', 'to protect a secret', 'more gold, always',
]

export const NPC_SECRETS = [
  'is secretly a spy for a rival lord', 'murdered someone years ago', 'is a shapeshifter', 'owes money to the thieves\' guild',
  'knows where a dragon sleeps', 'is royalty in hiding', 'is cursed', 'is working for the villain (unwillingly)',
  'hid a treasure map in the floorboards', 'has no secret at all, and is offended you asked',
]

export const ATTITUDES = ['Hostile', 'Unfriendly', 'Indifferent', 'Friendly', 'Helpful'] as const
export type Attitude = (typeof ATTITUDES)[number]

/** Reaction roll: 2d6 + CHA modifier shifts the NPC's starting attitude. */
export function reactionShift(total: number): { shift: number; text: string } {
  if (total <= 2) return { shift: -2, text: 'Hates you on sight' }
  if (total <= 5) return { shift: -1, text: 'Wary, cold' }
  if (total <= 8) return { shift: 0, text: 'Neutral, waits and sees' }
  if (total <= 11) return { shift: 1, text: 'Warms up to you' }
  return { shift: 2, text: 'Instantly likes you' }
}

export type PowerTier = { min: number; name: string; damage: string; note: string; color: string }

/** Spell Forge power tiers. The power roll (d20 by default) picks one. */
export const POWER_TIERS: PowerTier[] = [
  { min: 1, name: 'Fizzle', damage: '1d4', note: 'Barely a spark. Might be useful in a pinch.', color: 'text-stone-400' },
  { min: 6, name: 'Weak', damage: '1d8', note: 'A modest spell. Cantrip-tier.', color: 'text-sky-300' },
  { min: 11, name: 'Standard', damage: '2d8', note: 'Solid and dependable.', color: 'text-emerald-300' },
  { min: 16, name: 'Strong', damage: '4d8', note: 'Enemies will remember this one.', color: 'text-violet-300' },
  { min: 20, name: 'Legendary', damage: '8d8', note: 'Bards will sing about it. Probably with a side effect.', color: 'text-amber-300' },
]

export function powerTier(roll: number): PowerTier {
  return [...POWER_TIERS].reverse().find((t) => roll >= t.min) ?? POWER_TIERS[0]
}

export const SPELL_SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation']

export const LOOT = [
  'a pouch with 3d6 gold', 'a rusted key with a skull on it', 'a vial of glowing blue liquid', 'a love letter, unsent',
  'a silver ring that is always cold', 'a map with one location burned out', 'a jar of honey that never runs out (it does)',
  'a dagger with a name engraved: "Pip"', 'an eyepatch for someone with three eyes', 'a music box that plays a funeral march',
  'a tiny caged fairy (very angry)', 'a scroll with one random spell', 'a wooden leg, well-polished', 'a crown made of bone',
  'a deck of cards missing all the kings', 'a feather that falls upward', 'a potion of healing (2d4+2)', 'a mysterious egg',
]

export const PLOT_HOOKS = [
  'The town well has started whispering names at night.',
  'A merchant offers triple pay to escort a sealed crate. It is breathing.',
  'Every bird in the region flew north this morning.',
  'A child claims a knight in black armour visits her window.',
  'The local lord has not been seen in a week, but still signs orders.',
  'A ship washes ashore with no crew and the tables set for dinner.',
  'A rival adventuring party took the job you wanted, and they need rescuing.',
  'The tavern\'s mead is turning people into frogs for exactly one hour.',
  'A comet appears, and every wizard in town falls asleep.',
  'Someone is stealing shadows.',
]

export const WEATHER = [
  'Clear skies, warm breeze', 'Heavy fog rolls in', 'Pouring rain', 'Thunderstorm', 'Light snow', 'Blistering heat',
  'Eerie stillness, not a sound', 'Strong winds', 'Red-tinged sky at dusk', 'Hail the size of marbles',
]

export const TAVERN_NAMES_A = ['Dancing', 'Drunken', 'Rusty', 'Golden', 'Sleeping', 'Laughing', 'Crooked', 'Silver', 'One-Eyed', 'Wandering']
export const TAVERN_NAMES_B = ['Pony', 'Dragon', 'Tankard', 'Goblin', 'Griffon', 'Barrel', 'Wizard', 'Boar', 'Mermaid', 'Lantern']
