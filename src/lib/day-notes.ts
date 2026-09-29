// Day-note tags. Rows store the key, the UI shows the label, and the AI export sends
// both — so a label can be reworded without touching stored notes. Only append new
// tags; removing a key would orphan it in old rows.
export const DAY_TAGS = [
  { key: "sick", label: "Choroba" },
  { key: "poor_sleep", label: "Słaby sen" },
  { key: "stress", label: "Stres" },
  { key: "fatigue", label: "Zmęczenie" },
  { key: "pain", label: "Ból/kontuzja" },
  { key: "travel", label: "Podróż" },
  { key: "alcohol", label: "Alkohol" },
  { key: "extra_activity", label: "Wysiłek poza planem" },
  { key: "great", label: "Świetna forma" },
] as const;

export type DayTag = (typeof DAY_TAGS)[number]["key"];

export const DAY_NOTE_MAX_LENGTH = 500;

const LABELS = new Map<string, string>(DAY_TAGS.map((t) => [t.key, t.label]));

export function dayTagLabel(key: string) {
  return LABELS.get(key) ?? key;
}

/** Shape passed from server components to the editor. */
export type DayNoteValue = { tags: string[]; text: string | null };
