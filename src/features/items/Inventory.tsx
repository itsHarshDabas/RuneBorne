import { BookOpen, Minus, Plus, Trash2, Wand } from 'lucide-react'
import { useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { RARITY_COLOR } from '../../data/items'
import { addItem, allItems, applyItem, capacity, carried, effectLabel, takeItem, toInv } from '../../lib/items'
import { COINS, useGame, type Coins, type GameData, type InvItem } from '../../store/game'
import { ItemCatalog, ItemIcon, ReadModal } from './ItemParts'

/** 'stash' for the party's shared loot, otherwise a character id. */
export type Owner = string

function bagOf(d: GameData, owner: Owner): { items: InvItem[]; coins: Coins } | undefined {
  if (owner === 'stash') return d.stash
  return d.characters.find((c) => c.id === owner)
}

export function Inventory({ owner }: { owner: Owner }) {
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)
  const characters = useGame((s) => s.characters)
  const stash = useGame((s) => s.stash)
  const customItems = useGame((s) => s.customItems)
  const ch = characters.find((c) => c.id === owner)
  const bag = owner === 'stash' ? stash : ch
  const [adding, setAdding] = useState(false)
  const [reading, setReading] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  if (!bag) return null

  const change = (fn: (b: { items: InvItem[]; coins: Coins }, d: GameData) => void) =>
    edit((d) => {
      const b = bagOf(d, owner)
      if (b) fn(b, d)
    })

  function move(itemId: string, to: Owner) {
    edit((d) => {
      const from = bagOf(d, owner)
      const dest = bagOf(d, to)
      const it = from?.items.find((i) => i.id === itemId)
      if (!from || !dest || !it) return
      const moved = takeItem(from.items, itemId, it.qty)
      if (moved) addItem(dest.items, moved)
    })
  }

  function use(itemId: string) {
    let text = ''
    edit((d) => void (text = applyItem(d, rollDice, owner, itemId)))
    setMessage(text)
  }

  const weight = carried(bag.items)
  const cap = ch ? capacity(ch) : 0
  const readingItem = bag.items.find((i) => i.id === reading)
  const targets = [...(owner === 'stash' ? [] : [{ id: 'stash', name: 'Party stash' }]), ...characters.filter((c) => c.id !== owner).map((c) => ({ id: c.id, name: c.name }))]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1.5">
        {COINS.map((k) => (
          <label key={k} className="flex flex-col items-center rounded-md border border-edge bg-ink/40 px-1 py-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">{k}</span>
            <input
              className="w-full bg-transparent text-center text-sm outline-none"
              type="number"
              min={0}
              value={bag.coins[k]}
              onChange={(e) => change((b) => void (b.coins[k] = Math.max(0, Math.floor(Number(e.target.value) || 0))))}
              aria-label={`${k} coins`}
            />
          </label>
        ))}
      </div>

      {ch && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted"><span>Carrying</span><span className={weight > cap ? 'text-red-300' : ''}>{Math.round(weight * 10) / 10} / {cap} lb</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink">
            <div className={`h-full ${weight > cap ? 'bg-red-500' : 'bg-gold/70'}`} style={{ width: `${Math.min(100, (weight / Math.max(1, cap)) * 100)}%` }} />
          </div>
        </div>
      )}

      {message && <p className="rounded-md bg-emerald-900/30 px-2 py-1.5 text-sm text-emerald-200">{message}</p>}

      <ul className="space-y-1">
        {bag.items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 bg-ink/30 px-2 py-1.5 text-sm">
            <ItemIcon kind={it.kind} rarity={it.rarity} size={14} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate" style={{ color: it.rarity === 'mundane' ? undefined : RARITY_COLOR[it.rarity] }} title={it.description}>{it.name}</span>
                {it.equipped && <span className="rounded bg-gold/20 px-1 text-[10px] text-gold">equipped</span>}
              </div>
              {(it.effect || it.charges !== undefined) && (
                <p className="text-[11px] text-muted">{[it.effect && it.effect.type !== 'read' ? effectLabel(it) : '', it.charges !== undefined ? `${it.charges} charges` : ''].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label="One less" className="rounded p-0.5 text-muted hover:text-parch" onClick={() => change((b) => void takeItem(b.items, it.id, 1))}><Minus size={13} /></button>
              <span className="w-6 text-center tabular-nums">{it.qty}</span>
              <button type="button" aria-label="One more" className="rounded p-0.5 text-muted hover:text-parch" onClick={() => change((b) => { const x = b.items.find((i) => i.id === it.id); if (x) x.qty += 1 })}><Plus size={13} /></button>
            </div>
            <div className="flex flex-wrap gap-1">
              {ch && it.effect && it.effect.type !== 'read' && <Button size="sm" variant="primary" icon={Wand} onClick={() => use(it.id)}>Use</Button>}
              {(it.effect?.type === 'read' || it.text !== undefined) && <Button size="sm" icon={BookOpen} onClick={() => setReading(it.id)}>Read</Button>}
              {ch && ['weapon', 'armor', 'magic'].includes(it.kind) && (
                <Button size="sm" onClick={() => change((b) => { const x = b.items.find((i) => i.id === it.id); if (x) x.equipped = !x.equipped })}>{it.equipped ? 'Unequip' : 'Equip'}</Button>
              )}
              {targets.length > 0 && (
                <select className="input w-auto py-0.5 text-xs" value="" aria-label="Give to" onChange={(e) => e.target.value && move(it.id, e.target.value)}>
                  <option value="">Give…</option>
                  {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <button type="button" aria-label={`Remove ${it.name}`} className="rounded p-1 text-muted hover:text-red-300" onClick={() => change((b) => void (b.items = b.items.filter((i) => i.id !== it.id)))}><Trash2 size={13} /></button>
            </div>
          </li>
        ))}
        {!bag.items.length && <li className="rounded-md border border-dashed border-edge p-3 text-center text-sm text-muted">Nothing here yet.</li>}
      </ul>
      <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>Add item</Button>

      {adding && (
        <Modal title="Add an item" onClose={() => setAdding(false)} wide>
          <ItemCatalog
            items={allItems({ customItems })}
            actionLabel="Add"
            compact
            onAction={(def, qty) => {
              change((b) => addItem(b.items, toInv(def, qty)))
              setMessage(`Added ${qty} × ${def.name}.`)
            }}
          />
        </Modal>
      )}
      {readingItem && (
        <ReadModal
          title={readingItem.name}
          text={readingItem.text ?? ''}
          onChange={(t) => change((b) => { const x = b.items.find((i) => i.id === readingItem.id); if (x) x.text = t })}
          onClose={() => setReading(null)}
        />
      )}
    </div>
  )
}
