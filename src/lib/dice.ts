// Dice notation parser and roller.
// Supports: 2d6+3, d20, d%, 4dF (Fudge), 1d6! (exploding), 4d6dl1, 2d20kh1, 2d20kl1, 3d8-1d4

export type Die = { sides: number; value: number; dropped?: boolean; exploded?: boolean }
export type Term = { text: string; sign: 1 | -1; value: number; dice?: Die[] }
export type RollResult = { expr: string; total: number; terms: Term[]; crit?: 'hit' | 'miss' }

const MAX_DICE = 200
const MAX_EXPLOSIONS = 30
const DICE_TERM = /^(\d*)d(\d+|%|f)(!)?(?:(kh|kl|dh|dl|k|d)(\d+))?$/

function randomInt(max: number): number {
  // Rejection sampling over crypto randomness to avoid modulo bias
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  let x: number
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return x % max
}

export function rollDie(sides: number): number {
  return 1 + randomInt(sides)
}

function rollDiceTerm(body: string): Die[] {
  const m = body.match(DICE_TERM)
  if (!m) throw new Error(`Can't read "${body}"`)
  const count = m[1] ? Number(m[1]) : 1
  if (count < 1 || count > MAX_DICE) throw new Error(`Dice count must be 1-${MAX_DICE}`)
  const fudge = m[2] === 'f'
  const sides = m[2] === '%' ? 100 : fudge ? 3 : Number(m[2])
  if (sides < 2 || sides > 1000) throw new Error('Dice need 2-1000 sides')
  const explode = Boolean(m[3]) && !fudge

  const dice: Die[] = []
  for (let i = 0; i < count; i++) {
    let v = rollDie(sides)
    dice.push({ sides: fudge ? 0 : sides, value: fudge ? v - 2 : v })
    let guard = 0
    while (explode && v === sides && guard++ < MAX_EXPLOSIONS) {
      v = rollDie(sides)
      dice.push({ sides, value: v, exploded: true })
    }
  }

  if (m[4]) {
    const op = m[4] === 'k' ? 'kh' : m[4] === 'd' ? 'dl' : m[4]
    const n = Math.min(Number(m[5]), dice.length)
    const order = dice.map((d, i) => ({ v: d.value, i })).sort((a, b) => a.v - b.v)
    const lowFirst = order.map((o) => o.i)
    const highFirst = [...lowFirst].reverse()
    const drop =
      op === 'kh' ? lowFirst.slice(0, dice.length - n)
      : op === 'kl' ? highFirst.slice(0, dice.length - n)
      : op === 'dh' ? highFirst.slice(0, n)
      : lowFirst.slice(0, n)
    for (const i of drop) dice[i].dropped = true
  }
  return dice
}

export function roll(input: string): RollResult {
  const expr = input.replace(/\s+/g, '').toLowerCase()
  if (!expr) throw new Error('Type a roll like 1d20+5')
  const tokens = expr.match(/[+-]?[^+-]+/g) ?? []
  if (tokens.join('') !== expr) throw new Error(`Can't read "${input}"`)

  const terms: Term[] = tokens.map((tok) => {
    const sign: 1 | -1 = tok.startsWith('-') ? -1 : 1
    const body = tok.replace(/^[+-]/, '')
    if (/^\d+$/.test(body)) return { text: body, sign, value: Number(body) }
    const dice = rollDiceTerm(body)
    const value = dice.filter((d) => !d.dropped).reduce((a, d) => a + d.value, 0)
    return { text: body, sign, value, dice }
  })

  const total = terms.reduce((a, t) => a + t.sign * t.value, 0)

  // Natural 20/1 only when the roll has exactly one d20 group that keeps exactly one die
  let crit: RollResult['crit']
  const diceTerms = terms.filter((t) => t.dice)
  if (diceTerms.length === 1) {
    const kept = diceTerms[0].dice!.filter((d) => !d.dropped)
    if (kept.length === 1 && kept[0].sides === 20) {
      if (kept[0].value === 20) crit = 'hit'
      if (kept[0].value === 1) crit = 'miss'
    }
  }
  return { expr: input.trim(), total, terms, crit }
}

export type Advantage = 'normal' | 'adv' | 'dis'

/** Turns the first single d20 into 2d20kh1 / 2d20kl1. */
export function applyAdvantage(expr: string, mode: Advantage): string {
  if (mode === 'normal') return expr
  const keep = mode === 'adv' ? 'kh1' : 'kl1'
  return expr.replace(/(^|[+-])\s*1?d20(?![\d!kd])/i, `$12d20${keep}`)
}

export function formatTerms(r: RollResult): string {
  return r.terms
    .map((t, i) => {
      const sign = t.sign < 0 ? '- ' : i > 0 ? '+ ' : ''
      if (!t.dice) return `${sign}${t.value}`
      const face = (d: Die) => (d.sides === 0 ? (d.value > 0 ? '+' : d.value < 0 ? '−' : '0') : String(d.value))
      const kept = t.dice.filter((d) => !d.dropped).map((d) => (d.exploded ? `${face(d)}!` : face(d)))
      const dropped = t.dice.filter((d) => d.dropped).map(face)
      const faces = kept.join(', ') + (dropped.length ? ` | dropped ${dropped.join(', ')}` : '')
      return `${sign}[${faces}]`
    })
    .join(' ')
}

export function mod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

export function rollExprWithBonus(bonus: number, die = '1d20'): string {
  return bonus === 0 ? die : `${die}${signed(bonus)}`
}

/** Average result of simple notation like "2d8+2" (rounded down, as stat blocks do). Returns null if it can't tell. */
export function averageRoll(input: string): number | null {
  const expr = input.replace(/\s+/g, '').toLowerCase()
  if (!expr) return null
  const tokens = expr.match(/[+-]?[^+-]+/g) ?? []
  if (tokens.join('') !== expr) return null
  let total = 0
  for (const tok of tokens) {
    const sign = tok.startsWith('-') ? -1 : 1
    const body = tok.replace(/^[+-]/, '')
    const m = /^(\d*)d(\d+)$/.exec(body)
    if (/^\d+$/.test(body)) total += sign * Number(body)
    else if (m) total += (sign * (Number(m[1] || 1) * (Number(m[2]) + 1))) / 2
    else return null
  }
  return Math.floor(total)
}
