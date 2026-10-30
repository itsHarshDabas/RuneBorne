// Small 2D geometry toolkit used by the world and city generators.

export type P = [number, number]
export type Poly = P[]

export const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1])
export const lerpP = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Chaikin corner cutting. Closed rings wrap around; open lines keep their end points. */
export function chaikin(pts: P[], iterations: number, closed: boolean): P[] {
  let out = pts
  for (let it = 0; it < iterations; it++) {
    if (out.length < 3) return out
    const next: P[] = []
    const n = out.length
    if (!closed) next.push(out[0])
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = out[i]
      const b = out[(i + 1) % n]
      next.push(lerpP(a, b, 0.25), lerpP(a, b, 0.75))
    }
    if (!closed) next.push(out[n - 1])
    out = next
  }
  return out
}

export function area(poly: Poly): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

export function centroid(poly: Poly): P {
  let x = 0
  let y = 0
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    const f = x1 * y2 - x2 * y1
    x += (x1 + x2) * f
    y += (y1 + y2) * f
    a += f
  }
  if (Math.abs(a) < 1e-9) return poly[0]
  return [x / (3 * a), y / (3 * a)]
}

export function pointInPoly(p: P, poly: Poly): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Splits a convex polygon with the infinite line through p in direction d. */
export function splitConvex(poly: Poly, p: P, d: P): [Poly, Poly] {
  const side = (q: P) => (q[0] - p[0]) * d[1] - (q[1] - p[1]) * d[0]
  const a: Poly = []
  const b: Poly = []
  for (let i = 0; i < poly.length; i++) {
    const u = poly[i]
    const v = poly[(i + 1) % poly.length]
    const su = side(u)
    const sv = side(v)
    if (su >= 0) a.push(u)
    if (su <= 0) b.push(u)
    if ((su > 0 && sv < 0) || (su < 0 && sv > 0)) {
      const t = su / (su - sv)
      const x = lerpP(u, v, t)
      a.push(x)
      b.push(x)
    }
  }
  return [a, b]
}

/** Shrinks a convex polygon by moving every edge inwards. Returns null when it collapses. */
export function insetConvex(poly: Poly, d: number | number[]): Poly | null {
  const n = poly.length
  if (n < 3) return null
  const ccw = area(poly) > 0
  const lines: { p: P; dir: P }[] = []
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const len = dist(a, b)
    if (len < 1e-9) continue
    const dir: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    // Inward normal depends on winding
    const nrm: P = ccw ? [-dir[1], dir[0]] : [dir[1], -dir[0]]
    const off = typeof d === 'number' ? d : d[i] ?? 0
    lines.push({ p: [a[0] + nrm[0] * off, a[1] + nrm[1] * off], dir })
  }
  const out: Poly = []
  for (let i = 0; i < lines.length; i++) {
    const l1 = lines[(i + lines.length - 1) % lines.length]
    const l2 = lines[i]
    const den = l1.dir[0] * l2.dir[1] - l1.dir[1] * l2.dir[0]
    if (Math.abs(den) < 1e-9) {
      out.push(l2.p)
      continue
    }
    const t = ((l2.p[0] - l1.p[0]) * l2.dir[1] - (l2.p[1] - l1.p[1]) * l2.dir[0]) / den
    out.push([l1.p[0] + l1.dir[0] * t, l1.p[1] + l1.dir[1] * t])
  }
  // Collapsed or flipped polygons are dropped
  if (out.length < 3 || Math.sign(area(out)) !== Math.sign(area(poly)) || Math.abs(area(out)) < 1) return null
  for (const q of out) if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) return null
  return out
}

export function longestEdge(poly: Poly): number {
  let best = 0
  let bi = 0
  for (let i = 0; i < poly.length; i++) {
    const l = dist(poly[i], poly[(i + 1) % poly.length])
    if (l > best) {
      best = l
      bi = i
    }
  }
  return bi
}

/** A tiny binary min-heap keyed by number. */
export class MinHeap {
  private keys: number[] = []
  private vals: number[] = []
  get size() {
    return this.keys.length
  }
  push(val: number, key: number) {
    this.keys.push(key)
    this.vals.push(val)
    let i = this.keys.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.keys[p] <= this.keys[i]) break
      this.swap(i, p)
      i = p
    }
  }
  pop(): number {
    const top = this.vals[0]
    const lk = this.keys.pop()!
    const lv = this.vals.pop()!
    if (this.keys.length) {
      this.keys[0] = lk
      this.vals[0] = lv
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < this.keys.length && this.keys[l] < this.keys[m]) m = l
        if (r < this.keys.length && this.keys[r] < this.keys[m]) m = r
        if (m === i) break
        this.swap(i, m)
        i = m
      }
    }
    return top
  }
  private swap(a: number, b: number) {
    ;[this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]
    ;[this.vals[a], this.vals[b]] = [this.vals[b], this.vals[a]]
  }
}

export function pathFrom(pts: P[], closed: boolean): Path2D {
  const p = new Path2D()
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)))
  if (closed) p.closePath()
  return p
}
