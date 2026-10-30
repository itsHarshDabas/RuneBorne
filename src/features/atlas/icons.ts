import {
  BedDouble, Beer, BookOpen, Building2, Castle, Church, Columns3, Crown, Cross, Fence, Flame, FlaskConical, Hammer, House, Landmark,
  Mountain, Shield, ShoppingBasket, Skull, Sparkles, Store, TowerControl, Users, Wheat, type LucideIcon,
} from 'lucide-react'
import type { PoiType } from './pois'
import type { BurgType, Site } from './worldgen'

export const POI_ICON: Record<PoiType, LucideIcon> = {
  tavern: Beer, inn: BedDouble, blacksmith: Hammer, general: ShoppingBasket, alchemist: FlaskConical, magic: Sparkles,
  library: BookOpen, temple: Church, shrine: Flame, guard: Shield, manor: Crown, bank: Landmark, stables: Fence,
  guild: Users, market: Store, farm: Wheat, house: House,
}
export const BURG_ICON: Record<BurgType, LucideIcon> = { capital: Crown, city: Castle, town: Building2, village: House }
export const SITE_ICON: Record<Site['type'], LucideIcon> = { dungeon: Skull, ruin: Columns3, cave: Mountain, tower: TowerControl, crypt: Cross }
