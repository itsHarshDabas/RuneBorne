import { useState } from 'react'
import { Button, Card, Empty, Field } from '../components/ui'
import { uid } from '../lib/util'
import { useGame } from '../store/game'
import { dialog } from '../lib/dialog'

export function Notes() {
  const notes = useGame((s) => s.notes)
  const edit = useGame((s) => s.edit)
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null)
  const [query, setQuery] = useState('')

  const note = notes.find((n) => n.id === selectedId)
  const q = query.toLowerCase()
  const shown = [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((n) => `${n.title} ${n.tags} ${n.body}`.toLowerCase().includes(q))

  function add() {
    const n = { id: uid(), title: `Session ${notes.length + 1}`, body: '', tags: 'session', updatedAt: Date.now() }
    edit((d) => void d.notes.push(n))
    setSelectedId(n.id)
  }

  function update(field: 'title' | 'body' | 'tags', value: string) {
    edit((d) => {
      const n = d.notes.find((x) => x.id === selectedId)
      if (n) {
        n[field] = value
        n.updatedAt = Date.now()
      }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card title="Campaign notes" actions={<Button size="sm" variant="primary" onClick={add}>+ New</Button>}>
        <input className="input mb-2" placeholder="Search notes, tags…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="max-h-[65vh] space-y-1 overflow-y-auto">
          {shown.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => setSelectedId(n.id)} className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${n.id === selectedId ? 'bg-gold/15 text-gold' : 'hover:bg-panel-2'}`}>
                <div className="truncate">{n.title || 'Untitled'}</div>
                <div className="truncate text-xs text-muted">{n.tags}</div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {note ? (
        <Card
          actions={
            <Button size="sm" variant="danger" onClick={async () => (await dialog.confirm({ title: `Delete "${note.title}"?`, confirmLabel: 'Delete', danger: true })) && (edit((d) => void (d.notes = d.notes.filter((x) => x.id !== note.id))), setSelectedId(null))}>
              Delete
            </Button>
          }
        >
          <input className="mb-3 w-full bg-transparent font-display text-2xl text-gold outline-none" value={note.title} onChange={(e) => update('title', e.target.value)} />
          <Field label="Tags (comma separated)" className="mb-3">
            <input className="input" value={note.tags} onChange={(e) => update('tags', e.target.value)} placeholder="session, npc, lore, quest" />
          </Field>
          <textarea className="input min-h-[50vh] font-mono leading-relaxed" value={note.body} onChange={(e) => update('body', e.target.value)} placeholder="What happened this session? Who did they anger? What did they steal?" />
          <p className="mt-1 text-right text-xs text-muted">Saved automatically · {new Date(note.updatedAt).toLocaleString()}</p>
        </Card>
      ) : (
        <Empty>Write down sessions, lore, quests and the terrible decisions your players make.</Empty>
      )}
    </div>
  )
}
