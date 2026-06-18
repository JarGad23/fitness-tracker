"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { COLOR_PRESETS } from "@/lib/activity-colors";

type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
};

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const isSelected = (hex: string) =>
    value.toLowerCase() === hex.toLowerCase();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            onClick={() => onChange(hex)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110",
              isSelected(hex) ? "ring-foreground/40" : "ring-transparent"
            )}
            style={{ backgroundColor: hex }}
          >
            {isSelected(hex) && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label
          className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-input"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Wybierz kolor"
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#22c55e"
          className="h-12 rounded-xl font-mono"
        />
      </div>
    </div>
  );
}
