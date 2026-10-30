import { Beer, CloudSun, Coins, Drama, Eye, Pin, ScrollText, User, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Button, Card } from '../components/ui'
import { FIRST_NAMES, LAST_NAMES, LOOT, NPC_TRAITS, PLOT_HOOKS, TAVERN_NAMES_A, TAVERN_NAMES_B, WEATHER } from '../data/homebrew'
import { pick, uid } from '../lib/util'
import { useGame } from '../store/game'

const GENERATORS: { name: string; icon: LucideIcon; make: () => string }[] = [
  { name: 'Name', icon: User, make: () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` },
  { name: 'Tavern', icon: Beer, make: () => `The ${pick(TAVERN_NAMES_A)} ${pick(TAVERN_NAMES_B)}` },
  { name: 'Loot', icon: Coins, make: () => pick(LOOT) },
  { name: 'Plot hook', icon: ScrollText, make: () => pick(PLOT_HOOKS) },
  { name: 'Weather', icon: CloudSun, make: () => pick(WEATHER) },
  { name: 'Quirk', icon: Drama, make: () => pick(NPC_TRAITS) },
  {
    name: 'Yes / No oracle',
    icon: Eye,
    make: () => pick(['Yes', 'Yes, and…', 'Yes, but…', 'No', 'No, and…', 'No, but…', 'Maybe. Roll again later.']),
  },
]

export function Generators() {
  const edit = useGame((s) => s.edit)
  const [results, setResults] = useState<{ id: string; kind: string; text: string }[]>([])

  function generate(g: (typeof GENERATORS)[number]) {
    setResults((r) => [{ id: uid(), kind: g.name, text: g.make() }, ...r].slice(0, 30))
  }

  function saveToNotes(text: string, kind: string) {
    edit((d) => void d.notes.push({ id: uid(), title: `${kind}: ${text.slice(0, 40)}`, body: text, tags: `generated, ${kind.toLowerCase()}`, updatedAt: Date.now() }))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card title="Quick generators">
        <p className="mb-3 text-sm text-muted">For when the players ask the name of a random guard. Edit the lists in src/data/homebrew.ts.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GENERATORS.map((g) => (
            <button key={g.name} type="button" onClick={() => generate(g)} className="rounded-xl border border-edge bg-panel-2/60 p-3 text-left transition hover:-translate-y-0.5 hover:border-gold">
              <g.icon size={24} className="text-gold" />
              <div className="mt-1 text-sm font-semibold">{g.name}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Results" actions={results.length > 0 && <Button size="sm" variant="subtle" onClick={() => setResults([])}>Clear</Button>}>
        {results.length === 0 && <p className="text-sm text-muted">Click a generator.</p>}
        <ul className="space-y-2">
          {results.map((r, i) => (
            <li key={r.id} className={`flex items-start justify-between gap-2 rounded-lg border border-edge bg-panel-2/60 p-2.5 ${i === 0 ? 'tumble' : ''}`}>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted">{r.kind}</div>
                <div>{r.text}</div>
              </div>
              <Button size="sm" variant="subtle" onClick={() => saveToNotes(r.text, r.kind)} title="Save to notes" aria-label="Save to notes" icon={Pin} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
