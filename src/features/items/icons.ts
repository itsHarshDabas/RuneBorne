import { Backpack, BookOpen, Drumstick, Feather, FlaskRound, Gem, Map, ScrollText, Shield, Sword, WandSparkles, Wrench, type LucideIcon } from 'lucide-react'
import type { ItemKind } from '../../data/items'

export const KIND_ICON: Record<ItemKind, LucideIcon> = {
  potion: FlaskRound, scroll: ScrollText, weapon: Sword, armor: Shield, gear: Backpack, tool: Wrench, book: BookOpen, map: Map,
  food: Drumstick, treasure: Gem, magic: WandSparkles, trinket: Feather,
}
