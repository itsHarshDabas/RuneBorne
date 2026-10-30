import { useEffect, useRef } from 'react'
import { POI_ICON } from './icons'
import type { PoiType } from './pois'

/**
 * Renders the place icons once, off screen, and turns them into images the canvas maps can draw.
 * Using the same lucide icons as the rest of the app keeps the map and the side panels consistent.
 */
export function PoiIconSprites({ onReady }: { onReady: (icons: Partial<Record<PoiType, HTMLImageElement>>) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const wrap = ref.current
    if (!wrap) return
    let alive = true
    const entries = [...wrap.querySelectorAll<SVGSVGElement>('svg[data-poi]')].map((svg) => {
      const img = new Image()
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`
      return [svg.dataset.poi as PoiType, img] as const
    })
    Promise.all(entries.map(([, img]) => img.decode().catch(() => undefined))).then(() => alive && onReady(Object.fromEntries(entries)))
    return () => void (alive = false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
      {(Object.keys(POI_ICON) as PoiType[]).map((k) => {
        const Icon = POI_ICON[k]
        return <Icon key={k} data-poi={k} size={48} color="#ffffff" strokeWidth={2.2} xmlns="http://www.w3.org/2000/svg" />
      })}
    </div>
  )
}
