import { createElement, type ComponentProps } from "react";
import {
  Dumbbell,
  PersonStanding,
  Bike,
  Waves,
  Footprints,
  Accessibility,
  Mountain,
  MountainSnow,
  Snowflake,
  Volleyball,
  Goal,
  Sailboat,
  Sword,
  Swords,
  Flame,
  Activity,
  Heart,
  HeartPulse,
  Zap,
  Timer,
  Target,
  Trophy,
  Medal,
  Wind,
  Music,
  Brain,
  type LucideIcon,
} from "lucide-react";

// Shared icon set used by the picker AND everywhere an activity icon renders,
// so any chosen icon resolves consistently. Curated to sport / fitness themes.
export const ACTIVITY_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "Dumbbell", Icon: Dumbbell }, // siłownia
  { name: "PersonStanding", Icon: PersonStanding }, // bieganie / stretching
  { name: "Footprints", Icon: Footprints }, // bieganie / chód
  { name: "Bike", Icon: Bike }, // rower
  { name: "Waves", Icon: Waves }, // pływanie / basen
  { name: "Accessibility", Icon: Accessibility }, // aktywność / mobilność
  { name: "Mountain", Icon: Mountain }, // turystyka / wspinaczka
  { name: "MountainSnow", Icon: MountainSnow }, // narty / sporty górskie
  { name: "Snowflake", Icon: Snowflake }, // sporty zimowe
  { name: "Volleyball", Icon: Volleyball }, // siatkówka / gry zespołowe
  { name: "Goal", Icon: Goal }, // piłka nożna / bramka
  { name: "Sailboat", Icon: Sailboat }, // żeglarstwo / sporty wodne
  { name: "Sword", Icon: Sword }, // sztuki walki / szermierka
  { name: "Swords", Icon: Swords }, // sporty walki
  { name: "Flame", Icon: Flame }, // cardio / spalanie
  { name: "Activity", Icon: Activity }, // tętno / aktywność
  { name: "Heart", Icon: Heart }, // kondycja
  { name: "HeartPulse", Icon: HeartPulse }, // tętno
  { name: "Zap", Icon: Zap }, // HIIT / energia
  { name: "Timer", Icon: Timer }, // interwały
  { name: "Target", Icon: Target }, // cel
  { name: "Trophy", Icon: Trophy }, // osiągnięcia
  { name: "Medal", Icon: Medal }, // osiągnięcia
  { name: "Wind", Icon: Wind }, // sporty na świeżym powietrzu
  { name: "Music", Icon: Music }, // taniec / fitness
  { name: "Brain", Icon: Brain }, // joga / medytacja
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ACTIVITY_ICONS.map((i) => [i.name, i.Icon])
);

export function getActivityIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Dumbbell;
}

// Renders an icon by name without assigning a component to a render-scope
// variable (avoids the react-hooks/static-components lint rule).
export function activityIconElement(
  name: string,
  props?: ComponentProps<LucideIcon>
) {
  return createElement(getActivityIcon(name), props);
}
