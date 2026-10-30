import { Dices, Plus, Swords } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, Combo, Empty, Field, NumberInput } from '../components/ui'
import { ATTITUDES, FIRST_NAMES, LAST_NAMES, NPC_ROLES, NPC_SECRETS, NPC_TRAITS, NPC_WANTS, reactionShift, type Attitude } from '../data/homebrew'
import { SPECIES } from '../data/srd'
import { skillBonus } from '../lib/character'
import { mod, signed } from '../lib/dice'
import { clamp, pick, uid } from '../lib/util'
import { useGame, type Npc } from '../store/game'
import { useUi } from '../store/ui'

const ATTITUDE_COLORS: Record<Attitude, string> = {
  Hostile: 'bg-red-700',
  Unfriendly: 'bg-orange-700',
  Indifferent: 'bg-stone-600',
  Friendly: 'bg-emerald-700',
  Helpful: 'bg-sky-600',
}

/** RuneBorne homebrew: how hard it is to sway an NPC depends on how they feel about you. */
const ATTITUDE_DC: Record<Attitude, number> = { Hostile: 20, Unfriendly: 15, Indifferent: 12, Friendly: 8, Helpful: 5 }

const SOCIAL = ['Persuasion', 'Deception', 'Intimidation', 'Insight', 'Performance'] as const

function randomNpc(): Npc {
  return {
    id: uid(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    role: pick(NPC_ROLES),
    species: pick(SPECIES).name,
    attitude: 'Indifferent',
    chaMod: Math.floor(Math.random() * 5) - 1,
    trait: pick(NPC_TRAITS),
    want: pick(NPC_WANTS),
    secret: pick(NPC_SECRETS),
    notes: '',
    hp: 10,
    ac: 11,
    log: [],
  }
}

function shiftAttitude(a: Attitude, by: number): Attitude {
  return ATTITUDES[clamp(ATTITUDES.indexOf(a) + by, 0, ATTITUDES.length - 1)]
}

export function Npcs() {
  const npcs = useGame((s) => s.npcs)
  const characters = useGame((s) => s.characters)
  const edit = useGame((s) => s.edit)
  const setTab = useUi((s) => s.setTab)
  const [selectedId, setSelectedId] = useState<string | null>(npcs[0]?.id ?? null)
  const [filter, setFilter] = useState('')

  const npc = npcs.find((n) => n.id === selectedId)
  const shown = npcs.filter((n) => `${n.name} ${n.role}`.toLowerCase().includes(filter.toLowerCase()))

  function add(n: Npc) {
    edit((d) => void d.npcs.unshift(n))
    setSelectedId(n.id)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card title="NPCs">
        <div className="mb-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={() => add(randomNpc())} icon={Dices}>Random NPC</Button>
          <Button size="sm" onClick={() => add({ ...randomNpc(), name: 'New NPC', trait: '', want: '', secret: '' })} icon={Plus}>Blank</Button>
        </div>
        <input className="input mb-2" placeholder="Search…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
          {shown.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setSelectedId(n.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${n.id === selectedId ? 'bg-gold/15 text-gold' : 'hover:bg-panel-2'}`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ATTITUDE_COLORS[n.attitude]}`} title={n.attitude} />
                <span className="truncate">{n.name}</span>
                <span className="ml-auto truncate text-xs text-muted">{n.role}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {npc ? (
        <NpcDetail
          key={npc.id}
          npc={npc}
          characters={characters}
          onDelete={() => {
            edit((d) => void (d.npcs = d.npcs.filter((x) => x.id !== npc.id)))
            setSelectedId(null)
          }}
          onFight={() => {
            edit((d) =>
              void d.combat.combatants.push({ id: uid(), name: npc.name, initBonus: 0, init: null, hp: npc.hp, maxHp: npc.hp, ac: npc.ac, conditions: [], side: npc.attitude === 'Hostile' ? 'foe' : 'ally', refId: npc.id }),
            )
            setTab('Combat')
          }}
        />
      ) : (
        <Empty>Pick an NPC or roll a random one. Every innkeeper deserves a dark secret.</Empty>
      )}
    </div>
  )
}

function NpcDetail({ npc, characters, onDelete, onFight }: { npc: Npc; characters: ReturnType<typeof useGame.getState>['characters']; onDelete: () => void; onFight: () => void }) {
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)
  const [pcId, setPcId] = useState(characters[0]?.id ?? '')
  const [skill, setSkill] = useState<(typeof SOCIAL)[number]>('Persuasion')
  const [dcOverride, setDcOverride] = useState<number | null>(null)
  const [logText, setLogText] = useState('')

  const pc = characters.find((c) => c.id === pcId) ?? characters[0]
  const dc = dcOverride ?? ATTITUDE_DC[npc.attitude]

  const update = (fn: (n: Npc) => void) =>
    edit((d) => {
      const n = d.npcs.find((x) => x.id === npc.id)
      if (n) fn(n)
    })
  const log = (text: string) => update((n) => void n.log.unshift({ id: uid(), text, time: Date.now() }))

  function reactionRoll() {
    const chaMod = pc ? mod(pc.abilities.cha) : 0
    const r = rollDice(`2d6${signed(chaMod)}`, `${npc.name} reaction`, pc?.name ?? 'DM')
    const { shift, text } = reactionShift(r.total)
    const next = shiftAttitude(npc.attitude, shift)
    update((n) => void (n.attitude = next))
    log(`First impression (${r.total}): ${text}. Now ${next}.`)
  }

  function socialCheck() {
    if (!pc) return
    const r = rollDice(`1d20${signed(skillBonus(pc, skill))}`, `${skill} vs ${npc.name} (DC ${dc})`, pc.name)
    const margin = r.total - dc
    let outcome: string
    let shift = 0
    if (r.crit === 'hit' || margin >= 10) {
      outcome = 'Overwhelming success'
      shift = skill === 'Intimidation' ? -1 : skill === 'Insight' ? 0 : 1
    } else if (margin >= 0) {
      outcome = 'Success'
      shift = skill === 'Persuasion' || skill === 'Performance' ? 1 : 0
    } else if (margin <= -5 || r.crit === 'miss') {
      outcome = 'Bad failure'
      shift = -1
    } else {
      outcome = 'Failure'
    }
    const next = shiftAttitude(npc.attitude, shift)
    update((n) => void (n.attitude = next))
    log(`${pc.name} used ${skill}: ${r.total} vs DC ${dc}. ${outcome}${shift ? `, attitude now ${next}` : ''}.`)
  }

  return (
    <div className="space-y-4">
      <Card
        title={<input className="w-full bg-transparent font-display text-xl text-gold outline-none" value={npc.name} onChange={(e) => update((n) => void (n.name = e.target.value))} />}
        actions={
          <>
            <Button size="sm" onClick={onFight} icon={Swords}>Add to combat</Button>
            <Button size="sm" variant="danger" onClick={() => confirm(`Delete ${npc.name}?`) && onDelete()}>Delete</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Role"><Combo id={`role-${npc.id}`} value={npc.role} options={NPC_ROLES} onChange={(v) => update((n) => void (n.role = v))} /></Field>
          <Field label="Species"><Combo id={`nsp-${npc.id}`} value={npc.species} options={SPECIES.map((s) => s.name)} onChange={(v) => update((n) => void (n.species = v))} /></Field>
          <Field label="CHA mod"><NumberInput value={npc.chaMod} onChange={(v) => update((n) => void (n.chaMod = v))} /></Field>
          <Field label="HP"><NumberInput value={npc.hp} onChange={(v) => update((n) => void (n.hp = v))} /></Field>
          <Field label="AC"><NumberInput value={npc.ac} onChange={(v) => update((n) => void (n.ac = v))} /></Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Personality"><input className="input" value={npc.trait} onChange={(e) => update((n) => void (n.trait = e.target.value))} /></Field>
          <Field label="Wants"><input className="input" value={npc.want} onChange={(e) => update((n) => void (n.want = e.target.value))} /></Field>
          <Field label="Secret (DM only)"><input className="input" value={npc.secret} onChange={(e) => update((n) => void (n.secret = e.target.value))} /></Field>
        </div>
        <Field label="Notes" className="mt-3"><textarea className="input min-h-16" value={npc.notes} onChange={(e) => update((n) => void (n.notes = e.target.value))} /></Field>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Interaction">
          <span className="label">Attitude toward the party</span>
          <div className="mb-4 flex overflow-hidden rounded-md border border-edge">
            {ATTITUDES.map((a) => (
              <button key={a} type="button" onClick={() => update((n) => void (n.attitude = a))} className={`flex-1 px-1 py-1.5 text-xs sm:text-sm ${npc.attitude === a ? ATTITUDE_COLORS[a] : 'hover:bg-panel-2'}`}>
                {a}
              </button>
            ))}
          </div>

          {characters.length === 0 ? (
            <p className="text-sm text-muted">Create a character to roll social checks.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Character">
                  <select className="input" value={pc?.id} onChange={(e) => setPcId(e.target.value)}>
                    {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Approach">
                  <select className="input" value={skill} onChange={(e) => setSkill(e.target.value as (typeof SOCIAL)[number])}>
                    {SOCIAL.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={`DC (${npc.attitude} = ${ATTITUDE_DC[npc.attitude]})`} className="w-36">
                  <NumberInput value={dc} onChange={setDcOverride} />
                </Field>
                <Button variant="primary" onClick={socialCheck} icon={Dices}>Roll {skill}</Button>
                <Button onClick={reactionRoll} title="2d6 + CHA mod, for first meetings">First impression</Button>
              </div>
            </div>
          )}
        </Card>

        <Card title="Interaction log">
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!logText.trim()) return
              log(logText.trim())
              setLogText('')
            }}
          >
            <input className="input" placeholder="What happened? e.g. Paid 5gp for a rumour" value={logText} onChange={(e) => setLogText(e.target.value)} />
            <Button type="submit">Add</Button>
          </form>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
            {npc.log.length === 0 && <li className="text-muted">Nothing yet.</li>}
            {npc.log.map((l) => (
              <li key={l.id} className="rounded border border-edge bg-panel-2/60 px-2 py-1">
                <Badge className="mr-2">{new Date(l.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Badge>
                {l.text}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
