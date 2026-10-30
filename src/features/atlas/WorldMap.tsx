import { ArrowLeft, ChevronRight, Globe, MapPin, Search, Send, Shuffle, Swords, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Field, NumberInput } from '../../components/ui'
import { ATTITUDES } from '../../data/homebrew'
import { dialog } from '../../lib/dialog'
import { uid } from '../../lib/util'
import { MAP_NPC_STATES, PLACE_STATES, useGame, type MapNpcState, type PlaceState, type WorldSave } from '../../store/game'
import { useUi } from '../../store/ui'
import { atlasArt, atlasScene } from './atlasScene'
import { generateCity, type City, type CityNpc, type Lot } from './citygen'
import { cityArt, cityScene, lotAt, NPC_STATE_COLOR, PLACE_STATE_COLOR } from './cityScene'
import { BURG_ICON, POI_ICON, SITE_ICON } from './icons'
import { PoiIconSprites } from './PoiIconSprites'
import { ShopCard } from '../items/ShopCard'
import { buildingInterior, interiorScene, lotTitle, placePeople, siteInterior, type Interior } from './interior'
import { MapCanvas, type Hit, type MapCanvasHandle, type Scene } from './MapCanvas'
import { POI_LABEL, type PoiType } from './pois'
import { generateAtlas, type Atlas, type Burg, type Site } from './worldgen'

// Four levels share one canvas viewer: the continent, a town plan, and the floor plan of a building or dungeon.
// Paths: '' (world), 'b12' (town), 'b12/h40' (building), 's3' (dungeon). GM edits are keyed by the same ids.

type Level =
  | { kind: 'world'; path: '' }
  | { kind: 'city'; path: string; burg: Burg; city: City }
  | { kind: 'building'; path: string; burg: Burg; city: City; lot: Lot; interior: Interior }
  | { kind: 'site'; path: string; site: Site; interior: Interior }

type Person = { id: string; name: string; role: string; state: MapNpcState; notes: string; x: number; y: number; custom: boolean; trait?: string; secret?: string }
type PlaceItem = { id: string; name: string; sub: string; state: PlaceState; notes: string; enter?: string; detail?: string; icon?: PoiType }
type Cam = { cx: number; cy: number; zoom: number }

const parentPath = (p: string) => p.split('/').slice(0, -1).join('/')

function resolve(atlas: Atlas, path: string): Level {
  const [head, child] = path.split('/')
  if (head?.startsWith('s')) {
    const site = atlas.sites.find((s) => s.id === head)
    if (site) return { kind: 'site', path: head, site, interior: siteInterior(atlas.seed, site) }
  }
  const burg = atlas.burgs.find((b) => b.id === head)
  if (!burg) return { kind: 'world', path: '' }
  const city = generateCity(atlas.seed, burg)
  if (child) {
    const lot = city.lots.find((l) => l.id === path)
    if (lot) return { kind: 'building', path, burg, city, lot, interior: buildingInterior(atlas.seed, lot) }
  }
  return { kind: 'city', path: burg.id, burg, city }
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
          RuneBorne builds a whole continent for you: realms, rivers, roads, cities and villages, dungeons, shops and the people who run them. Zoom or double-click to go from the continent down into a single tavern. The world is saved with your campaign, so it stays the same every time you open it.
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
  const atlas = useMemo(() => generateAtlas(save.seed), [save.seed])
  const [nav, setNav] = useState<{ path: string; dir: 'in' | 'out' | null; start: Cam | null }>({ path: '', dir: null, start: null })
  const [selected, setSelected] = useState<string | null>(null)
  const [showRealms, setShowRealms] = useState(true)
  const [icons, setIcons] = useState<Partial<Record<PoiType, HTMLImageElement>>>({})
  const [query, setQuery] = useState('')
  const mapRef = useRef<MapCanvasHandle>(null)
  const busy = useRef(false)

  const level = useMemo(() => resolve(atlas, nav.path), [atlas, nav.path])
  const nameOf = (id: string, fallback: string) => save.places[id]?.name || fallback

  // ---------- people and places on this level ----------
  const people = useMemo<Person[]>(() => {
    const merge = (p: { id: string; name: string; role: string; x: number; y: number; trait?: string; secret?: string }, custom: boolean): Person => {
      const e = save.npcs[p.id] ?? {}
      return { ...p, custom, name: e.name ?? p.name, role: e.role ?? p.role, state: e.state ?? 'Normal', notes: e.notes ?? '' }
    }
    const out: Person[] = []
    if (level.kind === 'city') for (const n of level.city.npcs) out.push(merge(n, false))
    if (level.kind === 'building') {
      const inside = level.city.npcs.filter((n) => n.placeId === level.lot.id)
      for (const n of placePeople<CityNpc>(level.interior, inside)) out.push(merge(n, false))
    }
    for (const c of save.customNpcs) if (c.at === level.path) out.push(merge(c, true))
    return out
  }, [level, save.npcs, save.customNpcs])

  const places = useMemo<PlaceItem[]>(() => {
    const merge = (p: Omit<PlaceItem, 'state' | 'notes'>): PlaceItem => {
      const e = save.places[p.id] ?? {}
      return { ...p, name: e.name || p.name, state: e.state ?? 'Normal', notes: e.notes ?? '' }
    }
    switch (level.kind) {
      case 'world': {
        const order = { capital: 0, city: 1, town: 2, village: 3 }
        const realm = (b: Burg) => atlas.realms[b.state]?.name
        return [
          ...[...atlas.burgs].sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name)).map((b) => merge({ id: b.id, name: b.name, sub: `${b.type}${realm(b) ? ` · ${nameOf(`realm${b.state}`, realm(b)!)}` : ''}`, enter: b.id })),
          ...atlas.sites.map((s) => merge({ id: s.id, name: s.name, sub: s.type, enter: s.id })),
        ]
      }
      case 'city':
        return [
          ...(level.city.plaza ? [merge({ id: `${level.burg.id}/market`, name: 'Market Square', sub: 'Market', icon: 'market' })] : []),
          ...level.city.lots.filter((l) => l.poi).map((l) => merge({ id: l.id, name: lotTitle(l), sub: POI_LABEL[l.poi!], enter: l.id, icon: l.poi })),
        ]
      case 'building':
      case 'site':
        return level.interior.rooms.map((r) => merge({ id: r.id, name: r.label, sub: 'Room', detail: r.detail }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, atlas, save.places])

  /** Any place the map can select, including ordinary houses and realms that are not in the list. */
  function placeById(id: string): PlaceItem | undefined {
    const listed = places.find((p) => p.id === id)
    if (listed) return listed
    const e = save.places[id] ?? {}
    const base = { state: e.state ?? 'Normal', notes: e.notes ?? '' }
    if (id.startsWith('realm')) {
      const r = atlas.realms[Number(id.slice(5))]
      if (r) return { ...base, id, name: e.name || r.name, sub: 'Realm' }
    }
    if (level.kind === 'city') {
      const lot = level.city.lots.find((l) => l.id === id)
      if (lot) return { ...base, id, name: e.name || lotTitle(lot), sub: lot.ward === 'farm' ? 'Farmstead' : 'Building', enter: id }
    }
    return undefined
  }

  // ---------- the scene ----------
  const scene: Scene = useMemo(() => {
    const names: Record<string, string> = {}
    const states: Record<string, string> = {}
    for (const [id, e] of Object.entries(save.places)) {
      if (e.name) names[id] = e.name
      if (e.state && e.state !== 'Normal') states[id] = e.state
    }
    const npcStates: Record<string, string> = {}
    for (const [id, e] of Object.entries(save.npcs)) if (e.state) npcStates[id] = e.state
    if (level.kind === 'world') return atlasScene(atlas, atlasArt(atlas), { selected, names, states, showRealms })
    if (level.kind === 'city') {
      const extraNpcs = people.filter((p) => p.custom)
      return cityScene(level.city, cityArt(level.city), { selected, names, placeStates: states, npcStates, icons, extraNpcs })
    }
    return interiorScene(level.interior, {
      selected, names, roomStates: states, numbered: level.kind === 'site',
      people: people.map((p) => ({ id: p.id, x: p.x, y: p.y, name: p.name.split(' ')[0], color: NPC_STATE_COLOR[p.state] ?? NPC_STATE_COLOR.Normal })),
    })
  }, [level, atlas, selected, save.places, save.npcs, showRealms, icons, people])

  // ---------- moving between levels ----------
  /** Where a child path sits inside the current level's scene. */
  function spotOf(path: string): [number, number] | null {
    if (level.kind === 'world') {
      const b = atlas.burgs.find((x) => x.id === path) ?? atlas.sites.find((x) => x.id === path)
      return b ? [b.x, b.y] : null
    }
    if (level.kind === 'city') {
      const l = level.city.lots.find((x) => x.id === path)
      return l ? [l.cx, l.cy] : null
    }
    return null
  }

  async function enter(path: string) {
    if (busy.current || path === level.path) return
    busy.current = true
    const at = spotOf(path)
    if (at && mapRef.current) await mapRef.current.flyTo(at[0], at[1], scene.maxZoom * 1.3, 480)
    setSelected(null)
    setQuery('')
    setNav({ path, dir: 'in', start: null })
    busy.current = false
  }

  function leaveTo(path: string) {
    if (path === level.path) return
    // Arrive in the parent zoomed in on where we came from, then ease out
    const from = level.path.split('/')
    const parts = path ? path.split('/').length : 0
    const child = from.slice(0, parts + 1).join('/')
    const parent = resolve(atlas, path)
    let start: Cam | null = null
    if (parent.kind === 'world') {
      const b = atlas.burgs.find((x) => x.id === child) ?? atlas.sites.find((x) => x.id === child)
      if (b) start = { cx: b.x, cy: b.y, zoom: 7 }
    } else if (parent.kind === 'city') {
      const l = parent.city.lots.find((x) => x.id === child)
      if (l) start = { cx: l.cx, cy: l.cy, zoom: 5 }
    }
    setSelected(child || null)
    setQuery('')
    setNav({ path, dir: 'out', start })
  }

  function onZoomPast(dir: 'in' | 'out', x: number, y: number) {
    if (dir === 'out') {
      if (level.path) leaveTo(parentPath(level.path))
      return
    }
    if (level.kind === 'world') {
      const v = mapRef.current?.getView()
      const tol = 40 / (v?.k ?? 1)
      const near = [...atlas.burgs, ...atlas.sites].map((p) => ({ id: p.id, d: Math.hypot(p.x - x, p.y - y) })).sort((a, b) => a.d - b.d)[0]
      if (near && near.d < tol) void enter(near.id)
    } else if (level.kind === 'city') {
      const lot = lotAt(level.city, [x, y])
      if (lot) void enter(lot.id)
    }
  }

  function onPick(hit: Hit | null) {
    setSelected(hit?.id ?? null)
  }

  // ---------- GM edits ----------
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
    const v = mapRef.current?.getView()
    const x = v ? (v.w / 2 - v.ox) / v.k : scene.width / 2
    const y = v ? (v.h / 2 - v.oy) / v.k : scene.height / 2
    edit((d) => void d.world?.customNpcs.push({ id, at: level.path, x, y, name: 'New character', role: 'Wanderer' }))
    setSelected(id)
  }

  const crumbs = useMemo(() => {
    const out: { path: string; label: string }[] = [{ path: '', label: atlas.name }]
    const parts = level.path.split('/').filter(Boolean)
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join('/')
      const l = resolve(atlas, p)
      const label = l.kind === 'city' ? nameOf(p, l.burg.name) : l.kind === 'site' ? nameOf(p, l.site.name) : l.kind === 'building' ? nameOf(p, lotTitle(l.lot)) : ''
      out.push({ path: p, label })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, atlas, save.places])

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

  function toBattleMap() {
    if (level.kind !== 'building' && level.kind !== 'site') return
    const it = level.interior
    edit((d) => {
      d.map.image = ''
      d.map.gen = { preset: it.preset, seed: it.seed }
      d.map.cols = it.cols
      d.map.rows = it.rows
      d.map.showGrid = true
      for (const t of d.map.tokens) {
        t.x = Math.min(Math.max(t.x, t.size / 2), it.cols - t.size / 2)
        t.y = Math.min(Math.max(t.y, t.size / 2), it.rows - t.size / 2)
      }
    })
    useUi.getState().setMapMode('battle')
  }

  const selPerson = selected ? people.find((p) => p.id === selected) : undefined
  const selPlace = selected && !selPerson ? placeById(selected) : undefined
  const title = crumbs[crumbs.length - 1].label
  const shop = (() => {
    if (level.kind === 'building' && level.lot.poi) return { id: level.lot.id, poi: level.lot.poi, town: level.burg.type, title }
    if (level.kind !== 'city' || !selected) return null
    if (selected === `${level.burg.id}/market`) return { id: selected, poi: 'market', town: level.burg.type, title: nameOf(selected, 'Market Square') }
    const lot = level.city.lots.find((l) => l.id === selected)
    return lot?.poi ? { id: lot.id, poi: lot.poi, town: level.burg.type, title: nameOf(lot.id, lotTitle(lot)) } : null
  })()
  const q = query.trim().toLowerCase()
  const shownPlaces = q ? places.filter((p) => p.name.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q)) : places
  const shownPeople = q ? people.filter((p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)) : people
  const hint = level.kind === 'world' ? 'Scroll to zoom · drag to pan · double-click a town or dungeon to go in' : level.kind === 'city' ? 'Double-click any building to go inside · zoom out past the edge to leave' : 'Click rooms and people · zoom out past the edge to leave'

  function iconFor(p: PlaceItem) {
    if (p.icon) return POI_ICON[p.icon]
    const b = atlas.burgs.find((x) => x.id === p.id)
    if (b) return BURG_ICON[b.type]
    const s = atlas.sites.find((x) => x.id === p.id)
    return s ? SITE_ICON[s.type] : MapPin
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <PoiIconSprites onReady={setIcons} />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => leaveTo(parentPath(level.path))} disabled={!level.path} title="Up one level" aria-label="Up one level" icon={ArrowLeft} />
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={14} className="text-muted" />}
                <button type="button" onClick={() => leaveTo(c.path)} className={i === crumbs.length - 1 ? 'font-display text-gold' : 'text-muted hover:text-parch'}>
                  {c.label}
                </button>
              </span>
            ))}
          </nav>
          <span className="ml-auto text-xs text-muted">{hint}</span>
        </div>
        <div className="h-[72vh]">
          <MapCanvas ref={mapRef} scene={scene} transition={nav.dir} start={nav.start} onPick={onPick} onEnter={(h) => h.enter && void enter(h.enter)} onZoomPast={onZoomPast} />
        </div>
      </div>

      <div className="space-y-4">
        <Card
          title={title}
          actions={level.kind === 'world' ? (
            <Button size="sm" variant="danger" onClick={async () => (await dialog.confirm({ title: 'Generate a new world?', message: 'Your edits to this world will be lost. Export a save first if you want to keep it.', confirmLabel: 'New world', danger: true })) && onRegenerate(Math.floor(Math.random() * 1_000_000))} icon={Shuffle}>New world</Button>
          ) : undefined}
        >
          {level.kind === 'world' ? (
            <div className="space-y-2 text-sm text-muted">
              <p>Seed {save.seed} · {atlas.realms.length} realms · {atlas.burgs.length} settlements · {atlas.sites.length} dungeons and ruins.</p>
              <label className="flex items-center gap-2 text-parch"><input type="checkbox" checked={showRealms} onChange={(e) => setShowRealms(e.target.checked)} /> Show realms and borders</label>
            </div>
          ) : (
            (
              <div className="space-y-2">
                {level.kind === 'city' && <p className="text-sm text-muted">{level.burg.type[0].toUpperCase() + level.burg.type.slice(1)} of {nameOf(`realm${level.burg.state}`, atlas.realms[level.burg.state]?.name ?? 'no realm')} · about {level.burg.population.toLocaleString()} people</p>}
                <Field label="Name"><input className="input" value={save.places[level.path]?.name ?? title} onChange={(e) => setPlace(level.path, { name: e.target.value })} /></Field>
                <Field label="State"><StateSelect value={save.places[level.path]?.state ?? 'Normal'} options={PLACE_STATES} onChange={(v) => setPlace(level.path, { state: v as PlaceState })} /></Field>
                <Field label="GM notes"><textarea className="input min-h-16" value={save.places[level.path]?.notes ?? ''} onChange={(e) => setPlace(level.path, { notes: e.target.value })} /></Field>
              </div>
            )
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={addNpc} icon={UserPlus}>Add NPC here</Button>
            {(level.kind === 'building' || level.kind === 'site') && <Button size="sm" onClick={toBattleMap} icon={Swords}>Use as battle map</Button>}
          </div>
        </Card>

        {selPerson && (
          <Card title={<span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: NPC_STATE_COLOR[selPerson.state] }} />{selPerson.name}</span>}>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name"><input className="input" value={selPerson.name} onChange={(e) => setNpc(selPerson.id, { name: e.target.value })} /></Field>
                <Field label="Role"><input className="input" value={selPerson.role} onChange={(e) => setNpc(selPerson.id, { role: e.target.value })} /></Field>
              </div>
              <Field label="State"><StateSelect value={selPerson.state} options={MAP_NPC_STATES} onChange={(v) => setNpc(selPerson.id, { state: v as MapNpcState })} /></Field>
              {selPerson.trait && <p className="text-sm"><span className="text-muted">Quirk:</span> {selPerson.trait}</p>}
              {selPerson.secret && <p className="text-sm"><span className="text-muted">Secret:</span> {selPerson.secret}</p>}
              <Field label="GM notes"><textarea className="input min-h-16" value={selPerson.notes} onChange={(e) => setNpc(selPerson.id, { notes: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => sendToNpcs(selPerson)} icon={Send}>Talk (open in NPCs)</Button>
                {selPerson.custom && (
                  <Button size="sm" variant="danger" aria-label="Delete NPC" icon={Trash2} onClick={() => { edit((d) => void (d.world && (d.world.customNpcs = d.world.customNpcs.filter((c) => c.id !== selPerson.id)))); setSelected(null) }} />
                )}
              </div>
            </div>
          </Card>
        )}

        {selPlace && selPlace.id !== level.path && (
          <Card title={selPlace.name}>
            <div className="space-y-2">
              <Badge>{selPlace.sub}</Badge>
              {selPlace.detail && <p className="text-sm">{selPlace.detail}</p>}
              <Field label="Name"><input className="input" value={selPlace.name} onChange={(e) => setPlace(selPlace.id, { name: e.target.value })} /></Field>
              <Field label="State"><StateSelect value={selPlace.state} options={PLACE_STATES} onChange={(v) => setPlace(selPlace.id, { state: v as PlaceState })} /></Field>
              <Field label="GM notes"><textarea className="input min-h-16" value={selPlace.notes} onChange={(e) => setPlace(selPlace.id, { notes: e.target.value })} /></Field>
              {selPlace.enter && <Button variant="primary" size="sm" onClick={() => void enter(selPlace.enter!)} icon={MapPin}>Go inside</Button>}
            </div>
          </Card>
        )}

        {shop && <ShopCard key={shop.id} worldSeed={save.seed} placeId={shop.id} poi={shop.poi} townType={shop.town} title={shop.title} />}

        <Card title={level.kind === 'world' ? 'Places' : level.kind === 'city' ? 'Shops & landmarks' : 'Rooms'}>
          {(places.length > 12 || people.length > 12) && (
            <label className="mb-2 flex items-center gap-2 rounded-md border border-edge bg-ink/40 px-2">
              <Search size={14} className="text-muted" />
              <input className="w-full bg-transparent py-1.5 text-sm outline-none" placeholder="Search places and people" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          )}
          <ul className="max-h-60 space-y-0.5 overflow-y-auto text-sm">
            {shownPlaces.map((p) => {
              const Icon = iconFor(p)
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => setSelected(p.id)} onDoubleClick={() => p.enter && void enter(p.enter)} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${selected === p.id ? 'bg-gold/15 text-gold' : 'hover:bg-panel-2'}`}>
                    <Icon size={14} className="shrink-0 text-muted" />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto shrink-0 text-xs capitalize" style={{ color: PLACE_STATE_COLOR[p.state] || undefined }}>{p.state !== 'Normal' ? p.state : <span className="text-muted">{p.sub}</span>}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>

        {people.length > 0 && (
          <Card title={`People here (${people.length})`}>
            <ul className="max-h-60 space-y-0.5 overflow-y-auto text-sm">
              {shownPeople.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setSelected(p.id)} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${selected === p.id ? 'bg-gold/15 text-gold' : 'hover:bg-panel-2'}`}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-ink" style={{ background: NPC_STATE_COLOR[p.state] }} />
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
