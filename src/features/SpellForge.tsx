import { Dices } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, Combo, Empty, Field, NumberInput } from '../components/ui'
import { POWER_TIERS, powerTier, SPELL_SCHOOLS } from '../data/homebrew'
import { proficiencyBonus } from '../data/srd'
import { mod, signed } from '../lib/dice'
import { uid } from '../lib/util'
import { useGame, type Spell } from '../store/game'

type Stage = 'design' | 'approve' | 'learn' | 'power' | 'mana' | 'done' | 'failed'

const TIER_MANA_BONUS = [0, 0, 1, 2, 4]

export function SpellForge() {
  const characters = useGame((s) => s.characters)
  const spells = useGame((s) => s.spells)
  const settings = useGame((s) => s.settings)
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)

  const [casterId, setCasterId] = useState(characters[0]?.id ?? '')
  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [description, setDescription] = useState('')
  const [dc, setDc] = useState(settings.learnDc)
  const [extraBonus, setExtraBonus] = useState(0)
  const [stage, setStage] = useState<Stage>('design')
  const [learnRoll, setLearnRoll] = useState<number | null>(null)
  const [powerRoll, setPowerRoll] = useState<number | null>(null)
  const [damage, setDamage] = useState('')
  const [manaCost, setManaCost] = useState<number | null>(null)

  const caster = characters.find((c) => c.id === casterId) ?? characters[0]
  const learnBonus = caster ? mod(caster.abilities[caster.spellAbility]) + proficiencyBonus(caster.level) + extraBonus : extraBonus
  const tier = powerRoll !== null ? powerTier(powerRoll) : null
  const tierIndex = tier ? POWER_TIERS.indexOf(tier) : 0

  function reset() {
    setStage('design')
    setName('')
    setSchool('')
    setDescription('')
    setLearnRoll(null)
    setPowerRoll(null)
    setDamage('')
    setManaCost(null)
    setExtraBonus(0)
  }

  function rollLearn() {
    const r = rollDice(`1d20${signed(learnBonus)}`, `Learn "${name}" (DC ${dc})`, caster?.name)
    setLearnRoll(r.total)
    setStage(r.total >= dc ? 'power' : 'failed')
  }

  function rollPower() {
    const r = rollDice(settings.powerDie, `Power of "${name}"`, caster?.name)
    // Scale any power die onto the d20 tier table
    const sides = Number(settings.powerDie.match(/d(\d+)/)?.[1] ?? 20)
    const scaled = Math.max(1, Math.round((r.total / sides) * 20))
    setPowerRoll(scaled)
    setDamage(powerTier(scaled).damage)
    setStage('mana')
  }

  function rollMana() {
    const r = rollDice(settings.manaDie, `Mana cost of "${name}"`, caster?.name)
    setManaCost(Math.max(1, r.total + TIER_MANA_BONUS[tierIndex]))
    setStage('done')
  }

  function save(learned: boolean) {
    const spell: Spell = {
      id: uid(),
      name: name.trim() || 'Nameless spell',
      school: school.trim(),
      description: description.trim(),
      casterId: caster?.id ?? '',
      learnRoll: learnRoll ?? 0,
      learnDc: dc,
      learned,
      powerRoll: powerRoll ?? 0,
      tier: tier?.name ?? '-',
      damage: damage.trim(),
      manaCost: manaCost ?? 0,
      createdAt: Date.now(),
    }
    edit((d) => void d.spells.unshift(spell))
    reset()
  }

  const step = (n: number, label: string, active: boolean, doneStage: boolean) => (
    <li className={`flex items-center gap-2 ${active ? 'text-gold' : doneStage ? 'text-emerald-300' : 'text-muted'}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${active ? 'border-gold' : doneStage ? 'border-emerald-400' : 'border-edge'}`}>{doneStage ? '✓' : n}</span>
      {label}
    </li>
  )
  const order: Stage[] = ['design', 'approve', 'learn', 'power', 'mana', 'done']
  const at = order.indexOf(stage === 'failed' ? 'learn' : stage)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card title="Spell Forge" actions={stage !== 'design' && <Button size="sm" onClick={reset}>Start over</Button>}>
        <ol className="mb-4 flex flex-wrap gap-4 text-sm">
          {step(1, 'Design', at === 0, at > 0)}
          {step(2, 'DM approves', at === 1, at > 1)}
          {step(3, 'Learn roll', at === 2, at > 2)}
          {step(4, 'Power roll', at === 3, at > 3)}
          {step(5, 'Mana roll', at === 4, at > 4)}
        </ol>

        {characters.length === 0 ? (
          <Empty>Create a character first so someone can learn spells.</Empty>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Who is learning it">
                <select className="input" value={caster?.id ?? ''} onChange={(e) => setCasterId(e.target.value)} disabled={stage !== 'design'}>
                  {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Spell name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ember Lance" disabled={stage !== 'design'} />
              </Field>
              <Field label="School">
                <Combo id="forge-school" value={school} onChange={setSchool} options={SPELL_SCHOOLS} placeholder="Evocation" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Learn DC"><NumberInput value={dc} onChange={setDc} /></Field>
                <Field label="Extra bonus"><NumberInput value={extraBonus} onChange={setExtraBonus} /></Field>
              </div>
            </div>
            <Field label="What does it do?">
              <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A spear of fire that pierces through one enemy and sets the ground ablaze." />
            </Field>

            <div className="rounded-xl border border-edge bg-panel-2/60 p-4">
              {stage === 'design' && (
                <Button variant="primary" disabled={!name.trim()} onClick={() => setStage('approve')}>Ask the DM</Button>
              )}
              {stage === 'approve' && (
                <div className="space-y-2">
                  <p>
                    <b>DM:</b> can <b>{caster?.name}</b> attempt to learn <b className="text-gold">{name}</b>?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => setStage('learn')}>Yes, let them try</Button>
                    <Button variant="danger" onClick={reset}>No. Not today.</Button>
                  </div>
                </div>
              )}
              {stage === 'learn' && (
                <div className="space-y-2">
                  <p>
                    Roll d20 {signed(learnBonus)} (casting mod + proficiency{extraBonus ? ' + extra' : ''}) against DC <b>{dc}</b>.
                  </p>
                  <Button variant="primary" onClick={rollLearn} icon={Dices}>Roll to learn</Button>
                </div>
              )}
              {stage === 'failed' && (
                <div className="space-y-2">
                  <p className="text-red-300">
                    Rolled <b>{learnRoll}</b> vs DC {dc}. The magic slips away...
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setStage('learn')}>DM allows another try</Button>
                    <Button variant="subtle" onClick={() => setStage('power')}>DM overrides: they learn it</Button>
                    <Button variant="danger" onClick={() => save(false)}>Record the failure</Button>
                  </div>
                </div>
              )}
              {stage === 'power' && (
                <div className="space-y-2">
                  {learnRoll !== null && <p className="text-emerald-300">Learned! (rolled {learnRoll} vs DC {dc})</p>}
                  <p>Now roll {settings.powerDie} to see how strong it is.</p>
                  <Button variant="primary" onClick={rollPower} icon={Dices}>Roll power</Button>
                </div>
              )}
              {(stage === 'mana' || stage === 'done') && tier && (
                <div className="space-y-3">
                  <p>
                    Power <b>{powerRoll}</b>/20 → <b className={`font-display text-xl ${tier.color}`}>{tier.name}</b>
                    <span className="text-sm text-muted"> · {tier.note}</span>
                  </p>
                  <Field label="Damage / effect dice (edit freely)" className="max-w-xs">
                    <input className="input font-mono" value={damage} onChange={(e) => setDamage(e.target.value)} />
                  </Field>
                  {stage === 'mana' && (
                    <>
                      <p>Roll {settings.manaDie}{TIER_MANA_BONUS[tierIndex] ? ` + ${TIER_MANA_BONUS[tierIndex]} (tier)` : ''} for the mana cost.</p>
                      <Button variant="primary" onClick={rollMana} icon={Dices}>Roll mana cost</Button>
                    </>
                  )}
                  {stage === 'done' && manaCost !== null && (
                    <>
                      <Field label="Mana cost" className="max-w-32"><NumberInput value={manaCost} min={0} onChange={setManaCost} /></Field>
                      <Button variant="primary" onClick={() => save(true)}>Add to {caster?.name}'s spellbook</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card title="Spellbook">
        {spells.length === 0 ? (
          <p className="text-sm text-muted">Forged spells show up here.</p>
        ) : (
          <ul className="space-y-2">
            {spells.map((sp) => {
              const who = characters.find((c) => c.id === sp.casterId)
              return (
                <li key={sp.id} className={`rounded-lg border p-2.5 text-sm ${sp.learned ? 'border-edge bg-panel-2/60' : 'border-blood/40 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b>{sp.name}</b> {sp.school && <span className="text-xs text-muted">({sp.school})</span>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge>{who?.name ?? 'Unknown'}</Badge>
                        {sp.learned ? (
                          <>
                            <Badge>{sp.tier}</Badge>
                            {sp.damage && <Badge className="font-mono">{sp.damage}</Badge>}
                            <Badge className="text-violet-300">{sp.manaCost} mana</Badge>
                          </>
                        ) : (
                          <Badge className="text-red-300">Failed to learn</Badge>
                        )}
                      </div>
                    </div>
                    <button type="button" className="text-muted hover:text-red-400" aria-label={`Delete ${sp.name}`} onClick={() => edit((d) => void (d.spells = d.spells.filter((x) => x.id !== sp.id)))}>
                      ×
                    </button>
                  </div>
                  {sp.description && <p className="mt-1 text-xs text-muted">{sp.description}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
