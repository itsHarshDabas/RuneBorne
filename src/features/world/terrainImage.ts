import { BIOME_COLORS, isLand, type World } from './generate'

const cache = new Map<string, string>()

/**
 * Paints terrain for a rectangle of the world into a data URL.
 * At world level, region borders are drawn; at region level, everything outside the region is dimmed.
 */
export function terrainImage(world: World, bbox: [number, number, number, number], pxWidth: number, focusRegion?: string): string {
  const key = `${world.seed}|${bbox.join(',')}|${pxWidth}|${focusRegion ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit

  const [x0, y0, x1, y1] = bbox
  const w = pxWidth
  const h = Math.round((pxWidth * (y1 - y0)) / (x1 - x0))
  const step = (x1 - x0) / w
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)

  // Region ids per pixel, used for borders and dimming
  const regionIds: (string | null)[] = new Array(w * h)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = x0 + px * step
      const y = y0 + py * step
      const biome = world.terrain.biome(x, y)
      const [r, g, b] = BIOME_COLORS[biome]
      // Hill shading from the slope towards the north-west light
      const hh = world.terrain.height(x, y)
      const shade = isLand(biome) ? 1 + (hh - world.terrain.height(x + step * 1.5, y + step * 1.5)) * 18 : 1 + (hh - 0.4) * 0.6
      const region = isLand(biome) ? world.regionAt(x, y)?.id ?? null : null
      regionIds[py * w + px] = region
      let k = Math.max(0.6, Math.min(1.35, shade))
      if (focusRegion && region !== focusRegion) k *= 0.45
      const i = (py * w + px) * 4
      img.data[i] = r * k
      img.data[i + 1] = g * k
      img.data[i + 2] = b * k
      img.data[i + 3] = 255
    }
  }

  if (!focusRegion) {
    for (let py = 0; py < h - 1; py++) {
      for (let px = 0; px < w - 1; px++) {
        const a = regionIds[py * w + px]
        if (!a) continue
        const right = regionIds[py * w + px + 1]
        const down = regionIds[(py + 1) * w + px]
        if ((right && right !== a) || (down && down !== a)) {
          const i = (py * w + px) * 4
          img.data[i] = 70
          img.data[i + 1] = 40
          img.data[i + 2] = 30
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}
