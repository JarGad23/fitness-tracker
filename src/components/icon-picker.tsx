"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ACTIVITY_ICONS, activityIconElement } from "@/lib/activity-icons";

type IconPickerProps = {
  value: string;
  onChange: (name: string) => void;
  color?: string;
};

export function IconPicker({ value, onChange, color }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = ACTIVITY_ICONS.filter((i) =>
    i.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-muted aria-expanded:bg-muted">
        <span className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={
              color
                ? { backgroundColor: `${color}1a`, color }
                : { backgroundColor: "var(--muted)" }
            }
          >
            {activityIconElement(value, { className: "h-4 w-4" })}
          </span>
          <span className="text-muted-foreground">Wybierz ikonę</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-input px-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj ikony..."
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
          {filtered.map(({ name, Icon }) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-muted",
                value === name && "bg-muted ring-1 ring-primary"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-6 py-6 text-center text-sm text-muted-foreground">
              Brak wyników
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
