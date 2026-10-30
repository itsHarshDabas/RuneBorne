import { Dices, Lock, Sparkles, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, Combo, Field } from '../../components/ui'
import { BLOODLINES, TAROT, TAROT_POSITIONS } from '../../data/homebrew'
import {
  ABILITIES, ABILITY_NAMES, BACKGROUNDS, CLASSES, findBackground, findClass, findSpecies, POINT_BUY_BUDGET, POINT_BUY_COST,
  SKILLS, SPECIES, STANDARD_ARRAY, type Ability,
} from '../../data/srd'
import { newCharacter, PLAYER_COLORS, startingHp, startingMana, baseAbilities } from '../../lib/character'
import { mod, rollDie, signed } from '../../lib/dice'
import { useGame, type Abilities, type TarotDraw } from '../../store/game'

type Method = 'roll' | 'pointbuy' | 'array' | 'manual'
const METHODS: { id: Method; label: string }[] = [
  { id: 'roll', label: 'Roll 4d6 (drop lowest)' },
  { id: 'pointbuy', label: `Point buy (${POINT_BUY_BUDGET})` },
  { id: 'array', label: 'Standard array' },
  { id: 'manual', label: 'Type them in' },
]

function pointsSpent(a: Abilities) {
  return ABILITIES.reduce((sum, k) => sum + (POINT_BUY_COST[a[k]] ?? 0), 0)
}

export function CharacterCreator({ onDone }: { onDone: (id: string | null) => void }) {
  const settings = useGame((s) => s.settings)
  const existing = useGame((s) => s.characters.length)
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)

  const [name, setName] = useState('')
  const [player, setPlayer] = useState('')
  const [method, setMethod] = useState<Method>('roll')
  const [base, setBase] = useState<Abilities>(baseAbilities(10))
  const [rolled, setRolled] = useState(false)
  const [rerolls, setRerolls] = useState(settings.statRerolls)
  const [swapFrom, setSwapFrom] = useState<Ability | null>(null)
  const [className, setClassName] = useState('')
  const [species, setSpecies] = useState('')
  const [background, setBackground] = useState('')
  const [bloodline, setBloodline] = useState('None')
  const [bonusMode, setBonusMode] = useState<'2-1' | '1-1-1'>('2-1')
  const [plus2, setPlus2] = useState<Ability | ''>('')
  const [plus1, setPlus1] = useState<Ability | ''>('')
  const [skills, setSkills] = useState<string[]>([])
  const [tarot, setTarot] = useState<TarotDraw[]>([])
  const [redraws, setRedraws] = useState(settings.tarotRedraws)

  const who = name || 'New hero'
  const cls = findClass(className)
  const bg = findBackground(background)
  const bgAbilities: readonly Ability[] = bg?.abilities ?? ABILITIES
  const bgSkills = bg?.skills ?? []

  const bonus: Partial<Record<Ability, number>> = {}
  if (bonusMode === '1-1-1') for (const a of bgAbilities.slice(0, 3)) bonus[a] = 1
  else {
    if (plus2) bonus[plus2] = 2
    if (plus1 && plus1 !== plus2) bonus[plus1] = (bonus[plus1] ?? 0) + 1
  }
  const finalScores = Object.fromEntries(ABILITIES.map((a) => [a, Math.min(20, base[a] + (bonus[a] ?? 0))])) as Abilities

  function chooseMethod(m: Method) {
    setMethod(m)
    setSwapFrom(null)
    setRolled(false)
    if (m === 'pointbuy') setBase(baseAbilities(8))
    else if (m === 'array') setBase(Object.fromEntries(ABILITIES.map((a, i) => [a, STANDARD_ARRAY[i]])) as Abilities)
    else setBase(baseAbilities(10))
  }

  function rollStat(a: Ability) {
    return rollDice('4d6dl1', `${ABILITY_NAMES[a]} stat roll`, who).total
  }

  function rollAll() {
    if (rolled) {
      if (rerolls <= 0) return
      setRerolls((r) => r - 1)
    }
    setBase(Object.fromEntries(ABILITIES.map((a) => [a, rollStat(a)])) as Abilities)
    setRolled(true)
  }

  function rerollOne(a: Ability) {
    if (rerolls <= 0) return
    setRerolls((r) => r - 1)
    setBase((b) => ({ ...b, [a]: rollStat(a) }))
  }

  function clickAbility(a: Ability) {
    if (method === 'pointbuy' || method === 'manual') return
    if (!swapFrom) return setSwapFrom(a)
    if (swapFrom !== a) setBase((b) => ({ ...b, [swapFrom]: b[a], [a]: b[swapFrom] }))
    setSwapFrom(null)
  }

  function adjustPointBuy(a: Ability, delta: number) {
    const next = base[a] + delta
    if (next < 8 || next > 15) return
    const trial = { ...base, [a]: next }
    if (pointsSpent(trial) > POINT_BUY_BUDGET) return
    setBase(trial)
  }

  function drawCard(exclude: string[]): TarotDraw['card'] {
    const pool = TAROT.filter((t) => !exclude.includes(t.name))
    return pool[rollDie(pool.length) - 1].name
  }

  function drawTarot() {
    const picked: string[] = []
    const draws = TAROT_POSITIONS.map((position) => {
      const card = drawCard(picked)
      picked.push(card)
      return { card, position, reversed: rollDie(2) === 1 }
    })
    setTarot(draws)
  }

  function redrawCard(i: number) {
    if (redraws <= 0) return
    setRedraws((r) => r - 1)
    setTarot((t) => t.map((d, j) => (j === i ? { ...d, card: drawCard(t.map((x) => x.card)), reversed: rollDie(2) === 1 } : d)))
  }

  function rollBloodline() {
    const r = rollDice(`1d${BLOODLINES.length}`, 'Bloodline roll', who)
    setBloodline(BLOODLINES[r.total - 1].name)
  }

  function toggleSkill(s: string) {
    if (bgSkills.includes(s)) return
    setSkills((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]))
  }

  function create() {
    const hp = startingHp(className, finalScores.con)
    const c = newCharacter({
      name: name.trim() || 'Unnamed Hero',
      player: player.trim(),
      className: className.trim(),
      species: species.trim(),
      background: background.trim(),
      bloodline,
      abilities: finalScores,
      saveProfs: cls?.saves ?? [],
      skillProfs: [...new Set([...bgSkills, ...skills])],
      maxHp: hp,
      hp,
      ac: 10 + mod(finalScores.dex),
      speed: findSpecies(species)?.speed ?? 30,
      maxMana: startingMana(className, finalScores, bloodline),
      mana: startingMana(className, finalScores, bloodline),
      spellAbility: cls?.spellAbility ?? 'int',
      tarot,
      features: [
        findSpecies(species) && `Species traits: ${findSpecies(species)!.traits.join(', ')}`,
        bg && `Background feat: ${bg.feat}`,
        bloodline !== 'None' && (() => {
          const b = BLOODLINES.find((x) => x.name === bloodline)
          return b ? `Bloodline (${b.name}): ${b.boon} Drawback: ${b.bane}` : `Bloodline: ${bloodline}`
        })(),
      ].filter(Boolean).join('\n'),
      color: PLAYER_COLORS[existing % PLAYER_COLORS.length],
    })
    edit((d) => {
      d.characters.push(c)
      d.activeCharacterId = c.id
    })
    onDone(c.id)
  }

  const spent = pointsSpent(base)
  const skillOptions = cls?.skillOptions === 'any' || !cls ? SKILLS.map((s) => s.name) : cls.skillOptions
  const bloodlineInfo = BLOODLINES.find((b) => b.name === bloodline)

  return (
    <div className="space-y-4">
      <Card title="1 · Who are you?" actions={<Button onClick={() => onDone(null)}>Cancel</Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Character name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Thorin Ashdown" />
          </Field>
          <Field label="Player">
            <input className="input" value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Your brother" />
          </Field>
        </div>
      </Card>

      <Card title="2 · Ability scores">
        <div className="mb-3 flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <Button key={m.id} variant={method === m.id ? 'primary' : 'ghost'} size="sm" onClick={() => chooseMethod(m.id)}>
              {m.label}
            </Button>
          ))}
        </div>
        {method === 'roll' && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Button variant="primary" onClick={rollAll} disabled={rolled && rerolls <= 0}>
              {rolled ? 'Reroll everything (costs 1)' : 'Roll all six'}
            </Button>
            <Badge>Rerolls left: {rerolls}</Badge>
            <Button size="sm" variant="subtle" onClick={() => setRerolls((r) => r + 1)} title="The DM is generous today">
              DM: +1 reroll
            </Button>
          </div>
        )}
        {method === 'pointbuy' && (
          <p className="mb-3 text-sm">
            Points spent: <b className={spent > POINT_BUY_BUDGET ? 'text-red-400' : 'text-gold'}>{spent}</b> / {POINT_BUY_BUDGET}
          </p>
        )}
        {(method === 'roll' || method === 'array') && <p className="mb-3 text-xs text-muted">Tip: click one ability, then another, to swap their scores.</p>}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ABILITIES.map((a) => (
            <div
              key={a}
              onClick={() => clickAbility(a)}
              className={`rounded-lg border p-2 text-center ${swapFrom === a ? 'border-gold bg-gold/10' : 'border-edge bg-panel-2/60'} ${
                method === 'roll' || method === 'array' ? 'cursor-pointer hover:border-gold/60' : ''
              }`}
            >
              <div className="text-xs uppercase tracking-wider text-muted">{ABILITY_NAMES[a]}</div>
              {method === 'manual' ? (
                <input
                  type="number"
                  className="input mt-1 text-center"
                  value={base[a]}
                  onChange={(e) => setBase((b) => ({ ...b, [a]: Number(e.target.value) || 0 }))}
                />
              ) : (
                <div className="font-display text-3xl">{base[a]}</div>
              )}
              {bonus[a] ? <div className="text-xs text-emerald-300">+{bonus[a]} background → {finalScores[a]}</div> : <div className="text-xs">&nbsp;</div>}
              <div className="text-sm text-gold">{signed(mod(finalScores[a]))}</div>
              {method === 'pointbuy' && (
                <div className="mt-1 flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => adjustPointBuy(a, -1)}>−</Button>
                  <Button size="sm" onClick={() => adjustPointBuy(a, 1)}>+</Button>
                </div>
              )}
              {method === 'roll' && rolled && (
                <Button size="sm" variant="subtle" className="mt-1" disabled={rerolls <= 0} onClick={(e) => (e.stopPropagation(), rerollOne(a))}>
                  Reroll
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="3 · Class, species, background, bloodline">
        <p className="mb-3 text-xs text-muted">Pick from the list or type anything you like for homebrew.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Class">
            <Combo id="cc-class" value={className} onChange={setClassName} options={CLASSES.map((c) => c.name)} />
            {cls && <p className="mt-1 text-xs text-muted">d{cls.hitDie} hit die · saves {cls.saves.join(', ').toUpperCase()}</p>}
          </Field>
          <Field label="Species">
            <Combo id="cc-species" value={species} onChange={setSpecies} options={SPECIES.map((s) => s.name)} />
            {findSpecies(species) && <p className="mt-1 text-xs text-muted">{findSpecies(species)!.traits.join(' · ')}</p>}
          </Field>
          <Field label="Background">
            <Combo id="cc-bg" value={background} onChange={setBackground} options={BACKGROUNDS.map((b) => b.name)} />
            {bg && <p className="mt-1 text-xs text-muted">Feat: {bg.feat} · Skills: {bg.skills.join(', ')}</p>}
          </Field>
          <Field label="Bloodline">
            <div className="flex gap-2">
              <Combo id="cc-blood" value={bloodline} onChange={setBloodline} options={BLOODLINES.map((b) => b.name)} />
              <Button size="sm" onClick={rollBloodline} title="Let fate decide" aria-label="Roll bloodline" icon={Dices} />
            </div>
          </Field>
        </div>
        {bloodlineInfo && bloodlineInfo.name !== 'None' && (
          <div className="mt-3 rounded-lg border border-edge bg-panel-2/60 p-3 text-sm">
            <i className="text-muted">{bloodlineInfo.flavor}</i>
            <p className="mt-1"><b className="text-emerald-300">Boon:</b> {bloodlineInfo.boon}</p>
            <p><b className="text-red-300">Bane:</b> {bloodlineInfo.bane}</p>
          </div>
        )}

        <div className="mt-4 border-t border-edge pt-3">
          <span className="label">Background ability bonus {bg ? `(${bg.abilities.join(', ').toUpperCase()})` : '(any)'}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={bonusMode === '2-1' ? 'primary' : 'ghost'} onClick={() => setBonusMode('2-1')}>+2 / +1</Button>
            <Button size="sm" variant={bonusMode === '1-1-1' ? 'primary' : 'ghost'} onClick={() => setBonusMode('1-1-1')} disabled={!bg}>
              +1 / +1 / +1
            </Button>
            {bonusMode === '2-1' && (
              <>
                <select className="input w-auto" value={plus2} onChange={(e) => setPlus2(e.target.value as Ability)}>
                  <option value="">+2 to…</option>
                  {bgAbilities.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
                </select>
                <select className="input w-auto" value={plus1} onChange={(e) => setPlus1(e.target.value as Ability)}>
                  <option value="">+1 to…</option>
                  {bgAbilities.filter((a) => a !== plus2).map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card title="4 · Skills">
        <p className="mb-2 text-sm text-muted">
          {cls ? `${cls.name}s usually pick ${cls.skillCount}.` : 'Pick whatever the DM allows.'} Highlighted skills are your class options; background skills are locked in. Picked:{' '}
          <b className="text-gold">{skills.length}</b>
        </p>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => {
            const fromBg = bgSkills.includes(s.name)
            const on = fromBg || skills.includes(s.name)
            const suggested = skillOptions.includes(s.name)
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => toggleSkill(s.name)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  on ? 'border-gold bg-gold/20 text-gold' : suggested ? 'border-edge text-parch hover:border-gold/60' : 'border-edge/50 text-muted hover:border-edge'
                } ${fromBg ? 'cursor-default' : ''}`}
              >
                {s.name} <span className="text-xs opacity-60">{s.ability.toUpperCase()}</span>
                {fromBg && <Lock size={11} className="ml-1 inline" />}
              </button>
            )
          })}
        </div>
      </Card>

      <Card title="5 · Tarot of Fate" actions={<Badge>Redraws left: {redraws}</Badge>}>
        <p className="mb-3 text-sm text-muted">Draw three cards: where you came from, what you were given, and where you are headed. Reversed cards twist the meaning.</p>
        {tarot.length === 0 ? (
          <Button variant="primary" onClick={drawTarot} icon={Sparkles}>Draw the cards</Button>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {tarot.map((t, i) => (
              <TarotCardView key={t.position} draw={t} onRedraw={redraws > 0 ? () => redrawCard(i) : undefined} />
            ))}
          </div>
        )}
      </Card>

      <Card title="6 · Forge the hero">
        <p className="mb-3 text-sm text-muted">
          Starting HP {startingHp(className, finalScores.con)} · AC {10 + mod(finalScores.dex)} · Mana {startingMana(className, finalScores, bloodline)}. You can change anything later on the sheet.
        </p>
        <Button variant="primary" onClick={create} icon={UserPlus}>Create character</Button>
      </Card>
    </div>
  )
}

export function TarotCardView({ draw, onRedraw }: { draw: TarotDraw; onRedraw?: () => void }) {
  const card = TAROT.find((t) => t.name === draw.card)
  return (
    <div className="tumble rounded-xl border border-gold/40 bg-gradient-to-b from-violet-950/60 to-panel-2 p-3 text-center">
      <div className="text-xs uppercase tracking-widest text-muted">{draw.position}</div>
      <div className={`my-2 font-display text-xl text-gold ${draw.reversed ? 'rotate-180' : ''}`}>{card?.numeral}</div>
      <div className="font-display text-lg">{draw.card}</div>
      <Badge className={draw.reversed ? 'border-red-400/50 text-red-300' : 'border-emerald-400/50 text-emerald-300'}>{draw.reversed ? 'Reversed' : 'Upright'}</Badge>
      <p className="mt-2 text-sm">{card ? (draw.reversed ? card.reversed : card.upright) : ''}</p>
      {onRedraw && (
        <Button size="sm" variant="subtle" className="mt-2" onClick={onRedraw}>Redraw</Button>
      )}
    </div>
  )
}
