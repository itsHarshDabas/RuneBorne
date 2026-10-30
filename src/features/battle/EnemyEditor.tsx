import { Dices, Plus, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Combo, Field, Modal, NumberInput } from '../../components/ui'
import { averageHp, CR_VALUES, CREATURE_TYPES, quickBuild } from '../../data/monsters'
import { ABILITIES, ABILITY_NAMES } from '../../data/srd'
import { averageRoll, mod, roll, signed } from '../../lib/dice'
import { uid } from '../../lib/util'
import { CREATURE_SIZES, type CreatureSize, type Monster } from '../../store/game'
import { TOKEN_COLORS, TOKEN_ICONS } from './icons'

/** Full stat-block editor for a custom enemy. */
export function EnemyEditor({ initial, onSave, onClose }: { initial: Monster; onSave: (m: Monster) => void; onClose: () => void }) {
  const [m, setM] = useState<Monster>(initial)
  const set = <K extends keyof Monster>(k: K, v: Monster[K]) => setM((x) => ({ ...x, [k]: v }))
  const hpAvg = averageRoll(m.hp)
  const Icon = TOKEN_ICONS[m.icon]

  return (
    <Modal
      wide
      title={initial.name === 'New enemy' ? 'Create an enemy' : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!m.name.trim()} onClick={() => onSave({ ...m, name: m.name.trim() })}>Save enemy</Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Name" className="col-span-2"><input className="input" value={m.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
            <Field label="Size">
              <select className="input" value={m.size} onChange={(e) => set('size', e.target.value as CreatureSize)}>
                {CREATURE_SIZES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Challenge">
              <select className="input" value={m.cr} onChange={(e) => set('cr', e.target.value)}>
                {CR_VALUES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <div className="col-span-2 sm:col-span-4">
              <span className="label">Type</span>
              <Combo id="enemy-type" value={m.type} onChange={(v) => set('type', v)} options={CREATURE_TYPES} />
            </div>
            <Field label="Armor Class"><NumberInput value={m.ac} min={1} max={30} onChange={(v) => set('ac', v)} /></Field>
            <Field label="Hit points (dice or number)" className="col-span-2">
              <div className="flex gap-2">
                <input className="input font-mono" value={m.hp} onChange={(e) => set('hp', e.target.value)} placeholder="2d8+2" />
                <span className="self-center whitespace-nowrap text-xs text-muted">{hpAvg !== null ? `avg ${hpAvg}` : Number(m.hp) ? '' : 'check this'}</span>
              </div>
            </Field>
            <Field label="Initiative"><NumberInput value={m.initBonus} onChange={(v) => set('initBonus', v)} /></Field>
            <Field label="Speed" className="col-span-2 sm:col-span-4"><input className="input" value={m.speed} onChange={(e) => set('speed', e.target.value)} /></Field>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="label mb-0">Ability scores</span>
              <Button
                size="sm"
                variant="subtle"
                icon={Dices}
                onClick={() => {
                  const abilities = Object.fromEntries(ABILITIES.map((a) => [a, roll('4d6dl1').total])) as Monster['abilities']
                  setM((x) => ({ ...x, abilities, initBonus: mod(abilities.dex) }))
                }}
              >
                Roll 4d6
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ABILITIES.map((a) => (
                <label key={a} className="rounded-md border border-edge bg-ink/40 p-1.5 text-center">
                  <span className="block text-[10px] uppercase tracking-wider text-muted">{ABILITY_NAMES[a].slice(0, 3)}</span>
                  <input
                    type="number"
                    className="w-full bg-transparent text-center font-display text-lg outline-none"
                    value={m.abilities[a]}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0
                      setM((x) => ({ ...x, abilities: { ...x.abilities, [a]: v }, initBonus: a === 'dex' ? mod(v) : x.initBonus }))
                    }}
                  />
                  <span className="text-xs text-muted">{signed(mod(m.abilities[a]))}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="label mb-0">Attacks and actions</span>
              <Button size="sm" variant="subtle" icon={Plus} onClick={() => set('attacks', [...m.attacks, { id: uid(), name: 'Attack', bonus: 3, damage: '1d6+1', notes: '' }])}>Add</Button>
            </div>
            <div className="space-y-2">
              {m.attacks.map((a, i) => {
                const patch = (p: Partial<typeof a>) => set('attacks', m.attacks.map((x, j) => (j === i ? { ...x, ...p } : x)))
                return (
                  <div key={a.id} className="grid grid-cols-[1fr_70px_100px_auto] gap-2 rounded-md border border-edge bg-ink/30 p-2">
                    <input className="input" value={a.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Name" aria-label="Attack name" />
                    <NumberInput value={a.bonus} onChange={(bonus) => patch({ bonus })} />
                    <input className="input font-mono" value={a.damage} onChange={(e) => patch({ damage: e.target.value })} placeholder="1d6+2" aria-label="Damage" />
                    <button type="button" className="px-1 text-muted hover:text-red-400" aria-label="Remove attack" onClick={() => set('attacks', m.attacks.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </button>
                    <input className="input col-span-4 text-xs" value={a.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Damage type, reach/range, saving throws, effects…" />
                  </div>
                )
              })}
            </div>
          </div>

          <Field label="Traits, spells and special abilities">
            <textarea className="input min-h-20" value={m.traits} onChange={(e) => set('traits', e.target.value)} placeholder="Pack Tactics, resistances, legendary actions, lair actions…" />
          </Field>
        </div>

        <aside className="space-y-3">
          <div className="flex flex-col items-center rounded-lg border border-edge bg-ink/40 p-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-red-500 shadow-lg shadow-black/60" style={{ background: m.color }}>
              {Icon && <Icon size={38} color="#fff" />}
            </div>
            <div className="mt-2 font-display text-gold">{m.name || 'Unnamed'}</div>
            <div className="text-xs text-muted">{m.size} {m.type.toLowerCase()} · CR {m.cr}</div>
            <div className="mt-1 text-xs">AC {m.ac} · HP {averageHp(m)} · {m.speed}</div>
          </div>
          <div>
            <span className="label">Token colour</span>
            <div className="flex flex-wrap gap-1.5">
              {TOKEN_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => set('color', c)} className={`h-6 w-6 rounded-full border-2 ${m.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <span className="label">Token icon</span>
            <div className="grid grid-cols-6 gap-1">
              {Object.entries(TOKEN_ICONS).map(([name, I]) => (
                <button key={name} type="button" title={name} aria-label={name} onClick={() => set('icon', name)} className={`flex aspect-square items-center justify-center rounded-md border ${m.icon === name ? 'border-gold bg-gold/20 text-gold' : 'border-edge text-muted hover:text-parch'}`}>
                  <I size={16} />
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" icon={Wand2} onClick={() => setM((x) => quickBuild(x, x.cr))} title="Sets AC, HP and attack numbers that roughly fit the chosen challenge rating">
            Quick-build for CR {m.cr}
          </Button>
          <p className="text-xs text-muted">Quick-build is a RuneBorne rule of thumb. Tweak anything after.</p>
        </aside>
      </div>
    </Modal>
  )
}
