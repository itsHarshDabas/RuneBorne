// Simple SVG silhouettes for each die type.
const SHAPES: Record<number, string> = {
  4: '32,4 60,56 4,56',
  6: '8,8 56,8 56,56 8,56',
  8: '32,2 60,32 32,62 4,32',
  10: '32,2 60,26 50,58 14,58 4,26',
  12: '32,2 58,14 62,40 44,62 20,62 2,40 6,14',
  20: '32,2 59,17 59,47 32,62 5,47 5,17',
  100: '32,2 59,17 59,47 32,62 5,47 5,17',
}

export function DieShape({ sides, label, className = '' }: { sides: number; label?: string; className?: string }) {
  const points = SHAPES[sides] ?? SHAPES[20]
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <polygon points={points} fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
      <text x="32" y={sides === 4 ? 46 : 39} textAnchor="middle" fontSize={label && label.length > 3 ? 13 : 17} fontWeight={700} fill="currentColor" fontFamily="Cinzel, serif">
        {label ?? `d${sides}`}
      </text>
    </svg>
  )
}
