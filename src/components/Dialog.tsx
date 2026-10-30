import { AlertTriangle, HelpCircle, PenLine, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDialogStore, type DialogRequest } from '../lib/dialog'
import { Button } from './ui'

/** Renders the active dialog. Mount once at the app root. */
export function DialogHost() {
  const current = useDialogStore((s) => s.queue[0])
  if (!current) return null
  return <DialogBox key={current.id} req={current} />
}

function DialogBox({ req }: { req: DialogRequest }) {
  const [value, setValue] = useState(req.defaultValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  function close(result: boolean | string | null) {
    req.resolve(result)
    useDialogStore.setState((s) => ({ queue: s.queue.slice(1) }))
  }
  const submit = () => close(req.kind === 'prompt' ? (value.trim() ? value.trim() : null) : true)
  const cancel = () => close(req.kind === 'prompt' ? null : false)

  useEffect(() => {
    if (req.kind === 'prompt') inputRef.current?.select()
    else okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const Icon = req.kind === 'prompt' ? PenLine : req.danger ? AlertTriangle : HelpCircle
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[fade-in_.12s_ease-out]" onMouseDown={(e) => e.target === e.currentTarget && cancel()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-md rounded-xl border border-edge bg-panel p-5 shadow-2xl shadow-black/60 animate-[pop-in_.14s_ease-out]"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 rounded-lg p-2 ${req.danger ? 'bg-blood/20 text-red-300' : 'bg-gold/15 text-gold'}`}>
            <Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="dialog-title" className="font-display text-lg text-gold">{req.title}</h2>
            {req.message && <p className="mt-1 text-sm text-muted">{req.message}</p>}
          </div>
          <button type="button" onClick={cancel} aria-label="Close" className="rounded p-1 text-muted hover:text-parch">
            <X size={16} />
          </button>
        </div>
        {req.kind === 'prompt' && <input ref={inputRef} className="input mt-4" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={cancel}>Cancel</Button>
          <button
            ref={okRef}
            type="submit"
            disabled={req.kind === 'prompt' && !value.trim()}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${req.danger ? 'bg-blood text-white hover:bg-red-600' : 'bg-gold text-ink hover:bg-amber-400'}`}
          >
            {req.confirmLabel ?? (req.kind === 'prompt' ? 'Save' : 'OK')}
          </button>
        </div>
      </form>
    </div>
  )
}
