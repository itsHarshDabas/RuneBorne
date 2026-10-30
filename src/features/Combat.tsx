import { ChevronLeft, ChevronRight, Dices, Play, Plus, Swords, Users } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, Empty, Field, NumberInput } from '../components/ui'
import { CONDITIONS } from '../data/srd'
import { mod, rollExprWithBonus, signed, type Advantage } from '../lib/dice'
import { nextTurn, rollAttack, setHp } from '../lib/combat'
import { averageHp } from '../data/monsters'
import { clamp, uid } from '../lib/util'
import { useGame, type Combatant } from '../store/game'
import { dialog } from '../lib/dialog'

const SIDE_STYLE: Record<Combatant['side'], string> = {
  party: 'border-l-sky-400',
  ally: 'border-l-emerald-400',
  foe: 'border-l-red-500',
}

export function Combat() {
  const combat = useGame((s) => s.combat)
  const characters = useGame((s) => s.characters)
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)
  const bestiary = useGame((s) => s.bestiary)

  const [foe, setFoe] = useState<{ name: string; hp: number; ac: number; initBonus: number; count: number; monsterId?: string }>({ name: 'Goblin', hp: 7, ac: 15, initBonus: 2, count: 1 })
  const [attackerId, setAttackerId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [attackBonus, setAttackBonus] = useState(4)
  const [damageExpr, setDamageExpr] = useState('1d6+2')
  const [adv, setAdv] = useState<Advantage>('normal')
  const [lastAttack, setLastAttack] = useState<{ hit: boolean; crit: boolean; text: string } | null>(null)

  const list = combat.combatants
  const current = list[combat.turn]
  const attacker = list.find((c) => c.id === attackerId) ?? current
  const target = list.find((c) => c.id === targetId)

  function addParty() {
    edit((d) => {
      for (const pc of d.characters) {
        if (d.combat.combatants.some((c) => c.refId === pc.id)) continue
        d.combat.combatants.push({ id: uid(), name: pc.name, initBonus: mod(pc.abilities.dex), init: null, hp: pc.hp, maxHp: pc.maxHp, ac: pc.ac, conditions: [], side: 'party', refId: pc.id })
      }
    })
  }

  function addFoes() {
    edit((d) => {
      for (let i = 1; i <= foe.count; i++) {
        d.combat.combatants.push({
          id: uid(),
          name: foe.count > 1 ? `${foe.name} ${i}` : foe.name,
          initBonus: foe.initBonus,
          init: null,
          hp: foe.hp,
          maxHp: foe.hp,
          ac: foe.ac,
          conditions: [],
          side: 'foe',
          monsterId: foe.monsterId,
        })
      }
    })
  }

  function rollInitiative(onlyMissing: boolean) {
    const rolls = list.filter((c) => !onlyMissing || c.init === null).map((c) => ({ id: c.id, total: rollDice(rollExprWithBonus(c.initBonus), 'Initiative', c.name).total }))
    edit((d) => {
      for (const r of rolls) {
        const c = d.combat.combatants.find((x) => x.id === r.id)
        if (c) c.init = r.total
      }
      d.combat.combatants.sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || b.initBonus - a.initBonus)
      d.combat.turn = 0
      d.combat.round = 1
    })
  }

  function turn(dir: 1 | -1) {
    edit((d) => nextTurn(d, dir))
    setLastAttack(null)
  }

  function attack() {
    if (!target) return
    const out = rollAttack(rollDice, { who: attacker?.name, targetName: target.name, targetAc: target.ac, bonus: attackBonus, damage: damageExpr, adv })
    if (out.damage) edit((d) => setHp(d, target.id, target.hp - out.damage))
    setLastAttack(out)
  }

  const attackerMonster = bestiary.find((m) => m.id === attacker?.monsterId)

  const update = (id: string, fn: (c: Combatant) => void) =>
    edit((d) => {
      const c = d.combat.combatants.find((x) => x.id === id)
      if (c) fn(c)
    })

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card
        title={<>Combat · Round {combat.round}</>}
        actions={
          <>
            <Button size="sm" onClick={() => turn(-1)} disabled={!list.length} icon={ChevronLeft}>Prev</Button>
            <Button size="sm" variant="primary" onClick={() => turn(1)} disabled={!list.length} icon={ChevronRight}>Next turn</Button>
            <Button size="sm" onClick={() => rollInitiative(false)} disabled={!list.length} icon={Dices}>Roll all initiative</Button>
            <Button
              size="sm"
              variant="danger"
              onClick={async () => (await dialog.confirm({ title: 'End combat?', message: 'This clears the initiative tracker.', confirmLabel: 'End combat', danger: true })) && edit((d) => void (d.combat = { round: 1, turn: 0, combatants: [] }))}
              disabled={!list.length}
            >
              End combat
            </Button>
          </>
        }
      >
        {list.length === 0 ? (
          <Empty>Add the party and some foes, then roll initiative.</Empty>
        ) : (
          <ul className="space-y-2">
            {list.map((c, i) => (
              <CombatRow
                key={c.id}
                c={c}
                active={i === combat.turn}
                onHp={(hp) => edit((d) => setHp(d, c.id, hp))}
                onChange={(fn) => update(c.id, fn)}
                onRemove={() => edit((d) => {
                  d.combat.combatants = d.combat.combatants.filter((x) => x.id !== c.id)
                  d.combat.turn = clamp(d.combat.turn, 0, Math.max(0, d.combat.combatants.length - 1))
                })}
              />
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-4">
        <Card title="Add combatants">
          <Button className="mb-3 w-full" onClick={addParty} disabled={!characters.length} icon={Users}>Add the whole party</Button>
          <div className="grid grid-cols-2 gap-2">
            {bestiary.length > 0 && (
              <Field label="From your enemies" className="col-span-2">
                <select
                  className="input"
                  value={foe.monsterId ?? ''}
                  onChange={(e) => {
                    const m = bestiary.find((x) => x.id === e.target.value)
                    if (m) setFoe({ ...foe, name: m.name, hp: averageHp(m), ac: m.ac, initBonus: m.initBonus, monsterId: m.id })
                    else setFoe({ ...foe, monsterId: undefined })
                  }}
                >
                  <option value="">Custom…</option>
                  {bestiary.map((m) => <option key={m.id} value={m.id}>{m.name} (CR {m.cr})</option>)}
                </select>
              </Field>
            )}
            <Field label="Name" className="col-span-2"><input className="input" value={foe.name} onChange={(e) => setFoe({ ...foe, name: e.target.value })} /></Field>
            <Field label="HP"><NumberInput value={foe.hp} onChange={(hp) => setFoe({ ...foe, hp })} /></Field>
            <Field label="AC"><NumberInput value={foe.ac} onChange={(ac) => setFoe({ ...foe, ac })} /></Field>
            <Field label="Init bonus"><NumberInput value={foe.initBonus} onChange={(initBonus) => setFoe({ ...foe, initBonus })} /></Field>
            <Field label="How many"><NumberInput value={foe.count} min={1} max={20} onChange={(count) => setFoe({ ...foe, count: clamp(count, 1, 20) })} /></Field>
          </div>
          <Button variant="primary" className="mt-3 w-full" onClick={addFoes} icon={Plus}>Add foe{foe.count > 1 ? 's' : ''}</Button>
          {list.some((c) => c.init === null) && (
            <Button size="sm" variant="subtle" className="mt-2 w-full" onClick={() => rollInitiative(true)}>Roll initiative for newcomers only</Button>
          )}
        </Card>

        <Card title="Attack!">
          {list.length < 2 ? (
            <p className="text-sm text-muted">Needs at least two combatants.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Attacker">
                  <select className="input" value={attacker?.id ?? ''} onChange={(e) => setAttackerId(e.target.value)}>
                    {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Target">
                  <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                    <option value="">Choose…</option>
                    {list.filter((c) => c.id !== attacker?.id).map((c) => <option key={c.id} value={c.id}>{c.name} (AC {c.ac})</option>)}
                  </select>
                </Field>
                {attackerMonster && attackerMonster.attacks.length > 0 && (
                  <div className="col-span-2 flex flex-wrap gap-1">
                    {attackerMonster.attacks.map((a) => (
                      <Button key={a.id} size="sm" variant="subtle" onClick={() => { setAttackBonus(a.bonus); setDamageExpr(a.damage) }} title={a.notes}>
                        {a.name} {signed(a.bonus)}
                      </Button>
                    ))}
                  </div>
                )}
                <Field label="Attack bonus"><NumberInput value={attackBonus} onChange={setAttackBonus} /></Field>
                <Field label="Damage"><input className="input font-mono" value={damageExpr} onChange={(e) => setDamageExpr(e.target.value)} /></Field>
              </div>
              <div className="flex overflow-hidden rounded-md border border-edge text-xs">
                {(['dis', 'normal', 'adv'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setAdv(m)} className={`flex-1 py-1 ${adv === m ? (m === 'adv' ? 'bg-emerald-700' : m === 'dis' ? 'bg-blood' : 'bg-edge') : ''}`}>
                    {m === 'normal' ? 'Normal' : m === 'adv' ? 'Advantage' : 'Disadvantage'}
                  </button>
                ))}
              </div>
              <Button variant="primary" className="w-full" disabled={!target} onClick={attack} icon={Swords}>Roll attack</Button>
              {lastAttack && (
                <p className={`tumble rounded-md p-2 text-center text-sm ${lastAttack.crit ? 'bg-gold/20 text-gold' : lastAttack.hit ? 'bg-emerald-900/40 text-emerald-200' : 'bg-panel-2 text-muted'}`}>
                  {lastAttack.text}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function CombatRow({ c, active, onHp, onChange, onRemove }: { c: Combatant; active: boolean; onHp: (hp: number) => void; onChange: (fn: (c: Combatant) => void) => void; onRemove: () => void }) {
  const [delta, setDelta] = useState(0)
  const down = c.hp <= 0
  return (
    <li className={`rounded-lg border border-l-4 border-edge ${SIDE_STYLE[c.side]} p-2.5 ${active ? 'bg-gold/10 ring-1 ring-gold' : 'bg-panel-2/60'} ${down ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          className="input w-14 text-center font-display"
          value={c.init ?? ''}
          placeholder="—"
          title="Initiative"
          onChange={(e) => onChange((x) => void (x.init = e.target.value === '' ? null : Number(e.target.value)))}
        />
        <div className="min-w-32 flex-1">
          <div className="font-semibold">
            {active && <Play size={12} className="mr-1 inline fill-gold text-gold" />}
            {c.name} {down && <Badge className="text-red-300">Down</Badge>}
          </div>
          <div className="text-xs text-muted">AC {c.ac} · init {signed(c.initBonus)} · {c.side}</div>
        </div>
        <div className="w-36">
          <div className="text-right text-sm">
            <b>{c.hp}</b>/{c.maxHp}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink">
            <div className={`h-full ${c.side === 'foe' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${c.maxHp ? (c.hp / c.maxHp) * 100 : 0}%` }} />
          </div>
        </div>
        <NumberInput value={delta} min={0} onChange={setDelta} className="w-16" />
        <Button size="sm" variant="danger" onClick={() => onHp(c.hp - delta)}>Dmg</Button>
        <Button size="sm" onClick={() => onHp(c.hp + delta)}>Heal</Button>
        <select
          className="input w-auto py-1 text-xs"
          value=""
          onChange={(e) => {
            const v = e.target.value
            if (v) onChange((x) => void (x.conditions = x.conditions.includes(v) ? x.conditions : [...x.conditions, v]))
          }}
        >
          <option value="">+ Condition</option>
          {CONDITIONS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <button type="button" className="px-1 text-muted hover:text-red-400" onClick={onRemove} aria-label={`Remove ${c.name}`}>×</button>
      </div>
      {c.conditions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.conditions.map((k) => (
            <button key={k} type="button" onClick={() => onChange((x) => void (x.conditions = x.conditions.filter((y) => y !== k)))} title="Click to remove">
              <Badge className="border-amber-500/50 text-amber-200">{k} ×</Badge>
            </button>
          ))}
        </div>
      )}
    </li>
  )
}
