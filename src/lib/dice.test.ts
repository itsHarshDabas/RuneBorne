import { describe, expect, it } from 'vitest'
import { applyAdvantage, mod, roll } from './dice'

describe('roll', () => {
  it('adds constants and dice within range', () => {
    for (let i = 0; i < 500; i++) {
      const r = roll('2d6+3')
      expect(r.total).toBeGreaterThanOrEqual(5)
      expect(r.total).toBeLessThanOrEqual(15)
    }
  })

  it('handles subtraction and multiple dice groups', () => {
    for (let i = 0; i < 300; i++) {
      const r = roll('1d4 - 1d4 - 2')
      expect(r.total).toBeGreaterThanOrEqual(-5)
      expect(r.total).toBeLessThanOrEqual(1)
    }
  })

  it('drops the lowest die for 4d6dl1', () => {
    for (let i = 0; i < 300; i++) {
      const r = roll('4d6dl1')
      const dice = r.terms[0].dice!
      expect(dice.filter((d) => d.dropped)).toHaveLength(1)
      const kept = dice.filter((d) => !d.dropped).map((d) => d.value)
      const dropped = dice.find((d) => d.dropped)!.value
      expect(Math.min(...kept)).toBeGreaterThanOrEqual(dropped)
      expect(r.total).toBe(kept.reduce((a, b) => a + b, 0))
    }
  })

  it('keeps highest / lowest for advantage and disadvantage', () => {
    for (let i = 0; i < 300; i++) {
      const adv = roll('2d20kh1').terms[0].dice!
      expect(adv.find((d) => !d.dropped)!.value).toBe(Math.max(...adv.map((d) => d.value)))
      const dis = roll('2d20kl1').terms[0].dice!
      expect(dis.find((d) => !d.dropped)!.value).toBe(Math.min(...dis.map((d) => d.value)))
    }
  })

  it('explodes on max and supports fudge and percentile dice', () => {
    let exploded = false
    for (let i = 0; i < 500; i++) {
      const r = roll('1d4!')
      if (r.terms[0].dice!.length > 1) exploded = true
      expect(r.terms[0].dice![0].value === 4 || r.terms[0].dice!.length === 1).toBe(true)
    }
    expect(exploded).toBe(true)
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(roll('4dF').total)).toBeLessThanOrEqual(4)
      const p = roll('d%').total
      expect(p).toBeGreaterThanOrEqual(1)
      expect(p).toBeLessThanOrEqual(100)
    }
  })

  it('flags natural 20s and 1s only on a single kept d20', () => {
    const seen = new Set<string | undefined>()
    for (let i = 0; i < 2000; i++) {
      const r = roll('1d20+5')
      if (r.crit === 'hit') expect(r.total).toBe(25)
      if (r.crit === 'miss') expect(r.total).toBe(6)
      seen.add(r.crit)
    }
    expect(seen.has('hit')).toBe(true)
    expect(roll('3d20').crit).toBeUndefined()
  })

  it('rejects garbage', () => {
    expect(() => roll('')).toThrow()
    expect(() => roll('banana')).toThrow()
    expect(() => roll('1d1')).toThrow()
    expect(() => roll('999d6')).toThrow()
    expect(() => roll('2d6++3')).toThrow()
  })
})

describe('helpers', () => {
  it('applies advantage to the first d20 only', () => {
    expect(applyAdvantage('1d20+5', 'adv')).toBe('2d20kh1+5')
    expect(applyAdvantage('d20-1', 'dis')).toBe('2d20kl1-1')
    expect(applyAdvantage('2d6+1d20', 'adv')).toBe('2d6+2d20kh1')
    expect(applyAdvantage('1d20+5', 'normal')).toBe('1d20+5')
  })

  it('computes ability modifiers', () => {
    expect([1, 8, 9, 10, 11, 15, 20].map(mod)).toEqual([-5, -1, -1, 0, 0, 2, 5])
  })
})
