import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md'
}

const VARIANTS = {
  primary: 'bg-gold text-ink hover:bg-amber-400 font-semibold',
  ghost: 'border border-edge text-parch hover:border-gold hover:text-gold',
  danger: 'border border-blood/60 text-red-300 hover:bg-blood/20',
  subtle: 'bg-panel-2 text-parch hover:bg-edge',
}

export function Button({ variant = 'ghost', size = 'md', className = '', ...props }: ButtonProps) {
  const sizing = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  return (
    <button
      type="button"
      className={`rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-edge bg-panel/90 p-4 shadow-lg shadow-black/30 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-display text-lg text-gold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

const CUSTOM = '__custom'

/** Pick from a list, or choose "Homebrew…" and type anything. */
export function Combo({ value, onChange, options, placeholder, id }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; id: string }) {
  const [typing, setTyping] = useState(false)
  const showInput = typing || (value !== '' && !options.includes(value))
  return (
    <div className="flex gap-2">
      <select
        className="input"
        value={showInput ? CUSTOM : value}
        onChange={(e) => {
          const v = e.target.value
          setTyping(v === CUSTOM)
          onChange(v === CUSTOM ? '' : v)
        }}
      >
        <option value="">— choose —</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
        <option value={CUSTOM}>✏ Homebrew…</option>
      </select>
      {showInput && <input id={id} className="input" autoFocus value={value} placeholder={placeholder ?? 'Type your own'} onChange={(e) => onChange(e.target.value)} />}
    </div>
  )
}

export function NumberInput({ value, onChange, min, max, className = '' }: { value: number; onChange: (n: number) => void; min?: number; max?: number; className?: string }) {
  return (
    <input
      type="number"
      className={`input ${className}`}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border border-edge bg-panel-2 px-2 py-0.5 text-xs ${className}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-edge p-6 text-center text-sm text-muted">{children}</p>
}
