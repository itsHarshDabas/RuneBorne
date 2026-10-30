import { Download, Save, Upload } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Field, NumberInput } from '../components/ui'
import { downloadJson } from '../lib/util'
import { pickData, useGame, type GameData, type Settings } from '../store/game'
import { dialog } from '../lib/dialog'

const SLOTS_KEY = 'runeborne-slots'
type Slot = { name: string; savedAt: number; data: GameData }

function readSlots(): Slot[] {
  try {
    return JSON.parse(localStorage.getItem(SLOTS_KEY) ?? '[]') as Slot[]
  } catch {
    return []
  }
}

export function Saves() {
  const game = useGame()
  const [slots, setSlots] = useState<Slot[]>(readSlots)
  const [message, setMessage] = useState('')

  function writeSlots(next: Slot[]) {
    try {
      localStorage.setItem(SLOTS_KEY, JSON.stringify(next))
      setSlots(next)
      return true
    } catch {
      setMessage('Browser storage is full. Export to a file instead, or delete old slots / remove the map image.')
      return false
    }
  }

  async function saveSlot() {
    const name = await dialog.prompt({ title: 'Name this save', defaultValue: `${game.campaignName} · ${new Date().toLocaleDateString()}` })
    if (!name) return
    if (writeSlots([{ name, savedAt: Date.now(), data: pickData(game) }, ...slots])) setMessage(`Saved "${name}".`)
  }

  async function loadSlot(s: Slot) {
    if (!(await dialog.confirm({ title: `Load "${s.name}"?`, message: 'Unsaved progress in the current campaign will be replaced.', confirmLabel: 'Load' }))) return
    game.replaceAll(s.data)
    setMessage(`Loaded "${s.name}".`)
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as GameData
      if (data.version !== 1 || !Array.isArray(data.characters)) throw new Error('not a RuneBorne save')
      if (!(await dialog.confirm({ title: `Load "${data.campaignName}" from file?`, message: 'The current campaign will be replaced.', confirmLabel: 'Load' }))) return
      game.replaceAll(data)
      setMessage(`Imported "${data.campaignName}".`)
    } catch (e) {
      setMessage(`Could not import: ${(e as Error).message}`)
    }
  }

  const setSetting = <K extends keyof Settings>(k: K, v: Settings[K]) => game.edit((d) => void (d.settings[k] = v))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Campaign">
        <Field label="Campaign name">
          <input className="input" value={game.campaignName} onChange={(e) => game.edit((d) => void (d.campaignName = e.target.value))} />
        </Field>
        <p className="mt-2 text-xs text-muted">Everything saves automatically in this browser. Use slots for checkpoints and files to back up or share with another computer.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={saveSlot} icon={Save}>Save to slot</Button>
          <Button onClick={() => downloadJson(`${game.campaignName.replace(/[^\w-]+/g, '_') || 'campaign'}.runeborne.json`, pickData(game))} icon={Download}>Export file</Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-edge px-3 py-1.5 text-sm hover:border-gold hover:text-gold">
            <Upload size={15} /> Import file
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
          </label>
          <Button
            variant="danger"
            onClick={async () => {
              const name = await dialog.prompt({ title: 'Start a new campaign', message: 'Export or save first if you want to keep the current one.', defaultValue: 'New Campaign', confirmLabel: 'Create' })
              if (name) game.newCampaign(name)
            }}
          >
            New campaign
          </Button>
        </div>
        {message && <p className="mt-3 text-sm text-gold">{message}</p>}

        <h3 className="mt-6 mb-2 font-display text-gold">Save slots</h3>
        {slots.length === 0 ? (
          <p className="text-sm text-muted">No slots yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {slots.map((s, i) => (
              <li key={s.savedAt + s.name} className="flex items-center gap-2 rounded-md border border-edge bg-panel-2/60 px-2.5 py-1.5 text-sm">
                <div className="flex-1">
                  <div>{s.name}</div>
                  <div className="text-xs text-muted">{new Date(s.savedAt).toLocaleString()} · {s.data.characters.length} characters</div>
                </div>
                <Button size="sm" onClick={() => loadSlot(s)}>Load</Button>
                <Button size="sm" variant="danger" onClick={async () => (await dialog.confirm({ title: `Delete "${s.name}"?`, confirmLabel: 'Delete', danger: true })) && writeSlots(slots.filter((_, j) => j !== i))}>×</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="DM settings & house rules">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stat rerolls per character"><NumberInput value={game.settings.statRerolls} min={0} onChange={(n) => setSetting('statRerolls', Math.max(0, n))} /></Field>
          <Field label="Tarot redraws"><NumberInput value={game.settings.tarotRedraws} min={0} onChange={(n) => setSetting('tarotRedraws', Math.max(0, n))} /></Field>
          <Field label="Default spell learn DC"><NumberInput value={game.settings.learnDc} onChange={(n) => setSetting('learnDc', n)} /></Field>
          <div />
          <Field label="Spell power die"><input className="input font-mono" value={game.settings.powerDie} onChange={(e) => setSetting('powerDie', e.target.value)} /></Field>
          <Field label="Spell mana die"><input className="input font-mono" value={game.settings.manaDie} onChange={(e) => setSetting('manaDie', e.target.value)} /></Field>
        </div>
        <Field label="House rules" className="mt-3">
          <textarea className="input min-h-40" value={game.settings.houseRules} onChange={(e) => setSetting('houseRules', e.target.value)} placeholder="e.g. Critical fumbles break your weapon. Potions are a bonus action." />
        </Field>
        <p className="mt-4 text-xs text-muted">
          Rules content uses the System Reference Document 5.2 by Wizards of the Coast LLC, licensed under CC-BY-4.0. Tarot, bloodlines, mana and the Spell Forge are RuneBorne homebrew.
        </p>
      </Card>
    </div>
  )
}
