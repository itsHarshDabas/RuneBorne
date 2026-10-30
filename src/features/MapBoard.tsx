import { useRef, useState, type PointerEvent } from 'react'
import { Button, Card, Field, NumberInput } from '../components/ui'
import { clamp, fileToCompressedDataUrl, uid } from '../lib/util'
import { useGame } from '../store/game'

const TOKEN_COLORS = ['#38bdf8', '#f87171', '#34d399', '#facc15', '#a78bfa', '#fb923c', '#f472b6', '#e5e7eb']

export function MapBoard() {
  const map = useGame((s) => s.map)
  const characters = useGame((s) => s.characters)
  const combatants = useGame((s) => s.combat.combatants)
  const edit = useGame((s) => s.edit)
  const boardRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  // Position while dragging stays local, and is saved once on release (saving every move would be slow with a big image)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenColor, setTokenColor] = useState(TOKEN_COLORS[1])
  const [error, setError] = useState('')

  async function upload(file: File | undefined) {
    if (!file) return
    try {
      const data = await fileToCompressedDataUrl(file)
      edit((d) => void (d.map.image = data))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function addToken(label: string, color: string) {
    edit((d) => void d.map.tokens.push({ id: uid(), label: label || '?', color, x: 50 + (Math.random() * 10 - 5), y: 50 + (Math.random() * 10 - 5) }))
  }

  function onMove(e: PointerEvent) {
    if (!dragId || !boardRef.current) return
    const r = boardRef.current.getBoundingClientRect()
    const x = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)
    const y = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100)
    setDragPos({ x, y })
  }

  function endDrag() {
    if (dragId && dragPos) {
      edit((d) => {
        const t = d.map.tokens.find((k) => k.id === dragId)
        if (t) {
          t.x = dragPos.x
          t.y = dragPos.y
        }
      })
    }
    setDragId(null)
    setDragPos(null)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Card
        title="Battle Map"
        actions={
          <>
            <label className="cursor-pointer rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-ink hover:bg-amber-400">
              Upload map image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {map.image && <Button size="sm" variant="danger" onClick={() => edit((d) => void (d.map.image = ''))}>Remove image</Button>}
          </>
        }
      >
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        <div
          ref={boardRef}
          className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-edge bg-ink"
          style={map.image ? undefined : { aspectRatio: '16 / 10' }}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          {map.image ? (
            <img src={map.image} alt="Battle map" className="block w-full" draggable={false} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">
              Upload a map image, paste an image link, or open a building or dungeon in the World map and choose "Use as battle map". Tokens work on the blank grid too.
            </div>
          )}
          {map.showGrid && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(to right, rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.12) 1px, transparent 1px)',
                backgroundSize: `${map.grid}px ${map.grid}px`,
              }}
            />
          )}
          {map.tokens.map((t) => {
            const pos = dragId === t.id && dragPos ? dragPos : t
            return (
            <div
              key={t.id}
              onPointerDown={(e) => {
                e.preventDefault()
                setDragId(t.id)
              }}
              onDoubleClick={() => edit((d) => void (d.map.tokens = d.map.tokens.filter((k) => k.id !== t.id)))}
              className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white/80 text-xs font-bold text-ink shadow-lg shadow-black/60 ${dragId === t.id ? 'scale-125 cursor-grabbing' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, background: t.color }}
              title={`${t.label} (double-click to remove)`}
            >
              {t.label.slice(0, 3)}
            </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Drag tokens to move them. Double-click a token to remove it.</p>
      </Card>

      <div className="space-y-4">
        <Card title="Tokens">
          <div className="mb-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => characters.forEach((c) => addToken(c.name, c.color))} disabled={!characters.length}>+ Party</Button>
            <Button size="sm" onClick={() => combatants.filter((c) => c.side === 'foe').forEach((c) => addToken(c.name, '#f87171'))} disabled={!combatants.some((c) => c.side === 'foe')}>
              + Foes from combat
            </Button>
            <Button size="sm" variant="danger" onClick={() => edit((d) => void (d.map.tokens = []))} disabled={!map.tokens.length}>Clear</Button>
          </div>
          <div className="flex gap-2">
            <input className="input" placeholder="Label, e.g. Orc" value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} />
            <Button onClick={() => { addToken(tokenLabel, tokenColor); setTokenLabel('') }}>Add</Button>
          </div>
          <div className="mt-2 flex gap-1.5">
            {TOKEN_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Token colour ${c}`} onClick={() => setTokenColor(c)} className={`h-6 w-6 rounded-full border-2 ${tokenColor === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 items-end gap-2 border-t border-edge pt-3">
            <Field label="Grid size (px)"><NumberInput value={map.grid} min={10} max={200} onChange={(n) => edit((d) => void (d.map.grid = clamp(n, 10, 200)))} /></Field>
            <Button onClick={() => edit((d) => void (d.map.showGrid = !d.map.showGrid))}>{map.showGrid ? 'Hide grid' : 'Show grid'}</Button>
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (urlInput.trim()) edit((d) => void (d.map.image = urlInput.trim()))
              setUrlInput('')
            }}
          >
            <input className="input" placeholder="…or paste an image URL" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
            <Button type="submit">Use</Button>
          </form>
        </Card>

      </div>
    </div>
  )
}
