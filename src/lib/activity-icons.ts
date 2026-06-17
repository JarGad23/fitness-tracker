import { createElement, type ComponentProps } from "react";
import {
  Dumbbell,
  PersonStanding,
  Bike,
  Waves,
  Activity,
  Heart,
  HeartPulse,
  Flame,
  Footprints,
  Mountain,
  Trophy,
  Medal,
  Timer,
  Zap,
  Target,
  Bird,
  Dog,
  TreePine,
  Tent,
  Compass,
  Sun,
  Moon,
  Snowflake,
  Wind,
  Droplet,
  Star,
  Sparkles,
  Rocket,
  Anchor,
  Sailboat,
  Music,
  Gamepad2,
  Bed,
  Apple,
  Coffee,
  Brain,
  type LucideIcon,
} from "lucide-react";

// Shared icon set used by the picker AND everywhere an activity icon renders,
// so any chosen icon resolves consistently.
export const ACTIVITY_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "Dumbbell", Icon: Dumbbell },
  { name: "PersonStanding", Icon: PersonStanding },
  { name: "Bike", Icon: Bike },
  { name: "Waves", Icon: Waves },
  { name: "Activity", Icon: Activity },
  { name: "Heart", Icon: Heart },
  { name: "HeartPulse", Icon: HeartPulse },
  { name: "Flame", Icon: Flame },
  { name: "Footprints", Icon: Footprints },
  { name: "Mountain", Icon: Mountain },
  { name: "Trophy", Icon: Trophy },
  { name: "Medal", Icon: Medal },
  { name: "Timer", Icon: Timer },
  { name: "Zap", Icon: Zap },
  { name: "Target", Icon: Target },
  { name: "Bird", Icon: Bird },
  { name: "Dog", Icon: Dog },
  { name: "TreePine", Icon: TreePine },
  { name: "Tent", Icon: Tent },
  { name: "Compass", Icon: Compass },
  { name: "Sun", Icon: Sun },
  { name: "Moon", Icon: Moon },
  { name: "Snowflake", Icon: Snowflake },
  { name: "Wind", Icon: Wind },
  { name: "Droplet", Icon: Droplet },
  { name: "Star", Icon: Star },
  { name: "Sparkles", Icon: Sparkles },
  { name: "Rocket", Icon: Rocket },
  { name: "Anchor", Icon: Anchor },
  { name: "Sailboat", Icon: Sailboat },
  { name: "Music", Icon: Music },
  { name: "Gamepad2", Icon: Gamepad2 },
  { name: "Bed", Icon: Bed },
  { name: "Apple", Icon: Apple },
  { name: "Coffee", Icon: Coffee },
  { name: "Brain", Icon: Brain },
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
