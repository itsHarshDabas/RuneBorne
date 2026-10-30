import { Backpack, Dices, Map as MapIcon, MessageCircle, Save, ScrollText, Shield, Sparkles, Swords, Wand, type LucideIcon } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { DialogHost } from './components/Dialog'
import { RollLog } from './components/RollLog'
import { Characters } from './features/characters/Characters'
import { Combat } from './features/Combat'
import { DiceTray } from './features/DiceTray'
import { Generators } from './features/Generators'
import { Items } from './features/items/Items'
import { Notes } from './features/Notes'
import { Npcs } from './features/Npcs'
import { Saves } from './features/Saves'
import { SpellForge } from './features/SpellForge'
import { useGame } from './store/game'
import { TABS, useUi, type Tab } from './store/ui'

// The map engine is the heaviest part of the app, so it loads when the Map tab is first opened
const MapTab = lazy(() => import('./features/Map').then((m) => ({ default: m.MapTab })))

const VIEWS: Record<Tab, React.ComponentType> = {
  Dice: DiceTray,
  Characters,
  'Spell Forge': SpellForge,
  NPCs: Npcs,
  Combat,
  Items,
  Map: MapTab,
  Notes,
  Generators,
  Saves,
}

const ICONS: Record<Tab, LucideIcon> = {
  Dice: Dices, Characters: Shield, 'Spell Forge': Sparkles, NPCs: MessageCircle, Combat: Swords, Items: Backpack, Map: MapIcon, Notes: ScrollText, Generators: Wand, Saves: Save,
}

export default function App() {
  const tab = useUi((s) => s.tab)
  const setTab = useUi((s) => s.setTab)
  const rollingAs = useUi((s) => s.rollingAs)
  const setRollingAs = useUi((s) => s.setRollingAs)
  const campaignName = useGame((s) => s.campaignName)
  const characters = useGame((s) => s.characters)
  const View = VIEWS[tab]

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-edge bg-ink/80 px-4 py-2 backdrop-blur">
        <h1 className="font-display text-2xl tracking-wide text-gold">RuneBorne</h1>
        <span className="hidden text-sm text-muted sm:inline">· {campaignName}</span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">Rolling as</span>
          <select className="input w-auto py-1" value={rollingAs} onChange={(e) => setRollingAs(e.target.value)}>
            <option>DM</option>
            {characters.map((c) => <option key={c.id}>{c.name}</option>)}
          </select>
        </label>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-edge bg-panel/60 px-2">
        {TABS.map((t) => {
          const Icon = ICONS[t]
          return (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm transition ${tab === t ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-parch'}`}
          >
            <Icon size={15} className="mr-1.5 inline -mt-0.5" />
            {t}
          </button>
          )
        })}
      </nav>
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <main className="min-w-0 flex-1 overflow-y-auto pb-8">
          <Suspense fallback={<p className="p-4 text-sm text-muted">Loading the map engine…</p>}>
            <View />
          </Suspense>
        </main>
        <div className="hidden w-72 shrink-0 2xl:w-80 lg:block">
          <RollLog />
        </div>
      </div>
      <DialogHost />
    </div>
  )
}
