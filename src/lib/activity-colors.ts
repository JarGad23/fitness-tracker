// Per-activity colors. Each activity stores its own hex color (activity.color).
// These helpers resolve the color and build inline styles, since arbitrary
// runtime hex values can't be expressed as static Tailwind classes.

const DEFAULT_HEX: Record<string, string> = {
  Siłownia: "#eab308",
  Bieganie: "#f97316",
  Rower: "#22c55e",
  Basen: "#3b82f6",
};

export const DEFAULT_ACTIVITY_COLOR = "#6b7280";

export function resolveActivityColor(activity: {
  name: string;
  color?: string | null;
}): string {
  return activity.color || DEFAULT_HEX[activity.name] || DEFAULT_ACTIVITY_COLOR;
}

// Inline-style helpers derived from a single hex value.
export function activityColorStyles(hex: string) {
  return {
    solid: { backgroundColor: hex },
    soft: { backgroundColor: `${hex}1a` }, // ~10% alpha tint
    text: { color: hex },
    border: { borderColor: hex },
  };
}

// Swatches offered in the color picker.
export const COLOR_PRESETS = [
  "#eab308",
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#0ea5e9",
  "#84cc16",
  "#f59e0b",
  "#6366f1",
];
