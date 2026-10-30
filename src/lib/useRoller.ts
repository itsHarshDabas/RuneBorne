import { useState } from 'react'
import { useGame } from '../store/game'
import type { RollResult } from './dice'

/** Rolls through the shared log and keeps the last result / error for display. */
export function useRoller() {
  const rollDice = useGame((s) => s.rollDice)
  const [last, setLast] = useState<RollResult | null>(null)
  const [error, setError] = useState('')
  const [seq, setSeq] = useState(0)

  function doRoll(expr: string, label?: string, who?: string): RollResult | null {
    try {
      const r = rollDice(expr, label, who)
      setLast(r)
      setSeq((n) => n + 1)
      setError('')
      return r
    } catch (e) {
      setError((e as Error).message)
      return null
    }
  }
  return { last, error, seq, roll: doRoll }
}
