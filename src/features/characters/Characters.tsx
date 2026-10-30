import { Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Button, Empty } from '../../components/ui'
import { useGame } from '../../store/game'
import { CharacterCreator } from './CharacterCreator'
import { CharacterSheet } from './CharacterSheet'

export function Characters() {
  const characters = useGame((s) => s.characters)
  const activeId = useGame((s) => s.activeCharacterId)
  const edit = useGame((s) => s.edit)
  const [creating, setCreating] = useState(false)

  const active = characters.find((c) => c.id === activeId) ?? characters[0]

  if (creating) return <CharacterCreator onDone={() => setCreating(false)} />

  function remove(id: string, name: string) {
    if (!confirm(`Delete ${name}? This can't be undone (unless you have a save).`)) return
    edit((d) => {
      d.characters = d.characters.filter((c) => c.id !== id)
      if (d.activeCharacterId === id) d.activeCharacterId = d.characters[0]?.id ?? null
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {characters.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => edit((d) => void (d.activeCharacterId = c.id))}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${active?.id === c.id ? 'border-gold bg-gold/10' : 'border-edge hover:border-gold/50'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.name}
            <span className="text-xs text-muted">
              {c.className || '—'} {c.level}
            </span>
          </button>
        ))}
        <Button variant="primary" onClick={() => setCreating(true)} icon={UserPlus}>New character</Button>
        {active && (
          <Button variant="danger" size="sm" className="ml-auto" onClick={() => remove(active.id, active.name)} icon={Trash2}>
            Delete {active.name}
          </Button>
        )}
      </div>
      {active ? <CharacterSheet key={active.id} c={active} /> : <Empty>No heroes yet. Create one to begin your legend.</Empty>}
    </div>
  )
}
