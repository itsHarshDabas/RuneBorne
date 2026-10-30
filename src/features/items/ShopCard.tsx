import { RotateCcw, ShoppingCart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card } from '../../components/ui'
import { RARITY_COLOR } from '../../data/items'
import { addItem, allItems, findItem, formatCoins, formatPrice, pay, shopStock, toInv } from '../../lib/items'
import { useGame } from '../../store/game'
import { ItemIcon } from './ItemParts'

/** What a shop on the world map sells. Buying takes the buyer's coins and puts the item in their pack. */
export function ShopCard({ worldSeed, placeId, poi, townType, title }: { worldSeed: number; placeId: string; poi: string; townType: string; title: string }) {
  const edit = useGame((s) => s.edit)
  const characters = useGame((s) => s.characters)
  const customItems = useGame((s) => s.customItems)
  const sold = useGame((s) => s.world?.sold?.[placeId])
  const [buyer, setBuyer] = useState(() => characters[0]?.id ?? '')
  const [note, setNote] = useState('')
  const stock = useMemo(() => shopStock(worldSeed, placeId, poi, townType, allItems({ customItems })), [worldSeed, placeId, poi, townType, customItems])
  const who = characters.find((c) => c.id === buyer)
  if (!stock.length) return null

  function buy(defId: string, price: number) {
    const def = findItem({ customItems }, defId)
    if (!def || !who) return
    let ok = false
    edit((d) => {
      const ch = d.characters.find((c) => c.id === buyer)
      if (!ch || !d.world || !pay(ch.coins, price)) return
      addItem(ch.items, toInv(def))
      d.world.sold ??= {}
      d.world.sold[placeId] ??= {}
      d.world.sold[placeId][defId] = (d.world.sold[placeId][defId] ?? 0) + 1
      ok = true
    })
    setNote(ok ? `${who.name} bought ${def.name} for ${formatPrice(price)}.` : `${who.name} can't afford ${def.name} (${formatPrice(price)}).`)
  }

  return (
    <Card
      title={<span className="inline-flex items-center gap-2"><ShoppingCart size={16} />For sale</span>}
      actions={sold && <Button size="sm" icon={RotateCcw} title="Restock the shop" onClick={() => edit((d) => void (d.world?.sold && delete d.world.sold[placeId]))}>Restock</Button>}
    >
      <p className="-mt-1 mb-2 truncate text-sm text-muted">{title}</p>
      {characters.length ? (
        <div className="mb-2 flex items-center gap-2 text-sm">
          <span className="text-muted">Buyer</span>
          <select className="input py-1" value={buyer} onChange={(e) => setBuyer(e.target.value)}>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      ) : (
        <p className="mb-2 text-sm text-muted">Make a character to buy things.</p>
      )}
      {who && <p className="mb-2 text-xs text-muted">Purse: {formatCoins(who.coins)}</p>}
      {note && <p className="mb-2 text-sm text-emerald-300">{note}</p>}
      <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {stock.map((s) => {
          const def = findItem({ customItems }, s.defId)
          if (!def) return null
          const left = s.qty - (sold?.[s.defId] ?? 0)
          return (
            <li key={s.defId} className="flex items-center gap-2 rounded-md border border-edge/60 bg-ink/30 px-2 py-1 text-sm" title={def.description}>
              <ItemIcon kind={def.kind} rarity={def.rarity} size={13} />
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ color: def.rarity === 'mundane' ? undefined : RARITY_COLOR[def.rarity] }}>{def.name}</div>
                <div className="text-[11px] text-muted">{left > 0 ? `${left} left` : 'Sold out'}</div>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-gold">{formatPrice(s.price)}</span>
              <Button size="sm" variant="primary" disabled={!who || left <= 0} onClick={() => buy(s.defId, s.price)}>Buy</Button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
