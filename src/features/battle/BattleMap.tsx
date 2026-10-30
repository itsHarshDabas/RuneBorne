import { ChevronLeft, ChevronRight, Copy, Dices, ImagePlus, Pencil, Plus, Shuffle, Swords, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Empty, Field, NumberInput } from '../../components/ui'
import { averageHp, blankMonster } from '../../data/monsters'
import { CONDITIONS } from '../../data/srd'
import { rollExprWithBonus, signed, type Advantage } from '../../lib/dice'
import { dialog } from '../../lib/dialog'
import { nextTurn, removeToken, rollAttack, setHp, spawnMonster, spawnParty } from '../../lib/combat'
import { clamp, fileToCompressedDataUrl, uid } from '../../lib/util'
import { useGame, type GameData, type MapBoard, type Monster, type TokenSide } from '../../store/game'
import { BattleBoard, type TokenView } from './BattleBoard'
import { EnemyEditor } from './EnemyEditor'
import { POI_LABEL, type PoiType } from '../atlas/pois'
import { BATTLE_PRESETS, BATTLE_SIZES, battleMapImage } from './generate'
import { TOKEN_COLORS, TOKEN_ICONS } from './icons'

/** Paints generated maps off the main render so the UI can show "Painting…" first. */
function useBattleImage(map: MapBoard) {
  const key = map.gen ? `${map.gen.preset}|${map.gen.seed}|${map.cols}|${map.rows}` : ''
  const [done, setDone] = useState({ key: '', url: '' })
  useEffect(() => {
    if (!map.gen) return
    const gen = map.gen
    const id = setTimeout(() => setDone({ key, url: battleMapImage(gen.preset, gen.seed, map.cols, map.rows) }), 30)
    return () => clearTimeout(id)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!map.gen) return { url: map.image, painting: false }
  return { url: done.url, painting: done.key !== key }
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not load that image'))
    img.src = src
  })
}

export function BattleMap() {
  const map = useGame((s) => s.map)
  const combat = useGame((s) => s.combat)
  const characters = useGame((s) => s.characters)
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Monster | null>(null)
  const { url, painting } = useBattleImage(map)

  const current = combat.combatants[combat.turn]
  const views: TokenView[] = useMemo(
    () =>
      map.tokens.map((t) => {
        const c = combat.combatants.find((x) => x.id === t.combatantId)
        const pc = characters.find((x) => x.id === t.refId)
        return {
          ...t,
          label: c?.name ?? pc?.name ?? t.label,
          hp: c?.hp ?? pc?.hp,
          maxHp: c?.maxHp ?? pc?.maxHp,
          conditions: c?.conditions ?? [],
          active: Boolean(c && current?.id === c.id && combat.combatants.some((x) => x.init !== null)),
        }
      }),
    [map.tokens, combat, characters, current],
  )
  const selected = views.find((t) => t.id === selectedId)

  function saveMonster(m: Monster) {
    edit((d) => {
      const i = d.bestiary.findIndex((x) => x.id === m.id)
      if (i >= 0) d.bestiary[i] = m
      else d.bestiary.unshift(m)
      // Keep tokens already on the map in step with the new look
      for (const t of d.map.tokens) {
        if (t.monsterId !== m.id) continue
        t.color = m.color
        t.icon = m.icon
      }
    })
    setEditing(null)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-2">
        {combat.combatants.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-panel/90 px-3 py-2 text-sm">
            <span className="font-display text-gold">Round {combat.round}</span>
            {combat.combatants.some((c) => c.init !== null) ? (
              <span className="text-muted">
                Turn: <b className="text-parch">{current?.name}</b>
              </span>
            ) : (
              <span className="text-muted">{combat.combatants.length} in the fight. Roll initiative to start.</span>
            )}
            <div className="ml-auto flex gap-1.5">
              {combat.combatants.some((c) => c.init === null) && (
                <Button
                  size="sm"
                  icon={Dices}
                  onClick={() => {
                    const rolls = combat.combatants
                      .filter((c) => c.init === null)
                      .map((c) => ({ id: c.id, total: rollDice(rollExprWithBonus(c.initBonus), 'Initiative', c.name).total }))
                    edit((d) => {
                      const fresh = d.combat.combatants.every((c) => c.init === null)
                      for (const r of rolls) {
                        const c = d.combat.combatants.find((x) => x.id === r.id)
                        if (c) c.init = r.total
                      }
                      const currentId = d.combat.combatants[d.combat.turn]?.id
                      d.combat.combatants.sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || b.initBonus - a.initBonus)
                      d.combat.turn = fresh ? 0 : Math.max(0, d.combat.combatants.findIndex((c) => c.id === currentId))
                    })
                  }}
                >
                  Roll initiative
                </Button>
              )}
              <Button size="sm" icon={ChevronLeft} onClick={() => edit((d) => nextTurn(d, -1))}>Prev</Button>
              <Button size="sm" variant="primary" icon={ChevronRight} onClick={() => edit((d) => nextTurn(d, 1))}>Next turn</Button>
            </div>
          </div>
        )}
        <BattleBoard
          image={url}
          painting={painting}
          cols={map.cols}
          rows={map.rows}
          showGrid={map.showGrid}
          snap={map.snap}
          tokens={views}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, x, y) =>
            edit((d) => {
              const t = d.map.tokens.find((k) => k.id === id)
              if (t) Object.assign(t, { x, y })
            })
          }
        />
        <p className="text-xs text-muted">
          Drag tokens to move them, drag the map to pan, scroll to zoom. Click a token for HP, conditions and attacks. The ruler counts 5 ft per square.
        </p>
      </div>

      <div className="space-y-4">
        {selected && <SelectedToken key={selected.id} t={selected} tokens={views} onClose={() => setSelectedId(null)} />}
        <EnemiesCard onEdit={setEditing} />
        <MapCard map={map} />
      </div>

      {editing && <EnemyEditor initial={editing} onSave={saveMonster} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EnemiesCard({ onEdit }: { onEdit: (m: Monster) => void }) {
  const bestiary = useGame((s) => s.bestiary)
  const hasParty = useGame((s) => s.characters.length > 0)
  const edit = useGame((s) => s.edit)
  const [count, setCount] = useState(1)
  const [rollHp, setRollHp] = useState(false)
  return (
    <Card
      title="Enemies"
      actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => onEdit(blankMonster())}>New enemy</Button>}
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="How many" className="w-20"><NumberInput value={count} min={1} max={12} onChange={(n) => setCount(clamp(n, 1, 12))} /></Field>
        <Field label="Hit points" className="flex-1">
          <select className="input" value={rollHp ? 'roll' : 'avg'} onChange={(e) => setRollHp(e.target.value === 'roll')}>
            <option value="avg">Average</option>
            <option value="roll">Roll each</option>
          </select>
        </Field>
        <Button icon={Users} disabled={!hasParty} onClick={() => edit(spawnParty)} title="Put every character on the map">Party</Button>
      </div>
      {bestiary.length === 0 ? (
        <Empty>No enemies yet. Make one with "New enemy".</Empty>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {bestiary.map((m) => {
            const Icon = TOKEN_ICONS[m.icon]
            return (
              <li key={m.id} className="group flex items-center gap-2 rounded-md border border-edge bg-panel-2/50 px-2 py-1.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-red-500" style={{ background: m.color }}>
                  {Icon && <Icon size={15} color="#fff" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-muted">CR {m.cr} · AC {m.ac} · HP {averageHp(m)} · {m.size}</div>
                </div>
                <div className="flex gap-0.5 opacity-70 group-hover:opacity-100">
                  <IconBtn label={`Edit ${m.name}`} onClick={() => onEdit(m)}><Pencil size={14} /></IconBtn>
                  <IconBtn label={`Copy ${m.name}`} onClick={() => onEdit({ ...m, id: uid(), name: `${m.name} (copy)`, attacks: m.attacks.map((a) => ({ ...a, id: uid() })) })}><Copy size={14} /></IconBtn>
                  <IconBtn
                    label={`Delete ${m.name}`}
                    danger
                    onClick={async () => (await dialog.confirm({ title: `Delete ${m.name}?`, message: 'Tokens already on the map stay.', confirmLabel: 'Delete', danger: true })) && edit((d) => void (d.bestiary = d.bestiary.filter((x) => x.id !== m.id)))}
                  >
                    <Trash2 size={14} />
                  </IconBtn>
                </div>
                <Button size="sm" variant="primary" icon={Plus} onClick={() => edit((d) => void spawnMonster(d, m, { count, rollHp }))} title={`Put ${count} on the map and into combat`}>
                  {count > 1 ? count : 'Add'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={`rounded p-1 text-muted ${danger ? 'hover:text-red-400' : 'hover:text-gold'}`}>
      {children}
    </button>
  )
}

function SelectedToken({ t, tokens, onClose }: { t: TokenView; tokens: TokenView[]; onClose: () => void }) {
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)
  const combatant = useGame((s) => s.combat.combatants.find((c) => c.id === t.combatantId))
  const monster = useGame((s) => s.bestiary.find((m) => m.id === t.monsterId))
  const pc = useGame((s) => s.characters.find((c) => c.id === t.refId))
  const [delta, setDelta] = useState(5)
  const [targetId, setTargetId] = useState('')
  const [adv, setAdv] = useState<Advantage>('normal')
  const [manual, setManual] = useState({ bonus: 5, damage: '1d8+3' })
  const [result, setResult] = useState<{ hit: boolean; crit: boolean; text: string } | null>(null)
  const ac = combatant?.ac ?? monster?.ac ?? pc?.ac
  const targets = tokens.filter((x) => x.id !== t.id && x.combatantId)
  const target = targets.find((x) => x.id === targetId)

  const patchToken = (fn: (tok: GameData['map']['tokens'][number]) => void) =>
    edit((d) => {
      const tok = d.map.tokens.find((k) => k.id === t.id)
      if (tok) fn(tok)
    })
  function changeHp(hp: number) {
    edit((d) => {
      if (t.combatantId && d.combat.combatants.some((c) => c.id === t.combatantId)) setHp(d, t.combatantId, hp)
      else {
        const c = d.characters.find((x) => x.id === t.refId)
        if (c) c.hp = clamp(hp, 0, c.maxHp)
      }
    })
  }
  function attack(bonus: number, damage: string, name: string) {
    if (!target) return
    const tc = useGame.getState().combat.combatants.find((c) => c.id === target.combatantId)
    if (!tc) return
    const out = rollAttack(rollDice, { who: `${t.label} (${name})`, targetName: tc.name, targetAc: tc.ac, bonus, damage, adv })
    if (out.damage) edit((d) => setHp(d, tc.id, tc.hp - out.damage))
    setResult(out)
  }

  const Icon = t.icon ? TOKEN_ICONS[t.icon] : undefined
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: t.color }}>{Icon && <Icon size={14} color="#fff" />}</span>
          {t.label}
        </span>
      }
      actions={<button type="button" className="text-xs text-muted hover:text-parch" onClick={onClose}>Close</button>}
      className="border-gold/40"
    >
      {t.hp !== undefined && t.maxHp !== undefined ? (
        <div className="mb-3">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span><b className="font-display text-xl">{t.hp}</b><span className="text-muted"> / {t.maxHp} HP</span></span>
            {ac !== undefined && <span className="text-muted">AC <b className="text-parch">{ac}</b></span>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink">
            <div className={`h-full transition-all ${t.side === 'foe' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${t.maxHp ? (t.hp / t.maxHp) * 100 : 0}%` }} />
          </div>
          <div className="mt-2 flex gap-1.5">
            <NumberInput value={delta} min={0} onChange={setDelta} className="w-16" />
            <Button size="sm" variant="danger" className="flex-1" onClick={() => changeHp(t.hp! - delta)}>Damage</Button>
            <Button size="sm" className="flex-1" onClick={() => changeHp(t.hp! + delta)}>Heal</Button>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-xs text-muted">This token isn't in the combat tracker, so it has no HP here.</p>
      )}

      {combatant && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {combatant.conditions.map((k) => (
              <button key={k} type="button" title="Click to remove" onClick={() => edit((d) => {
                const c = d.combat.combatants.find((x) => x.id === combatant.id)
                if (c) c.conditions = c.conditions.filter((y) => y !== k)
              })}>
                <Badge className="border-amber-500/50 text-amber-200">{k} ×</Badge>
              </button>
            ))}
          </div>
          <select
            className="input mt-1.5 py-1 text-xs"
            value=""
            onChange={(e) => {
              const v = e.target.value
              if (v) edit((d) => {
                const c = d.combat.combatants.find((x) => x.id === combatant.id)
                if (c && !c.conditions.includes(v)) c.conditions.push(v)
              })
            }}
          >
            <option value="">+ Add condition</option>
            {CONDITIONS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
      )}

      <div className="mb-3 space-y-2 border-t border-edge pt-3">
        <div className="flex gap-2">
          <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)} aria-label="Target">
            <option value="">Choose a target…</option>
            {targets.map((x) => <option key={x.id} value={x.id}>{x.label}{x.hp !== undefined ? ` (${x.hp} HP)` : ''}</option>)}
          </select>
          <select className="input w-auto" value={adv} onChange={(e) => setAdv(e.target.value as Advantage)} aria-label="Advantage">
            <option value="normal">Normal</option>
            <option value="adv">Adv.</option>
            <option value="dis">Disadv.</option>
          </select>
        </div>
        {monster && monster.attacks.length > 0 ? (
          <div className="space-y-1">
            {monster.attacks.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-md bg-panel-2/60 px-2 py-1">
                <div className="min-w-0 flex-1 text-sm">
                  <b>{a.name}</b> <span className="text-muted">{signed(a.bonus)} to hit{a.damage ? ` · ${a.damage}` : ''}</span>
                  {a.notes && <div className="truncate text-xs text-muted" title={a.notes}>{a.notes}</div>}
                </div>
                <Button size="sm" icon={Swords} disabled={!target} onClick={() => attack(a.bonus, a.damage, a.name)}>Roll</Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <NumberInput value={manual.bonus} onChange={(bonus) => setManual({ ...manual, bonus })} className="w-16" />
            <input className="input font-mono" value={manual.damage} onChange={(e) => setManual({ ...manual, damage: e.target.value })} aria-label="Damage" />
            <Button icon={Swords} disabled={!target} onClick={() => attack(manual.bonus, manual.damage, 'attack')}>Roll</Button>
          </div>
        )}
        {result && (
          <p className={`tumble rounded-md p-2 text-center text-sm ${result.crit ? 'bg-gold/20 text-gold' : result.hit ? 'bg-emerald-900/40 text-emerald-200' : 'bg-panel-2 text-muted'}`}>{result.text}</p>
        )}
        {monster?.traits && <p className="whitespace-pre-wrap text-xs text-muted">{monster.traits}</p>}
      </div>

      <details className="border-t border-edge pt-2 text-sm">
        <summary className="cursor-pointer text-muted hover:text-parch">Token look</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Size (squares)">
            <select className="input" value={t.size} onChange={(e) => patchToken((k) => void (k.size = Number(e.target.value)))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} × {n}</option>)}
            </select>
          </Field>
          <Field label="Side">
            <select className="input" value={t.side} onChange={(e) => patchToken((k) => void (k.side = e.target.value as TokenSide))}>
              <option value="foe">Enemy</option>
              <option value="party">Party</option>
              <option value="ally">Ally</option>
              <option value="neutral">Neutral</option>
            </select>
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TOKEN_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => patchToken((k) => void (k.color = c))} className={`h-5 w-5 rounded-full border-2 ${t.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
          ))}
        </div>
      </details>

      <Button size="sm" variant="danger" className="mt-3 w-full" icon={Trash2} onClick={() => { edit((d) => removeToken(d, t.id)); onClose() }}>
        {t.side === 'foe' && t.combatantId ? 'Remove from map and combat' : 'Remove from map'}
      </Button>
    </Card>
  )
}

function MapCard({ map }: { map: MapBoard }) {
  const edit = useGame((s) => s.edit)
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState('')
  const preset = map.gen?.preset ?? 'forest'

  async function applyImage(src: string) {
    try {
      const { w, h } = await imageSize(src)
      edit((d) => {
        d.map.image = src
        d.map.gen = null
        d.map.rows = Math.max(4, Math.round((d.map.cols * h) / w))
      })
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function generate(next: { preset?: string; cols?: number; rows?: number; reroll?: boolean }) {
    edit((d) => {
      d.map.gen = { preset: next.preset ?? preset, seed: next.reroll || !d.map.gen ? Math.floor(Math.random() * 1e9) : d.map.gen.seed }
      if (next.cols) d.map.cols = next.cols
      if (next.rows) d.map.rows = next.rows
      for (const t of d.map.tokens) {
        t.x = clamp(t.x, t.size / 2, d.map.cols - t.size / 2)
        t.y = clamp(t.y, t.size / 2, d.map.rows - t.size / 2)
      }
    })
  }

  const sizeIdx = BATTLE_SIZES.findIndex((s) => s.cols === map.cols && s.rows === map.rows)
  return (
    <Card title="Map">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Style">
          <select className="input" value={map.gen ? preset : ''} onChange={(e) => generate({ preset: e.target.value })}>
            {!map.gen && <option value="">Your image</option>}
            {map.gen?.preset.startsWith('house:') && <option value={preset}>Building: {POI_LABEL[preset.slice(6) as PoiType] ?? 'interior'}</option>}
            {BATTLE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Size">
          <select
            className="input"
            value={sizeIdx}
            disabled={!map.gen}
            onChange={(e) => {
              const s = BATTLE_SIZES[Number(e.target.value)]
              if (s) generate({ cols: s.cols, rows: s.rows })
            }}
          >
            {sizeIdx < 0 && <option value={-1}>{map.cols} × {map.rows}</option>}
            {BATTLE_SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          </select>
        </Field>
      </div>
      <Button variant="primary" className="mt-2 w-full" icon={Shuffle} onClick={() => generate({ reroll: true })}>
        {map.gen ? 'New layout' : 'Generate a map'}
      </Button>

      <div className="mt-4 space-y-2 border-t border-edge pt-3">
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-edge px-3 py-1.5 text-sm hover:border-gold hover:text-gold">
          <ImagePlus size={15} /> Upload your own map
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                await applyImage(await fileToCompressedDataUrl(f, 2400, 0.85))
              } catch (err) {
                setError((err as Error).message)
              }
            }}
          />
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (urlInput.trim()) void applyImage(urlInput.trim())
            setUrlInput('')
          }}
        >
          <input className="input" placeholder="…or paste an image link" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
          <Button type="submit">Use</Button>
        </form>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!map.gen && (
          <Field label="Squares across (match your image's grid)">
            <NumberInput
              value={map.cols}
              min={4}
              max={80}
              onChange={(n) =>
                edit((d) => {
                  const cols = clamp(n, 4, 80)
                  d.map.rows = Math.max(4, Math.round((cols * d.map.rows) / d.map.cols))
                  d.map.cols = cols
                })
              }
            />
          </Field>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-edge pt-3">
        <Button size="sm" onClick={() => edit((d) => void (d.map.showGrid = !d.map.showGrid))}>{map.showGrid ? 'Hide grid' : 'Show grid'}</Button>
        <Button size="sm" onClick={() => edit((d) => void (d.map.snap = !d.map.snap))}>{map.snap ? 'Snap: on' : 'Snap: off'}</Button>
        <Button
          size="sm"
          variant="danger"
          disabled={!map.tokens.length}
          onClick={async () =>
            (await dialog.confirm({ title: 'Clear all tokens?', message: 'Enemies placed on the map also leave the combat tracker.', confirmLabel: 'Clear', danger: true })) &&
            edit((d) => {
              for (const t of [...d.map.tokens]) removeToken(d, t.id)
            })
          }
        >
          Clear tokens
        </Button>
      </div>
    </Card>
  )
}
