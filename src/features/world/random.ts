// Deterministic randomness: the same seed + path always produces the same map,
// so a world only needs its seed (plus GM edits) to be saved.

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type Rng = {
  next: () => number
  int: (min: number, max: number) => number
  pick: <T>(list: readonly T[]) => T
  chance: (p: number) => boolean
  range: (min: number, max: number) => number
}

export function makeRng(seed: number | string): Rng {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    range: (min, max) => min + next() * (max - min),
  }
}

/** Smooth 2D value noise with fractal octaves, continuous across the whole world. */
export function makeNoise(seed: number) {
  const perm = new Uint8Array(512)
  const rng = makeRng(seed)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  const lattice = (x: number, y: number) => perm[(perm[x & 255] + y) & 255] / 255
  const fade = (t: number) => t * t * (3 - 2 * t)

  function value(x: number, y: number) {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = fade(x - xi)
    const yf = fade(y - yi)
    const a = lattice(xi, yi)
    const b = lattice(xi + 1, yi)
    const c = lattice(xi, yi + 1)
    const d = lattice(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }

  return function fbm(x: number, y: number, octaves = 5): number {
    let total = 0
    let amp = 1
    let freq = 1
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      total += value(x * freq, y * freq) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return total / norm
  }
}
