import type { Rng } from './random'

const START = ['Ash', 'Bel', 'Cor', 'Dun', 'El', 'Fal', 'Gal', 'Har', 'Ith', 'Kel', 'Lor', 'Mor', 'Nar', 'Os', 'Pel', 'Quel', 'Rav', 'Sel', 'Thal', 'Ul', 'Vor', 'Wyn', 'Yr', 'Zan', 'Bram', 'Cael', 'Dra', 'Eld', 'Grim', 'Hollow']
const MID = ['a', 'e', 'i', 'o', 'u', 'ar', 'en', 'or', 'ith', 'al', 'an', 'ur', '']
const END = ['dor', 'mere', 'wick', 'ford', 'heim', 'grad', 'hollow', 'vale', 'reach', 'moor', 'wood', 'stead', 'gate', 'crest', 'fall', 'haven', 'mark', 'ton', 'by', 'shire']
const REGION_SUFFIX = ['Marches', 'Wilds', 'Reach', 'Expanse', 'Highlands', 'Lowlands', 'Fen', 'Coast', 'Barrens', 'Dominion', 'Vale', 'Steppe']

export function placeName(rng: Rng): string {
  return rng.pick(START) + rng.pick(MID) + rng.pick(END)
}

export function regionName(rng: Rng): string {
  return rng.chance(0.5) ? `The ${placeName(rng)} ${rng.pick(REGION_SUFFIX)}` : `${placeName(rng)}`
}

export function worldName(rng: Rng): string {
  return rng.pick(['Aer', 'Val', 'Kor', 'Myr', 'Thes', 'Ol', 'Syl', 'Dra']) + rng.pick(['anthis', 'oria', 'endell', 'athra', 'yndor', 'essa', 'umbra'])
}

const FIRST = [
  'Aldo', 'Bree', 'Cassia', 'Doran', 'Elsa', 'Finn', 'Greta', 'Hale', 'Iris', 'Jory', 'Kira', 'Lenn', 'Mira', 'Ned', 'Odile', 'Pip', 'Rosa', 'Sten', 'Tilda', 'Ulf',
  'Vera', 'Wim', 'Yara', 'Zeb', 'Agna', 'Bertram', 'Corin', 'Della', 'Edric', 'Fenna', 'Gideon', 'Hilde', 'Ivo', 'Juna', 'Kasimir', 'Lotte', 'Magnus', 'Nell', 'Oswin', 'Petra',
  'Quinn', 'Rurik', 'Saffi', 'Tobin', 'Una', 'Viggo', 'Wren', 'Xander', 'Ysolde', 'Zora', 'Anselm', 'Berit', 'Cyril', 'Dagny', 'Emeric', 'Frida', 'Gunnar', 'Hester', 'Isak', 'Jessamy',
]
const LAST = [
  'Ashby', 'Brook', 'Cobble', 'Dunn', 'Fletcher', 'Gray', 'Hart', 'Ingle', 'Kemp', 'Lark', 'Miller', 'Nettle', 'Oakes', 'Pike', 'Reed', 'Sawyer', 'Thorne', 'Vance', 'Wells', 'Yew',
  'Barrow', 'Candlewick', 'Dimmock', 'Elderby', 'Fairweather', 'Goodbarrel', 'Holloway', 'Ironside', 'Jaspers', 'Kettle', 'Larkspur', 'Marsh', 'Norwood', 'Penhallow', 'Quill', 'Rookwood',
]

export function personName(rng: Rng): string {
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`
}

const TAVERN_A = ['Dancing', 'Drunken', 'Rusty', 'Golden', 'Sleeping', 'Laughing', 'Crooked', 'Silver', 'One-Eyed', 'Wandering', 'Salty', 'Burning']
const TAVERN_B = ['Pony', 'Dragon', 'Tankard', 'Goblin', 'Griffon', 'Barrel', 'Wizard', 'Boar', 'Mermaid', 'Lantern', 'Anvil', 'Crow']

export function tavernName(rng: Rng): string {
  return `The ${rng.pick(TAVERN_A)} ${rng.pick(TAVERN_B)}`
}
