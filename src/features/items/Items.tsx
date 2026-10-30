import { Coins as CoinsIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Field } from '../../components/ui'
import { CR_VALUES, crNumber } from '../../data/monsters'
import type { ItemDef } from '../../data/items'
import { dialog } from '../../lib/dialog'
import { addItem, allItems, rollLoot, toInv } from '../../lib/items'
import { useGame, type Coins } from '../../store/game'
import { Inventory } from './Inventory'
import { ItemCatalog, ItemEditor } from './ItemParts'

export function Items() {
  const edit = useGame((s) => s.edit)
  const rollDice = useGame((s) => s.rollDice)
  const characters = useGame((s) => s.characters)
  const customItems = useGame((s) => s.customItems)
  const [target, setTarget] = useState<string>(() => characters[0]?.id ?? 'stash')
  const [editing, setEditing] = useState<ItemDef | 'new' | null>(null)
  const [note, setNote] = useState('')
  const [cr, setCr] = useState('1')
  const [loot, setLoot] = useState('')
  const targetName = target === 'stash' ? 'the party stash' : characters.find((c) => c.id === target)?.name ?? 'the party stash'

  function give(def: ItemDef, qty: number) {
    edit((d) => {
      const bag = target === 'stash' ? d.stash : d.characters.find((c) => c.id === target) ?? d.stash
      addItem(bag.items, toInv(def, qty))
    })
    setNote(`Gave ${qty} × ${def.name} to ${targetName}.`)
  }

  function saveItem(def: ItemDef) {
    edit((d) => {
      const i = d.customItems.findIndex((x) => x.id === def.id)
      if (i >= 0) d.customItems[i] = def
      else d.customItems.push(def)
    })
    setEditing(null)
  }

  function rollForLoot() {
    const r = rollLoot(rollDice, crNumber(cr), allItems({ customItems }))
    edit((d) => {
      for (const [k, v] of Object.entries(r.coins) as [keyof Coins, number][]) d.stash.coins[k] += v
      for (const it of r.items) addItem(d.stash.items, toInv(it))
    })
    setLoot(`Found ${r.text}. Added to the party stash.`)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <Card title="Items" actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing('new')}>New item</Button>}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label="Give to" className="w-56">
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="stash">Party stash</option>
            </select>
          </Field>
          {note && <p className="pb-2 text-sm text-emerald-300">{note}</p>}
        </div>
        <ItemCatalog
          items={allItems({ customItems })}
          actionLabel="Give"
          onAction={give}
          extra={(def) => def.custom && (
            <>
              <Button size="sm" icon={Pencil} onClick={() => setEditing(def)}>Edit</Button>
              <Button
                size="sm"
                variant="danger"
                icon={Trash2}
                aria-label={`Delete ${def.name}`}
                onClick={async () => (await dialog.confirm({ title: `Delete ${def.name}?`, message: 'Copies people already carry are kept.', confirmLabel: 'Delete', danger: true })) && edit((d) => void (d.customItems = d.customItems.filter((x) => x.id !== def.id)))}
              />
            </>
          )}
        />
      </Card>

      <div className="space-y-4">
        <Card title="Roll loot">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Challenge rating" className="w-36">
              <select className="input" value={cr} onChange={(e) => setCr(e.target.value)}>{CR_VALUES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Button variant="primary" icon={CoinsIcon} onClick={rollForLoot}>Roll treasure</Button>
          </div>
          {loot && <p className="mt-2 text-sm text-emerald-300">{loot}</p>}
        </Card>
        <Card title="Party stash">
          <Inventory owner="stash" />
        </Card>
      </div>

      {editing && <ItemEditor initial={editing === 'new' ? undefined : editing} onSave={saveItem} onClose={() => setEditing(null)} />}
    </div>
  )
}
