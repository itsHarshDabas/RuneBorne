import { RollLog } from './components/RollLog'
import { Characters } from './features/characters/Characters'
import { Combat } from './features/Combat'
import { DiceTray } from './features/DiceTray'
import { Generators } from './features/Generators'
import { MapBoard } from './features/MapBoard'
import { Notes } from './features/Notes'
import { Npcs } from './features/Npcs'
import { Saves } from './features/Saves'
import { SpellForge } from './features/SpellForge'
import { useGame } from './store/game'
import { TABS, useUi, type Tab } from './store/ui'

const VIEWS: Record<Tab, () => React.JSX.Element> = {
  Dice: DiceTray,
  Characters,
  'Spell Forge': SpellForge,
  NPCs: Npcs,
  Combat,
  Map: MapBoard,
  Notes,
  Generators,
  Saves,
}

const ICONS: Record<Tab, string> = {
  Dice: '🎲', Characters: '🛡', 'Spell Forge': '✨', NPCs: '🗣', Combat: '⚔', Map: '🗺', Notes: '📜', Generators: '🔮', Saves: '💾',
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
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm transition ${tab === t ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-parch'}`}
          >
            <span className="mr-1">{ICONS[t]}</span>
            {t}
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <main className="min-w-0 flex-1 overflow-y-auto pb-8">
          <View />
        </main>
        <div className="hidden w-72 shrink-0 2xl:w-80 lg:block">
          <RollLog />
        </div>
      </div>
    </div>
  )
}
