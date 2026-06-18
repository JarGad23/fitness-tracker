// Optional workout duration ranges. Stored as the range code (e.g. "45-60").
export const DURATION_OPTIONS = [
  { value: "15-30", label: "15–30 min" },
  { value: "30-45", label: "30–45 min" },
  { value: "45-60", label: "45 min – 1 h" },
  { value: "60-90", label: "1 – 1,5 h" },
  { value: "90-120", label: "1,5 – 2 h" },
];

export function durationLabel(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  return DURATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
