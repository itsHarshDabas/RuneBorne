import { useGame } from '../store/game'
import { Button } from './ui'

export function RollLog() {
  const log = useGame((s) => s.log)
  const edit = useGame((s) => s.edit)

  return (
    <aside className="flex h-full flex-col rounded-xl border border-edge bg-panel/90">
      <header className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="font-display text-gold">Roll Log</h2>
        <Button size="sm" variant="subtle" onClick={() => edit((d) => void (d.log = []))} disabled={!log.length}>
          Clear
        </Button>
      </header>
      <ol className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {log.length === 0 && <li className="p-4 text-center text-sm text-muted">No rolls yet. Go on, tempt fate.</li>}
        {log.map((e) => (
          <li
            key={e.id}
            className={`rounded-lg border px-2.5 py-1.5 text-sm ${
              e.crit === 'hit' ? 'border-gold/70 bg-gold/10' : e.crit === 'miss' ? 'border-blood/70 bg-blood/10' : 'border-edge bg-panel-2/60'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs text-muted">
                <b className="text-parch">{e.who}</b>
                {e.label && ` · ${e.label}`}
              </span>
              <span className={`font-display text-lg ${e.crit === 'hit' ? 'text-gold' : e.crit === 'miss' ? 'text-red-400' : ''}`}>{e.total}</span>
            </div>
            <div className="truncate font-mono text-xs text-muted" title={`${e.expr} → ${e.detail}`}>
              {e.expr} → {e.detail}
              {e.crit === 'hit' && ' · NAT 20!'}
              {e.crit === 'miss' && ' · nat 1'}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}
