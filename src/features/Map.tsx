import { Globe, Grid3x3 } from 'lucide-react'
import { useUi } from '../store/ui'
import { BattleMap } from './battle/BattleMap'
import { WorldMap } from './world/WorldMap'

export function MapTab() {
  const mode = useUi((s) => s.mapMode)
  const setMode = useUi((s) => s.setMapMode)
  return (
    <div className="space-y-3">
      <div className="inline-flex overflow-hidden rounded-md border border-edge text-sm">
        {([
          ['world', 'World map', Globe],
          ['battle', 'Battle map', Grid3x3],
        ] as const).map(([m, label, Icon]) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${mode === m ? 'bg-gold text-ink' : 'hover:bg-panel-2'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {mode === 'world' ? <WorldMap /> : <BattleMap />}
    </div>
  )
}
