export const activityColors = {
  Siłownia: {
    bg: "bg-yellow-100",
    text: "text-yellow-600",
    fill: "bg-yellow-500",
    border: "border-yellow-500",
    dot: "bg-yellow-500",
  },
  Bieganie: {
    bg: "bg-orange-100",
    text: "text-orange-600",
    fill: "bg-orange-500",
    border: "border-orange-500",
    dot: "bg-orange-500",
  },
  Rower: {
    bg: "bg-green-100",
    text: "text-green-600",
    fill: "bg-green-500",
    border: "border-green-500",
    dot: "bg-green-500",
  },
  Basen: {
    bg: "bg-blue-100",
    text: "text-blue-600",
    fill: "bg-blue-500",
    border: "border-blue-500",
    dot: "bg-blue-500",
  },
} as const;

export type ActivityName = keyof typeof activityColors;

export function getActivityColor(name: string) {
  return activityColors[name as ActivityName] || {
    bg: "bg-gray-100",
    text: "text-gray-600",
    fill: "bg-gray-500",
    border: "border-gray-500",
    dot: "bg-gray-500",
  };
}
