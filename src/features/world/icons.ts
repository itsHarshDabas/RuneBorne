import {
  Beer, BedDouble, BookOpen, Building2, Castle, Church, Columns3, Crown, Fence, Flame, FlaskConical, Hammer, Home, House, Landmark,
  Mountain, Shield, ShoppingBasket, Skull, Sparkles, Store, TowerControl, Users, Wheat, Cross, type LucideIcon,
} from 'lucide-react'
import type { PoiType, SettlementType, SiteType } from './generate'

export const POI_ICON: Record<PoiType, LucideIcon> = {
  tavern: Beer, inn: BedDouble, blacksmith: Hammer, general: ShoppingBasket, alchemist: FlaskConical, magic: Sparkles,
  library: BookOpen, temple: Church, shrine: Flame, guard: Shield, manor: Crown, bank: Landmark, stables: Fence,
  guild: Users, market: Store, farm: Wheat, house: House,
}

export const POI_COLOR: Record<PoiType, string> = {
  tavern: '#d97706', inn: '#b45309', blacksmith: '#57534e', general: '#65a30d', alchemist: '#0d9488', magic: '#7c3aed',
  library: '#2563eb', temple: '#e5e7eb', shrine: '#f59e0b', guard: '#b91c1c', manor: '#ca8a04', bank: '#a16207',
  stables: '#78716c', guild: '#0891b2', market: '#16a34a', farm: '#84cc16', house: '#8b6b4a',
}

export const SETTLEMENT_ICON: Record<SettlementType, LucideIcon> = { city: Castle, town: Building2, village: Home }
export const SITE_ICON: Record<SiteType, LucideIcon> = { dungeon: Skull, ruin: Columns3, cave: Mountain, tower: TowerControl, crypt: Cross }

export const NPC_STATE_COLOR: Record<string, string> = {
  Normal: '#e7d9bf', Friendly: '#4ade80', Hostile: '#ef4444', Away: '#94a3b8', Missing: '#a78bfa', Captured: '#f59e0b', Dead: '#44403c',
}

export const PLACE_STATE_COLOR: Record<string, string> = {
  Normal: '', Closed: '#94a3b8', Occupied: '#ef4444', Abandoned: '#78716c', Destroyed: '#1c1917', Cleared: '#4ade80', Hidden: '#a78bfa',
}
