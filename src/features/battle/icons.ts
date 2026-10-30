import {
  Axe, Biohazard, Bird, Bone, BowArrow, Bug, Cat, Crown, Dog, Drama, Eye, Fish, Flame, Ghost, Hammer, PawPrint, Rat, Shield, Skull, Snail,
  Snowflake, Sparkles, Squirrel, Sword, Swords, Turtle, User, VenetianMask, WandSparkles, Worm, Zap, type LucideIcon,
} from 'lucide-react'

/** Icons the DM can pick for an enemy or token. Stored by name so saves stay plain JSON. */
export const TOKEN_ICONS: Record<string, LucideIcon> = {
  Skull, Bone, Ghost, Biohazard, Swords, Sword, Axe, Hammer, BowArrow, WandSparkles, Shield, Crown, VenetianMask, Drama, User,
  PawPrint, Dog, Cat, Rat, Bird, Bug, Worm, Snail, Turtle, Squirrel, Fish, Eye, Flame, Snowflake, Zap, Sparkles,
}

export const TOKEN_COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#65a30d', '#15803d', '#0d9488', '#0284c7', '#4f46e5', '#7c3aed', '#c026d3', '#78716c', '#e7e5e4']
