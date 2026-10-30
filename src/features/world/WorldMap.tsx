import { ArrowLeft, ChevronRight, Crown, Globe, MapPin, Send, Shuffle, Swords, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Field, NumberInput } from '../../components/ui'
import { ATTITUDES } from '../../data/homebrew'
import { uid } from '../../lib/util'
import { MAP_NPC_STATES, PLACE_STATES, useGame, type MapNpcState, type PlaceState, type WorldSave } from '../../store/game'
import { useUi } from '../../store/ui'
import { BIOME_LABEL, generateWorld, POI_LABEL, type World } from './generate'
import { NPC_STATE_COLOR, PLACE_STATE_COLOR, POI_COLOR, POI_ICON, SETTLEMENT_ICON, SITE_ICON } from './icons'
import { PanZoom } from './PanZoom'
import { levelBox, parentPath, resolveLevel, type Level } from './resolve'
import { terrainImage } from './terrainImage'
import { dialog } from '../../lib/dialog'

type Person = { id: string; name: string; role: string; state: MapNpcState; notes: string; x: number; y: number; custom: boolean; inside?: boolean; trait?: string; secret?: string }
type PlaceItem = { id: string; name: string; sub: string; state: PlaceState; notes: string; enter?: string; detail?: string; x: number; y: number }
type Selection = { kind: 'place' | 'npc'; id: string } | null

function people(level: Level, save: WorldSave): Person[] {
  const merge = (p: Omit<Person, 'state' | 'notes'>): Person => {
    const e = save.npcs[p.id] ?? {}
    return { ...p, name: e.name ?? p.name, role: e.role ?? p.role, state: e.state ?? 'Normal', notes: e.notes ?? '' }
  }
  const out: Person[] = []
  if (level.kind === 'settlement') {
    // Shopkeepers etc. only appear once you zoom in, so the streets stay readable
    for (const n of level.map.npcs) out.push(merge({ ...n, custom: false, inside: Boolean(n.placeId) }))
  }
  if (level.kind === 'building') {
    const rooms = level.interior.rooms
    level.town.npcs
      .filter((n) => n.placeId === level.building.id)
      .forEach((n, i) => {
        const r = rooms[i % rooms.length]
        out.push(merge({ ...n, custom: false, x: (r.x + 1.5 + ((i * 2) % Math.max(1, r.w - 2))) * 20, y: (r.y + r.h / 2) * 20 }))
      })
  }
  for (const c of save.customNpcs.filter((c) => c.at === level.path)) out.push(merge({ ...c, custom: true }))
  return out
}

function places(level: Level, world: World, save: WorldSave): PlaceItem[] {
  const merge = (p: Omit<PlaceItem, 'state' | 'notes'>): PlaceItem => {
    const e = save.places[p.id] ?? {}
    return { ...p, name: e.name ?? p.name, state: e.state ?? 'Normal', notes: e.notes ?? '' }
  }
  switch (level.kind) {
    case 'world':
      return world.regions.map((r) => merge({ id: r.id, name: r.name, sub: `${BIOME_LABEL[r.biome]} · danger ${r.danger}/5${r.capital ? ' · capital' : ''}`, enter: r.id, x: r.x, y: r.y }))
    case 'region':
      return level.map.places.map((p) => merge({ id: p.id, name: p.name, sub: p.type, enter: p.id, x: p.x, y: p.y }))
    case 'settlement':
      return level.map.buildings.filter((b) => b.poi).map((b) => merge({ id: b.id, name: b.name ?? POI_LABEL[b.poi!], sub: POI_LABEL[b.poi!], enter: b.id, x: b.x, y: b.y }))
    case 'site':
    case 'building':
      return level.interior.rooms.map((r) => merge({ id: r.id, name: level.kind === 'site' ? `Room ${r.label}` : r.label, sub: 'room', detail: r.detail, x: (r.x + r.w / 2) * 20, y: (r.y + r.h / 2) * 20 }))
  }
}

function levelTitle(level: Level, world: World, save: WorldSave) {
  const n = (id: string, fallback: string) => save.places[id]?.name ?? fallback
  switch (level.kind) {
    case 'world':
      return world.name
    case 'region':
      return n(level.region.id, level.region.name)
    case 'settlement':
    case 'site':
      return n(level.place.id, level.place.name)
    case 'building':
      return n(level.building.id, level.building.name ?? 'House')
  }
}

export function WorldMap() {
  const save = useGame((s) => s.world)
  const edit = useGame((s) => s.edit)
  const [seedInput, setSeedInput] = useState(() => Math.floor(Math.random() * 1_000_000))

  function create(seed: number) {
    edit((d) => void (d.world = { seed, createdAt: Date.now(), places: {}, npcs: {}, customNpcs: [] }))
  }

  if (!save) {
    return (
      <Card title="Generate a world">
        <p className="mb-4 max-w-2xl text-sm text-muted">
          RuneBorne builds a whole continent for you: regions, towns, cities, dungeons, shops and the people who run them. Zoom or click to go from the continent down to a single tavern. The world is saved with your campaign, so it stays the same every time you open it.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Seed (same seed = same world)" className="w-56">
            <NumberInput value={seedInput} onChange={setSeedInput} />
          </Field>
          <Button onClick={() => setSeedInput(Math.floor(Math.random() * 1_000_000))} title="Random seed" aria-label="Random seed" icon={Shuffle} />
          <Button variant="primary" onClick={() => create(seedInput)} icon={Globe}>Generate world</Button>
        </div>
      </Card>
    )
  }
  return <WorldExplorer key={save.seed} save={save} onRegenerate={create} />
}

function WorldExplorer({ save, onRegenerate }: { save: WorldSave; onRegenerate: (seed: number) => void }) {
  const edit = useGame((s) => s.edit)
  const setTab = useUi((s) => s.setTab)
  const world = useMemo(() => generateWorld(save.seed), [save.seed])
  const [path, setPath] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const level = resolveLevel(world, path)
  const box = levelBox(level)
  const ppl = people(level, save)
  const items = places(level, world, save)
  const unit = box.w / 1000

  function go(p: string) {
    setPath(p)
    setSelection(null)
  }

  const crumbs: { path: string; label: string }[] = []
  const parts = level.path.split('/').filter(Boolean)
  crumbs.push({ path: '', label: world.name })
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join('/')
    crumbs.push({ path: p, label: levelTitle(resolveLevel(world, p), world, save) })
  }

  function onZoomPast(dir: 'in' | 'out', x: number, y: number) {
    if (dir === 'out') {
      if (level.path) go(parentPath(level.path))
      return
    }
    const cx = box.x + x
    const cy = box.y + y
    if (level.kind === 'world') {
      const r = world.regionAt(cx, cy)
      if (r) go(r.id)
    } else if (level.kind === 'region' || level.kind === 'settlement') {
      const near = items.filter((i) => i.enter).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]
      if (near?.enter && Math.hypot(near.x - cx, near.y - cy) < box.w * 0.12) go(near.enter)
    }
  }

  function setPlace(id: string, patch: { name?: string; state?: PlaceState; notes?: string }) {
    edit((d) => {
      if (!d.world) return
      d.world.places[id] = { ...d.world.places[id], ...patch }
    })
  }
  function setNpc(id: string, patch: { name?: string; role?: string; state?: MapNpcState; notes?: string }) {
    edit((d) => {
      if (!d.world) return
      d.world.npcs[id] = { ...d.world.npcs[id], ...patch }
    })
  }

  function addNpc() {
    const id = `${level.path || 'world'}/c${uid()}`
    edit((d) => void d.world?.customNpcs.push({ id, at: level.path, x: box.x + box.w / 2, y: box.y + box.h / 2, name: 'New character', role: 'Wanderer' }))
    setSelection({ kind: 'npc', id })
  }

  function sendToNpcs(p: Person) {
    const attitude = p.state === 'Hostile' ? 'Hostile' : p.state === 'Friendly' ? 'Friendly' : 'Indifferent'
    edit((d) =>
      void d.npcs.unshift({
        id: uid(), name: p.name, role: p.role, species: '', attitude: attitude as (typeof ATTITUDES)[number], chaMod: 0,
        trait: p.trait ?? '', want: '', secret: p.secret ?? '', notes: `From ${crumbs.map((c) => c.label).join(' › ')}. ${p.notes}`.trim(), hp: 10, ac: 11, log: [],
      }),
    )
    setTab('NPCs')
  }

  async function useAsBattleMap() {
    const svg = svgRef.current
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.querySelector('g')?.setAttribute('transform', '')
    clone.setAttribute('width', String(box.w * 2))
    clone.setAttribute('height', String(box.h * 2))
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = box.w * 2
      c.height = box.h * 2
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#1a1714'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const data = c.toDataURL('image/jpeg', 0.85)
      // Interiors are drawn on a 20-unit grid, so their squares line up with the battle grid
      const interior = level.kind === 'site' || level.kind === 'building'
      const cols = interior ? Math.round(box.w / 20) : 30
      edit((d) => {
        d.map.image = data
        d.map.gen = null
        d.map.cols = cols
        d.map.rows = Math.max(1, Math.round((cols * box.h) / box.w))
        d.map.showGrid = !interior
      })
      useUi.getState().setMapMode('battle')
    }
    img.src = url
  }

  const selectedPerson = selection?.kind === 'npc' ? ppl.find((p) => p.id === selection.id) : undefined
  const selectedPlace = selection?.kind === 'place' ? items.find((p) => p.id === selection.id) : undefined
  const currentPlaceId = level.kind === 'world' ? null : level.kind === 'region' ? level.region.id : level.kind === 'building' ? level.building.id : level.place.id
  const current = currentPlaceId ? { ...save.places[currentPlaceId] } : null

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => go(parentPath(level.path))} disabled={!level.path} title="Up one level" aria-label="Up one level" icon={ArrowLeft} />
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={14} className="text-muted" />}
                <button type="button" onClick={() => go(c.path)} className={i === crumbs.length - 1 ? 'font-display text-gold' : 'text-muted hover:text-parch'}>
                  {c.label}
                </button>
              </span>
            ))}
          </nav>
          <span className="ml-auto text-xs text-muted">Scroll to zoom · drag to pan · zoom past the edge or click to go deeper</span>
        </div>
        <div className="h-[72vh]">
          <PanZoom key={level.path} width={box.w} height={box.h} onZoomPast={onZoomPast} svgRef={svgRef} background={level.kind === 'settlement' ? '#cfc3a1' : '#1a1714'}>
            {(k) => (
              <g transform={`translate(${-box.x} ${-box.y})`}>
                <LevelArt level={level} world={world} zoom={k} unit={unit} items={items} onPick={(id) => setSelection({ kind: 'place', id })} onEnter={go} selected={selection?.id} />
                {ppl.filter((p) => !(level.kind === 'settlement' && p.inside && k < 2.5 && selection?.id !== p.id)).map((p) => (
                  <g key={p.id} transform={`translate(${p.x} ${p.y})`} onClick={() => setSelection({ kind: 'npc', id: p.id })} className="cursor-pointer">
                    <circle r={(level.kind === 'settlement' ? 5 : 7) * unit * 1.6 / Math.sqrt(k)} fill={NPC_STATE_COLOR[p.state]} stroke={selection?.id === p.id ? '#d4a24c' : '#1a1714'} strokeWidth={(selection?.id === p.id ? 3 : 1.5) * unit / Math.sqrt(k)} />
                    {p.state === 'Dead' && <text textAnchor="middle" dy="0.35em" fontSize={8 * unit / Math.sqrt(k)} fill="#e7d9bf">✕</text>}
                    {(k > 4 || selection?.id === p.id || level.kind === 'building' || level.kind === 'site') && (
                      <text y={-12 * unit / Math.sqrt(k)} textAnchor="middle" fontSize={11 * unit / k * 1.4} fill="#1a1714" stroke="#efe6d4" strokeWidth={3 * unit / k} paintOrder="stroke">
                        {p.name.split(' ')[0]} · {p.role}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )}
          </PanZoom>
        </div>
      </div>

      <div className="space-y-4">
        <Card
          title={levelTitle(level, world, save)}
          actions={
            level.kind === 'world' ? (
              <Button size="sm" variant="danger" onClick={async () => (await dialog.confirm({ title: 'Generate a new world?', message: 'Your edits to this world will be lost. Export a save first if you want to keep it.', confirmLabel: 'New world', danger: true })) && onRegenerate(Math.floor(Math.random() * 1_000_000))} icon={Shuffle}>New world</Button>
            ) : undefined
          }
        >
          {level.kind === 'world' ? (
            <p className="text-sm text-muted">Seed {save.seed} · {world.regions.length} regions. Click a region or zoom into it.</p>
          ) : (
            currentPlaceId && (
              <div className="space-y-2">
                <Field label="Name"><input className="input" value={current?.name ?? levelTitle(level, world, save)} onChange={(e) => setPlace(currentPlaceId, { name: e.target.value })} /></Field>
                <Field label="State"><StateSelect value={current?.state ?? 'Normal'} options={PLACE_STATES} onChange={(v) => setPlace(currentPlaceId, { state: v as PlaceState })} /></Field>
                <Field label="GM notes"><textarea className="input min-h-16" value={current?.notes ?? ''} onChange={(e) => setPlace(currentPlaceId, { notes: e.target.value })} /></Field>
              </div>
            )
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={addNpc} icon={UserPlus}>Add NPC here</Button>
            {(level.kind === 'building' || level.kind === 'site') && (
              <Button size="sm" onClick={useAsBattleMap} icon={Swords}>Use as battle map</Button>
            )}
          </div>
        </Card>

        {selectedPerson && (
          <Card title={<span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: NPC_STATE_COLOR[selectedPerson.state] }} />{selectedPerson.name}</span>}>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name"><input className="input" value={selectedPerson.name} onChange={(e) => setNpc(selectedPerson.id, { name: e.target.value })} /></Field>
                <Field label="Role"><input className="input" value={selectedPerson.role} onChange={(e) => setNpc(selectedPerson.id, { role: e.target.value })} /></Field>
              </div>
              <Field label="State"><StateSelect value={selectedPerson.state} options={MAP_NPC_STATES} onChange={(v) => setNpc(selectedPerson.id, { state: v as MapNpcState })} /></Field>
              {selectedPerson.trait && <p className="text-sm"><span className="text-muted">Quirk:</span> {selectedPerson.trait}</p>}
              {selectedPerson.secret && <p className="text-sm"><span className="text-muted">Secret:</span> {selectedPerson.secret}</p>}
              <Field label="GM notes"><textarea className="input min-h-16" value={selectedPerson.notes} onChange={(e) => setNpc(selectedPerson.id, { notes: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => sendToNpcs(selectedPerson)} icon={Send}>Talk (open in NPCs)</Button>
                {selectedPerson.custom && (
                  <Button size="sm" variant="danger" aria-label="Delete NPC" icon={Trash2} onClick={() => { edit((d) => void (d.world && (d.world.customNpcs = d.world.customNpcs.filter((c) => c.id !== selectedPerson.id)))); setSelection(null) }}>
                    </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {selectedPlace && (
          <Card title={selectedPlace.name}>
            <div className="space-y-2">
              <Badge>{selectedPlace.sub}</Badge>
              {selectedPlace.detail && <p className="text-sm">{selectedPlace.detail}</p>}
              <Field label="Name"><input className="input" value={selectedPlace.name} onChange={(e) => setPlace(selectedPlace.id, { name: e.target.value })} /></Field>
              <Field label="State"><StateSelect value={selectedPlace.state} options={PLACE_STATES} onChange={(v) => setPlace(selectedPlace.id, { state: v as PlaceState })} /></Field>
              <Field label="GM notes"><textarea className="input min-h-16" value={selectedPlace.notes} onChange={(e) => setPlace(selectedPlace.id, { notes: e.target.value })} /></Field>
              {selectedPlace.enter && (
                <Button variant="primary" size="sm" onClick={() => go(selectedPlace.enter!)} icon={MapPin}>Go inside</Button>
              )}
            </div>
          </Card>
        )}

        <Card title={level.kind === 'world' ? 'Regions' : level.kind === 'region' ? 'Places' : level.kind === 'settlement' ? 'Shops & landmarks' : 'Rooms'}>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {items.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setSelection({ kind: 'place', id: p.id })} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left ${selection?.id === p.id ? 'bg-gold/15 text-gold' : 'hover:bg-panel-2'}`}>
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted">{p.state !== 'Normal' ? p.state : p.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {ppl.length > 0 && (
          <Card title={`People here (${ppl.length})`}>
            <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {ppl.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setSelection({ kind: 'npc', id: p.id })} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${selection?.id === p.id ? 'bg-gold/15 text-gold' : 'hover:bg-panel-2'}`}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: NPC_STATE_COLOR[p.state] }} />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted">{p.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

function StateSelect({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
}

function Label({ x, y, text, size, color = '#1a1714', halo = '#efe6d4', bold }: { x: number; y: number; text: string; size: number; color?: string; halo?: string; bold?: boolean }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={size} fontFamily="Cinzel, serif" fontWeight={bold ? 700 : 600} fill={color} stroke={halo} strokeWidth={size / 4} paintOrder="stroke" pointerEvents="none">
      {text}
    </text>
  )
}

function LevelArt({ level, world, zoom, unit, items, onPick, onEnter, selected }: {
  level: Level; world: World; zoom: number; unit: number; items: PlaceItem[]; onPick: (id: string) => void; onEnter: (path: string) => void; selected?: string
}) {
  const s = (n: number) => (n * unit) / Math.sqrt(zoom)
  const byId = new Map(items.map((i) => [i.id, i]))

  if (level.kind === 'world') {
    const img = terrainImage(world, [0, 0, 1000, 640], 800)
    return (
      <>
        <image href={img} x={0} y={0} width={1000} height={640} preserveAspectRatio="none" style={{ imageRendering: 'auto' }} />
        {world.regions.map((r) => {
          const it = byId.get(r.id)!
          return (
            <g key={r.id} className="cursor-pointer" onClick={() => onPick(r.id)} onDoubleClick={() => onEnter(r.id)}>
              <circle cx={r.x} cy={r.y} r={s(22)} fill="transparent" />
              {r.capital && <Crown x={r.x - s(9)} y={r.y - s(30)} size={s(18)} color="#facc15" strokeWidth={2.5} />}
              <Label x={r.x} y={r.y} text={it.name} size={s(15)} color={selected === r.id ? '#b45309' : '#1a1714'} bold />
              {it.state !== 'Normal' && <Label x={r.x} y={r.y + s(16)} text={it.state} size={s(10)} color={PLACE_STATE_COLOR[it.state]} halo="#1a1714" />}
            </g>
          )
        })}
      </>
    )
  }

  if (level.kind === 'region') {
    const [x0, y0, x1, y1] = level.region.bbox
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08
    const bb: [number, number, number, number] = [x0 - pad, y0 - pad, x1 + pad, y1 + pad]
    const img = terrainImage(world, bb, 900, level.region.id)
    return (
      <>
        <image href={img} x={bb[0]} y={bb[1]} width={bb[2] - bb[0]} height={bb[3] - bb[1]} preserveAspectRatio="none" />
        {level.map.roads.map((road, i) => (
          <polyline key={i} points={road.map((p) => p.join(',')).join(' ')} fill="none" stroke="#5c4127" strokeWidth={s(3)} strokeDasharray={`${s(8)} ${s(5)}`} strokeLinecap="round" />
        ))}
        {level.map.places.map((p) => {
          const it = byId.get(p.id)!
          const Icon = p.kind === 'settlement' ? SETTLEMENT_ICON[p.type] : SITE_ICON[p.type]
          const size = s(p.kind === 'settlement' ? (p.type === 'city' ? 26 : p.type === 'town' ? 21 : 17) : 17)
          const ring = PLACE_STATE_COLOR[it.state] || (p.kind === 'site' ? '#7f1d1d' : '#1a1714')
          return (
            <g key={p.id} className="cursor-pointer" onClick={() => onPick(p.id)} onDoubleClick={() => onEnter(p.id)}>
              <circle cx={p.x} cy={p.y} r={size * 0.75} fill={p.kind === 'site' ? '#2a1515' : '#efe6d4'} stroke={selected === p.id ? '#d4a24c' : ring} strokeWidth={s(selected === p.id ? 4 : 2)} />
              <Icon x={p.x - size / 2} y={p.y - size / 2} size={size} color={p.kind === 'site' ? '#fca5a5' : '#1a1714'} strokeWidth={2} />
              <Label x={p.x} y={p.y + size * 1.4} text={it.name} size={s(p.kind === 'settlement' && p.type !== 'village' ? 14 : 11)} />
            </g>
          )
        })}
      </>
    )
  }

  if (level.kind === 'settlement') {
    const m = level.map
    return (
      <>
        {m.fields.map((f, i) => (
          <rect key={i} x={f.x - f.w / 2} y={f.y - f.h / 2} width={f.w} height={f.h} transform={`rotate(${f.angle} ${f.x} ${f.y})`} fill={i % 3 ? '#b6b77a' : '#a3a86a'} stroke="#8d8a5a" strokeWidth={1} />
        ))}
        {m.roads.map((road, i) => (
          <polyline key={i} points={road.map((p) => p.join(',')).join(' ')} fill="none" stroke="#a8946c" strokeWidth={i < (m.type === 'city' ? 6 : m.type === 'town' ? 4 : 3) ? 13 : 9} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {m.wall && <polygon points={m.wall.map((p) => p.join(',')).join(' ')} fill="none" stroke="#4a3f35" strokeWidth={9} strokeLinejoin="round" />}
        {m.buildings.map((b) => {
          const it = b.poi ? byId.get(b.id) : undefined
          const state = it?.state ?? 'Normal'
          return (
            <rect
              key={b.id}
              x={b.x - b.w / 2}
              y={b.y - b.h / 2}
              width={b.w}
              height={b.h}
              transform={`rotate(${b.angle} ${b.x} ${b.y})`}
              fill={b.poi === 'market' ? '#d6c89a' : state === 'Destroyed' ? '#3f3a35' : b.poi ? POI_COLOR[b.poi] : '#8b6b4a'}
              fillOpacity={b.poi && b.poi !== 'market' ? 0.85 : 1}
              stroke={selected === b.id ? '#d4a24c' : '#3b2a1a'}
              strokeWidth={selected === b.id ? 4 : 1.2}
              className="cursor-pointer"
              onClick={() => (b.poi ? onPick(b.id) : onEnter(b.id))}
              onDoubleClick={() => onEnter(b.id)}
            />
          )
        })}
        {m.buildings.filter((b) => b.poi).map((b) => {
          const it = byId.get(b.id)!
          const Icon = POI_ICON[b.poi!]
          const size = s(b.poi === 'market' ? 30 : 20)
          return (
            <g key={`${b.id}-icon`} className="cursor-pointer" onClick={() => onPick(b.id)} onDoubleClick={() => onEnter(b.id)}>
              <circle cx={b.x} cy={b.y} r={size * 0.72} fill="#efe6d4" stroke={PLACE_STATE_COLOR[it.state] || POI_COLOR[b.poi!]} strokeWidth={s(3)} />
              <Icon x={b.x - size / 2.4} y={b.y - size / 2.4} size={size / 1.2} color="#1a1714" strokeWidth={2.2} />
              {zoom > 1.8 && <Label x={b.x} y={b.y + size * 1.25} text={it.name} size={s(12)} />}
            </g>
          )
        })}
      </>
    )
  }

  // Interiors: buildings and dungeons on a 20px grid
  const I = level.interior
  const T = 20
  const floor = level.kind === 'site' ? '#3b342c' : '#d9c9a3'
  const wall = level.kind === 'site' ? '#0f0d0b' : '#4a3426'
  return (
    <>
      <defs>
        <pattern id="tile" width={T} height={T} patternUnits="userSpaceOnUse">
          <path d={`M ${T} 0 L 0 0 0 ${T}`} fill="none" stroke={level.kind === 'site' ? '#57504a' : '#bba67c'} strokeWidth={0.8} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={I.cols * T} height={I.rows * T} fill={level.kind === 'site' ? '#0f0d0b' : '#6b5844'} />
      {I.corridors.map(([ax, ay, bx, by], i) => (
        <line key={i} x1={ax * T + T / 2} y1={ay * T + T / 2} x2={bx * T + T / 2} y2={by * T + T / 2} stroke={floor} strokeWidth={T} strokeLinecap="square" />
      ))}
      {I.rooms.map((r) => {
        const it = byId.get(r.id)!
        return (
          <g key={r.id} className="cursor-pointer" onClick={() => onPick(r.id)}>
            <rect x={r.x * T} y={r.y * T} width={r.w * T} height={r.h * T} fill={floor} stroke={selected === r.id ? '#d4a24c' : wall} strokeWidth={selected === r.id ? 5 : 4} />
            <rect x={r.x * T} y={r.y * T} width={r.w * T} height={r.h * T} fill="url(#tile)" />
            {it.state !== 'Normal' && <rect x={r.x * T} y={r.y * T} width={r.w * T} height={r.h * T} fill={PLACE_STATE_COLOR[it.state]} fillOpacity={0.25} />}
            <Label x={(r.x + r.w / 2) * T} y={(r.y + r.h / 2) * T + 5} text={level.kind === 'site' ? r.label : it.name} size={level.kind === 'site' ? 18 : 13} color={level.kind === 'site' ? '#efe6d4' : '#1a1714'} halo={level.kind === 'site' ? '#0f0d0b' : '#efe6d4'} />
          </g>
        )
      })}
      {I.corridors.map(([ax, ay, bx, by], i) => (
        <line key={`g${i}`} x1={ax * T + T / 2} y1={ay * T + T / 2} x2={bx * T + T / 2} y2={by * T + T / 2} stroke="url(#tile)" strokeWidth={T} strokeLinecap="square" pointerEvents="none" />
      ))}
      {I.doors.map(([x, y], i) => (
        <rect key={i} x={x * T - 6} y={y * T - 6} width={12} height={12} fill="#8b5a2b" stroke="#2b1a0e" strokeWidth={1.5} />
      ))}
    </>
  )
}
