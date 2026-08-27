import { Footprints, Flame, Zap, Crown, Star, Trophy, Target, Award, type LucideIcon } from "lucide-react";
import type { BadgeDefinition } from "./api";

const ICON_MAP: Record<BadgeDefinition["icon"], LucideIcon> = {
  footprints: Footprints,
  flame: Flame,
  zap: Zap,
  crown: Crown,
  star: Star,
  trophy: Trophy,
  target: Target,
  medal: Award,
};

export function getBadgeIcon(icon: BadgeDefinition["icon"]): LucideIcon {
  return ICON_MAP[icon];
}
