import { useState } from 'react'
import { Button, Card, Field, NumberInput } from '../components/ui'
import { DieShape } from '../components/DieShape'
import { applyAdvantage, signed, type Advantage, type RollResult } from '../lib/dice'
import { useRoller } from '../lib/useRoller'
import { uid } from '../lib/util'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'

const DICE = [4, 6, 8, 10, 12, 20, 100]
const DIE_COLORS: Record<number, string> = {
  4: 'text-rose-400', 6: 'text-orange-300', 8: 'text-amber-300', 10: 'text-lime-300',
  12: 'text-sky-300', 20: 'text-gold', 100: 'text-violet-300',
}

export function RollResultView({ result }: { result: RollResult }) {
  return (
    <div className="tumble text-center">
      <div className={`font-display text-6xl ${result.crit === 'hit' ? 'text-gold' : result.crit === 'miss' ? 'text-red-400' : 'text-parch'}`}>{result.total}</div>
      <div className="mt-1 text-sm text-muted">{result.expr}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {result.terms.flatMap((t, ti) =>
          t.dice
            ? t.dice.map((d, di) => (
                <span
                  key={`${ti}-${di}`}
                  className={`flex h-9 min-w-9 items-center justify-center rounded-md border px-1 font-mono text-sm ${
                    d.dropped ? 'border-edge text-muted line-through opacity-50' : d.exploded ? 'border-ember text-orange-300' : 'border-gold/50 bg-gold/10'
                  }`}
                  title={d.dropped ? 'dropped' : d.exploded ? 'exploded!' : undefined}
                >
                  {d.sides === 0 ? (d.value > 0 ? '+' : d.value < 0 ? '−' : '·') : d.value}
                </span>
              ))
            : [
                <span key={`${ti}-c`} className="flex h-9 items-center px-1 font-mono text-sm text-muted">
                  {t.sign < 0 ? '−' : '+'}
                  {t.value}
                </span>,
              ],
        )}
      </div>
      {result.crit === 'hit' && <p className="mt-2 font-display text-gold">Natural 20!</p>}
      {result.crit === 'miss' && <p className="mt-2 font-display text-red-400">Natural 1...</p>}
    </div>
  )
}

export function DiceTray() {
  const { last, error, seq, roll } = useRoller()
  const who = useUi((s) => s.rollingAs)
  const macros = useGame((s) => s.macros)
  const edit = useGame((s) => s.edit)
  const [count, setCount] = useState(1)
  const [modifier, setModifier] = useState(0)
  const [adv, setAdv] = useState<Advantage>('normal')
  const [expr, setExpr] = useState('')
  const [macroName, setMacroName] = useState('')

  function quickRoll(sides: number) {
    let e = `${count}d${sides === 100 ? '%' : sides}${modifier ? signed(modifier) : ''}`
    if (sides === 20 && count === 1) e = applyAdvantage(e, adv)
    roll(e, sides === 20 && adv !== 'normal' ? (adv === 'adv' ? 'Advantage' : 'Disadvantage') : '', who)
  }

  function saveMacro() {
    if (!expr.trim()) return
    edit((d) => void d.macros.push({ id: uid(), name: macroName.trim() || expr.trim(), expr: expr.trim() }))
    setMacroName('')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card title="Dice Tray">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="How many" className="w-24">
              <NumberInput value={count} min={1} max={50} onChange={(n) => setCount(Math.max(1, Math.min(50, n)))} />
            </Field>
            <Field label="Modifier" className="w-24">
              <NumberInput value={modifier} onChange={setModifier} />
            </Field>
            <div>
              <span className="label">d20 mode</span>
              <div className="flex overflow-hidden rounded-md border border-edge">
                {(['dis', 'normal', 'adv'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAdv(m)}
                    className={`px-3 py-1.5 text-sm ${adv === m ? (m === 'adv' ? 'bg-emerald-700' : m === 'dis' ? 'bg-blood' : 'bg-edge') : 'hover:bg-panel-2'}`}
                  >
                    {m === 'dis' ? 'Disadvantage' : m === 'adv' ? 'Advantage' : 'Normal'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {DICE.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => quickRoll(s)}
                className={`group rounded-xl border border-edge bg-panel-2/60 p-2 transition hover:-translate-y-0.5 hover:border-gold ${DIE_COLORS[s]}`}
                title={`Roll ${count}d${s}`}
              >
                <DieShape sides={s} label={s === 100 ? 'd%' : undefined} className="mx-auto h-14 w-14 transition group-active:rotate-45" />
              </button>
            ))}
          </div>
        </Card>

        <Card title="Custom roll">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              roll(expr, '', who)
            }}
          >
            <input className="input flex-1 font-mono" placeholder="e.g. 2d6+1d4+3, 4d6dl1, 2d20kh1, 1d10!, 4dF" value={expr} onChange={(e) => setExpr(e.target.value)} />
            <Button type="submit" variant="primary">
              Roll
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <details className="mt-3 text-sm text-muted">
            <summary className="cursor-pointer">Notation cheat sheet</summary>
            <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
              <li>2d6+3 · roll and add</li>
              <li>4d6dl1 · drop lowest 1</li>
              <li>2d20kh1 · keep highest (advantage)</li>
              <li>2d20kl1 · keep lowest (disadvantage)</li>
              <li>1d6! · exploding (max rolls again)</li>
              <li>4dF · Fudge dice (−, ·, +)</li>
              <li>d% · percentile</li>
              <li>1d7, 3d30 · any weird die you like</li>
            </ul>
          </details>
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-edge pt-3">
            <Field label="Save this roll as a button" className="flex-1">
              <input className="input" placeholder="Name, e.g. Greatsword" value={macroName} onChange={(e) => setMacroName(e.target.value)} />
            </Field>
            <Button onClick={saveMacro} disabled={!expr.trim()}>
              Save
            </Button>
          </div>
          {macros.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {macros.map((m) => (
                <span key={m.id} className="inline-flex overflow-hidden rounded-md border border-edge">
                  <button type="button" className="px-2.5 py-1 text-sm hover:bg-panel-2" onClick={() => roll(m.expr, m.name, who)} title={m.expr}>
                    {m.name} <span className="font-mono text-xs text-muted">{m.expr}</span>
                  </button>
                  <button type="button" className="border-l border-edge px-2 text-muted hover:text-red-400" onClick={() => edit((d) => void (d.macros = d.macros.filter((x) => x.id !== m.id)))} aria-label={`Delete ${m.name}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Result" className="min-h-64">
        {last ? <RollResultView key={seq} result={last} /> : <p className="py-10 text-center text-muted">Click a die to roll.</p>}
        <p className="mt-6 text-center text-xs text-muted">
          Rolling as <b className="text-parch">{who}</b>
        </p>
      </Card>
    </div>
  )
}
