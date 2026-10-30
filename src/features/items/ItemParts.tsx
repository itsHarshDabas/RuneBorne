import { BookOpen, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Field, Modal, NumberInput } from '../../components/ui'
import { ITEM_KINDS, KIND_LABEL, RARITIES, RARITY_COLOR, slug, type ItemDef, type ItemKind, type Rarity } from '../../data/items'
import { effectLabel, formatPrice } from '../../lib/items'
import { KIND_ICON } from './icons'

export function ItemIcon({ kind, rarity, size = 16 }: { kind: ItemKind; rarity: Rarity; size?: number }) {
  const Icon = KIND_ICON[kind]
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-md border bg-ink/60 p-1" style={{ borderColor: RARITY_COLOR[rarity] + '88', color: RARITY_COLOR[rarity] }}>
      <Icon size={size} />
    </span>
  )
}

/** Searchable list of item definitions with one action per row. */
export function ItemCatalog({ items, actionLabel, onAction, extra, compact }: {
  items: ItemDef[]
  actionLabel: string
  onAction: (def: ItemDef, qty: number) => void
  extra?: (def: ItemDef) => React.ReactNode
  compact?: boolean
}) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<ItemKind | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return items.filter((i) => (kind === 'all' || i.kind === kind) && (!t || i.name.toLowerCase().includes(t) || i.description.toLowerCase().includes(t)))
  }, [items, q, kind])
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-md border border-edge bg-ink/40 px-2">
        <Search size={14} className="text-muted" />
        <input className="w-full bg-transparent py-1.5 text-sm outline-none" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-1">
        {(['all', ...ITEM_KINDS] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full border px-2 py-0.5 text-xs ${kind === k ? 'border-gold bg-gold/15 text-gold' : 'border-edge text-muted hover:text-parch'}`}>
            {k === 'all' ? 'All' : KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <ul className={`${compact ? 'max-h-[50vh]' : 'max-h-[60vh]'} space-y-1 overflow-y-auto pr-1`}>
        {shown.map((it) => (
          <li key={it.id} className="rounded-md border border-edge/60 bg-ink/30">
            <button type="button" onClick={() => { setOpen(open === it.id ? null : it.id); setQty(1) }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm">
              <ItemIcon kind={it.kind} rarity={it.rarity} size={14} />
              <span className="truncate" style={{ color: it.rarity === 'mundane' ? undefined : RARITY_COLOR[it.rarity] }}>{it.name}</span>
              {it.custom && <Sparkles size={12} className="shrink-0 text-gold" aria-label="Custom item" />}
              <span className="ml-auto shrink-0 text-xs text-muted">{formatPrice(it.cost)}</span>
            </button>
            {open === it.id && (
              <div className="space-y-2 border-t border-edge/60 px-3 py-2 text-sm">
                <p className="text-muted">{it.description}</p>
                <p className="text-xs text-muted capitalize">{it.rarity} · {it.weight} lb{it.effect ? ` · ${effectLabel(it)}` : ''}{it.charges ? ` · ${it.charges} charges` : ''}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <NumberInput value={qty} onChange={setQty} min={1} max={99} className="w-16" />
                  <Button size="sm" variant="primary" onClick={() => onAction(it, qty)}>{actionLabel}</Button>
                  {extra?.(it)}
                </div>
              </div>
            )}
          </li>
        ))}
        {!shown.length && <li className="p-3 text-center text-sm text-muted">No items match.</li>}
      </ul>
    </div>
  )
}

const EFFECTS = ['none', 'heal', 'mana', 'damage', 'spell', 'read'] as const

/** Create or edit a custom item. */
export function ItemEditor({ initial, onSave, onClose }: { initial?: ItemDef; onSave: (def: ItemDef) => void; onClose: () => void }) {
  const [it, setIt] = useState<ItemDef>(initial ?? { id: '', name: 'New item', kind: 'trinket', rarity: 'common', cost: 10, weight: 1, description: '', custom: true })
  const set = (patch: Partial<ItemDef>) => setIt((x) => ({ ...x, ...patch }))
  const eff = it.effect?.type ?? 'none'
  const dice = it.effect && 'dice' in it.effect ? it.effect.dice ?? '' : ''
  function setEffect(type: (typeof EFFECTS)[number], d = dice, spell = it.effect?.type === 'spell' ? it.effect.spell : '') {
    if (type === 'none') set({ effect: undefined })
    else if (type === 'read') set({ effect: { type: 'read' }, text: it.text ?? '' })
    else if (type === 'spell') set({ effect: { type: 'spell', spell, dice: d || undefined } })
    else set({ effect: { type, dice: d || '1d4' } })
  }
  return (
    <Modal
      title={initial ? `Edit ${initial.name}` : 'New item'}
      onClose={onClose}
      wide
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave({ ...it, id: it.id || `custom-${slug(it.name)}-${Date.now().toString(36)}`, custom: true })}>Save item</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><input className="input" value={it.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Kind">
          <select className="input" value={it.kind} onChange={(e) => set({ kind: e.target.value as ItemKind })}>{ITEM_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
        </Field>
        <Field label="Rarity">
          <select className="input capitalize" value={it.rarity} onChange={(e) => set({ rarity: e.target.value as Rarity })}>{RARITIES.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
        <Field label="Price (gp)"><input className="input" type="number" min={0} step={0.01} value={it.cost} onChange={(e) => set({ cost: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Weight (lb)"><input className="input" type="number" min={0} step={0.5} value={it.weight} onChange={(e) => set({ weight: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea className="input min-h-16" value={it.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="When used">
          <select className="input" value={eff} onChange={(e) => setEffect(e.target.value as (typeof EFFECTS)[number])}>
            <option value="none">Nothing automatic</option>
            <option value="heal">Heals (roll dice)</option>
            <option value="mana">Restores mana (roll dice)</option>
            <option value="damage">Deals damage (roll dice)</option>
            <option value="spell">Casts a spell</option>
            <option value="read">Can be read (book, map, letter)</option>
          </select>
        </Field>
        {(eff === 'heal' || eff === 'mana' || eff === 'damage' || eff === 'spell') && (
          <Field label={eff === 'spell' ? 'Spell dice (optional)' : 'Dice'}><input className="input" value={dice} placeholder="2d4+2" onChange={(e) => setEffect(eff, e.target.value)} /></Field>
        )}
        {eff === 'spell' && <Field label="Spell name"><input className="input" value={it.effect?.type === 'spell' ? it.effect.spell : ''} onChange={(e) => setEffect('spell', dice, e.target.value)} /></Field>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!it.consumable} onChange={(e) => set({ consumable: e.target.checked })} /> Used up when used</label>
        <Field label="Charges (blank for none)"><input className="input" type="number" min={0} value={it.charges ?? ''} onChange={(e) => set({ charges: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></Field>
        {eff === 'read' && <Field label="What it says" className="sm:col-span-2"><textarea className="input min-h-28 font-serif" value={it.text ?? ''} onChange={(e) => set({ text: e.target.value })} /></Field>}
      </div>
    </Modal>
  )
}

/** Shows (and lets the GM rewrite) the text of a book, map or letter. */
export function ReadModal({ title, text, onChange, onClose }: { title: string; text: string; onChange?: (t: string) => void; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  return (
    <Modal title={<span className="inline-flex items-center gap-2"><BookOpen size={18} />{title}</span>} onClose={onClose} wide footer={onChange && <Button onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit text'}</Button>}>
      {editing && onChange ? (
        <textarea className="input min-h-64 font-serif" value={text} onChange={(e) => onChange(e.target.value)} autoFocus />
      ) : (
        <div className="min-h-40 whitespace-pre-wrap rounded-lg border border-amber-900/40 bg-[#e9dfc4] p-5 font-serif text-[15px] leading-relaxed text-[#2b2117] shadow-inner">
          {text.trim() || <span className="italic opacity-60">The pages are blank.</span>}
        </div>
      )}
    </Modal>
  )
}
