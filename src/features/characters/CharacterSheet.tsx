import { useState } from 'react'
import { Badge, Button, Card, Combo, Field, NumberInput } from '../../components/ui'
import { BLOODLINES } from '../../data/homebrew'
import { ABILITIES, ABILITY_NAMES, BACKGROUNDS, CLASSES, findClass, proficiencyBonus, SKILLS, SPECIES, type Ability } from '../../data/srd'
import { saveBonus, skillBonus } from '../../lib/character'
import { applyAdvantage, mod, rollExprWithBonus, signed, type Advantage } from '../../lib/dice'
import { clamp } from '../../lib/util'
import { useGame, type Character } from '../../store/game'
import { TarotCardView } from './CharacterCreator'
import { dialog } from '../../lib/dialog'
import { Inventory } from '../items/Inventory'

export function CharacterSheet({ c }: { c: Character }) {
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)
  const allSpells = useGame((s) => s.spells)
  const spells = allSpells.filter((sp) => sp.casterId === c.id && sp.learned)
  const [adv, setAdv] = useState<Advantage>('normal')
  const [hpDelta, setHpDelta] = useState(5)

  const update = (fn: (ch: Character) => void) =>
    edit((d) => {
      const ch = d.characters.find((x) => x.id === c.id)
      if (ch) fn(ch)
    })

  const pb = proficiencyBonus(c.level)
  const advLabel = adv === 'adv' ? ' (adv)' : adv === 'dis' ? ' (dis)' : ''
  const d20 = (bonus: number, label: string) => rollDice(applyAdvantage(rollExprWithBonus(bonus), adv), label + advLabel, c.name)

  function damage(n: number) {
    update((ch) => {
      const fromTemp = Math.min(ch.tempHp, n)
      ch.tempHp -= fromTemp
      ch.hp = clamp(ch.hp - (n - fromTemp), 0, ch.maxHp)
    })
  }

  function levelUp(average: boolean) {
    const hitDie = findClass(c.className)?.hitDie ?? 8
    const conMod = mod(c.abilities.con)
    const gain = average
      ? Math.floor(hitDie / 2) + 1 + conMod
      : rollDice(`1d${hitDie}${signed(conMod)}`, `Level ${c.level + 1} HP`, c.name).total
    update((ch) => {
      ch.level += 1
      ch.maxHp += Math.max(1, gain)
      ch.hp += Math.max(1, gain)
    })
  }

  async function castSpell(spellId: string) {
    const sp = spells.find((s) => s.id === spellId)
    if (!sp) return
    if (c.mana < sp.manaCost && !(await dialog.confirm({ title: 'Not enough mana', message: `${c.name} only has ${c.mana} mana (needs ${sp.manaCost}). Cast anyway and go negative?`, confirmLabel: 'Cast anyway', danger: true }))) return
    update((ch) => void (ch.mana -= sp.manaCost))
    if (sp.damage) rollDice(sp.damage, `${sp.name} (${sp.tier})`, c.name)
  }

  const spellMod = mod(c.abilities[c.spellAbility]) + pb

  return (
    <div className="space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <input type="color" value={c.color} onChange={(e) => update((ch) => void (ch.color = e.target.value))} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent" title="Player colour" />
            <input className="w-full bg-transparent font-display text-xl text-gold outline-none" value={c.name} onChange={(e) => update((ch) => void (ch.name = e.target.value))} />
          </span>
        }
        actions={
          <>
            <Button size="sm" onClick={() => levelUp(false)}>Level up (roll HP)</Button>
            <Button size="sm" variant="subtle" onClick={() => levelUp(true)}>Level up (average)</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Player"><input className="input" value={c.player} onChange={(e) => update((ch) => void (ch.player = e.target.value))} /></Field>
          <Field label="Level"><NumberInput value={c.level} min={1} max={20} onChange={(n) => update((ch) => void (ch.level = clamp(n, 1, 30)))} /></Field>
          <Field label="Class"><Combo id={`cls-${c.id}`} value={c.className} options={CLASSES.map((x) => x.name)} onChange={(v) => update((ch) => void (ch.className = v))} /></Field>
          <Field label="Species"><Combo id={`sp-${c.id}`} value={c.species} options={SPECIES.map((x) => x.name)} onChange={(v) => update((ch) => void (ch.species = v))} /></Field>
          <Field label="Background"><Combo id={`bg-${c.id}`} value={c.background} options={BACKGROUNDS.map((x) => x.name)} onChange={(v) => update((ch) => void (ch.background = v))} /></Field>
          <Field label="Bloodline"><Combo id={`bl-${c.id}`} value={c.bloodline} options={BLOODLINES.map((x) => x.name)} onChange={(v) => update((ch) => void (ch.bloodline = v))} /></Field>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Vitals" className="lg:col-span-1">
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-sm">
              <span>HP <b className="font-display text-xl">{c.hp}</b> / {c.maxHp}{c.tempHp > 0 && <span className="text-sky-300"> +{c.tempHp} temp</span>}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-ink">
              <div className="h-full bg-gradient-to-r from-blood to-emerald-600 transition-all" style={{ width: `${c.maxHp ? (c.hp / c.maxHp) * 100 : 0}%` }} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <NumberInput value={hpDelta} min={0} onChange={setHpDelta} className="w-20" />
              <Button size="sm" variant="danger" onClick={() => damage(hpDelta)}>Damage</Button>
              <Button size="sm" onClick={() => update((ch) => void (ch.hp = clamp(ch.hp + hpDelta, 0, ch.maxHp)))}>Heal</Button>
              <Button size="sm" variant="subtle" onClick={() => update((ch) => void (ch.tempHp = hpDelta))}>Temp</Button>
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1 flex justify-between text-sm">
              <span>Mana <b className="font-display text-xl text-violet-300">{c.mana}</b> / {c.maxMana}</span>
              <span className="flex gap-1">
                <Button size="sm" onClick={() => update((ch) => void (ch.mana = ch.mana - 1))}>−1</Button>
                <Button size="sm" onClick={() => update((ch) => void (ch.mana = Math.min(ch.maxMana, ch.mana + 1)))}>+1</Button>
                <Button size="sm" variant="subtle" onClick={() => update((ch) => void (ch.mana = ch.maxMana))}>Full</Button>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink">
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${c.maxMana ? clamp(c.mana / c.maxMana, 0, 1) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Max HP"><NumberInput value={c.maxHp} onChange={(n) => update((ch) => void (ch.maxHp = Math.max(1, n)))} /></Field>
            <Field label="AC"><NumberInput value={c.ac} onChange={(n) => update((ch) => void (ch.ac = n))} /></Field>
            <Field label="Speed"><NumberInput value={c.speed} onChange={(n) => update((ch) => void (ch.speed = n))} /></Field>
            <Field label="Max Mana"><NumberInput value={c.maxMana} onChange={(n) => update((ch) => void (ch.maxMana = Math.max(0, n)))} /></Field>
            <Field label="Prof."><div className="input text-center">{signed(pb)}</div></Field>
            <Field label="Init.">
              <Button className="w-full" onClick={() => d20(mod(c.abilities.dex), 'Initiative')}>{signed(mod(c.abilities.dex))}</Button>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="subtle" onClick={() => rollDice('1d20', 'Death save', c.name)}>Death save</Button>
            <Button size="sm" variant="subtle" onClick={() => update((ch) => { ch.hp = ch.maxHp; ch.mana = ch.maxMana; ch.tempHp = 0 })}>Long rest</Button>
          </div>
        </Card>

        <Card
          title="Abilities & saves"
          className="lg:col-span-2"
          actions={
            <div className="flex overflow-hidden rounded-md border border-edge text-xs">
              {(['dis', 'normal', 'adv'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setAdv(m)} className={`px-2 py-1 ${adv === m ? (m === 'adv' ? 'bg-emerald-700' : m === 'dis' ? 'bg-blood' : 'bg-edge') : ''}`}>
                  {m === 'normal' ? 'Normal' : m === 'adv' ? 'Adv' : 'Dis'}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ABILITIES.map((a) => (
              <AbilityBox key={a} a={a} c={c} onScore={(n) => update((ch) => void (ch.abilities[a] = n))} onCheck={() => d20(mod(c.abilities[a]), `${ABILITY_NAMES[a]} check`)} onSave={() => d20(saveBonus(c, a), `${ABILITY_NAMES[a]} save`)} onToggleSave={() => update((ch) => void (ch.saveProfs = ch.saveProfs.includes(a) ? ch.saveProfs.filter((x) => x !== a) : [...ch.saveProfs, a]))} />
            ))}
          </div>
          <div className="mt-4">
            <span className="label">Skills · click the dot for proficiency, the name to roll</span>
            <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              {SKILLS.map((s) => {
                const prof = c.skillProfs.includes(s.name)
                return (
                  <div key={s.name} className="flex items-center gap-2 py-0.5 text-sm">
                    <button
                      type="button"
                      aria-label={`Toggle ${s.name} proficiency`}
                      onClick={() => update((ch) => void (ch.skillProfs = prof ? ch.skillProfs.filter((x) => x !== s.name) : [...ch.skillProfs, s.name]))}
                      className={`h-3 w-3 rounded-full border ${prof ? 'border-gold bg-gold' : 'border-muted'}`}
                    />
                    <button type="button" className="flex-1 text-left hover:text-gold" onClick={() => d20(skillBonus(c, s.name), s.name)}>
                      {s.name} <span className="text-xs text-muted">{s.ability.toUpperCase()}</span>
                    </button>
                    <span className="font-mono text-gold">{signed(skillBonus(c, s.name))}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Spells" actions={<Badge>Attack/DC bonus {signed(spellMod)} · DC {8 + spellMod}</Badge>}>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-muted">Casting ability</span>
            <select className="input w-auto" value={c.spellAbility} onChange={(e) => update((ch) => void (ch.spellAbility = e.target.value as Ability))}>
              {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
            </select>
            <Button size="sm" variant="subtle" onClick={() => d20(spellMod, 'Spell attack')}>Spell attack</Button>
          </div>
          {spells.length === 0 ? (
            <p className="text-sm text-muted">No spells yet. The DM can forge some in the Spell Forge.</p>
          ) : (
            <ul className="space-y-2">
              {spells.map((sp) => (
                <li key={sp.id} className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-panel-2/60 px-3 py-2 text-sm">
                  <div>
                    <b>{sp.name}</b> <span className="text-xs text-muted">{sp.tier} · {sp.damage || 'no dice'} · {sp.manaCost} mana</span>
                    {sp.description && <p className="text-xs text-muted">{sp.description}</p>}
                  </div>
                  <Button size="sm" variant="primary" onClick={() => castSpell(sp.id)}>Cast</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Inventory">
          <Inventory owner={c.id} />
        </Card>

        <Card title="Features & notes">
          <div className="space-y-3">
            <Field label="Features & traits"><textarea className="input min-h-20" value={c.features} onChange={(e) => update((ch) => void (ch.features = e.target.value))} /></Field>
            <Field label="Notes"><textarea className="input min-h-16" value={c.notes} onChange={(e) => update((ch) => void (ch.notes = e.target.value))} /></Field>
          </div>
        </Card>
      </div>

      {c.tarot.length > 0 && (
        <Card title="Tarot of Fate">
          <div className="grid gap-3 md:grid-cols-3">
            {c.tarot.map((t) => <TarotCardView key={t.position} draw={t} />)}
          </div>
        </Card>
      )}
    </div>
  )
}

function AbilityBox({ a, c, onScore, onCheck, onSave, onToggleSave }: { a: Ability; c: Character; onScore: (n: number) => void; onCheck: () => void; onSave: () => void; onToggleSave: () => void }) {
  const prof = c.saveProfs.includes(a)
  return (
    <div className="rounded-lg border border-edge bg-panel-2/60 p-2 text-center">
      <div className="text-xs uppercase tracking-wider text-muted">{ABILITY_NAMES[a]}</div>
      <button type="button" onClick={onCheck} className="font-display text-3xl text-gold hover:scale-110" title="Roll check">
        {signed(mod(c.abilities[a]))}
      </button>
      <input type="number" className="input mx-auto mt-1 w-16 py-0.5 text-center" value={c.abilities[a]} onChange={(e) => onScore(Number(e.target.value) || 0)} />
      <div className="mt-1 flex items-center justify-center gap-1 text-xs">
        <button type="button" onClick={onToggleSave} aria-label="Toggle save proficiency" className={`h-3 w-3 rounded-full border ${prof ? 'border-gold bg-gold' : 'border-muted'}`} />
        <button type="button" onClick={onSave} className="hover:text-gold">Save {signed(saveBonus(c, a))}</button>
      </div>
    </div>
  )
}
