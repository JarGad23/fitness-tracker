"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { addWeeks, subWeeks, startOfWeek, isSameWeek } from "date-fns";

import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { getWeekLabel, getWeekRange, toISODateString } from "@/lib/utils";

type WeekNavigationProps = {
  weekDate: Date;
};

export function WeekNavigation({ weekDate }: WeekNavigationProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const prevWeek = subWeeks(weekDate, 1);
  const nextWeek = addWeeks(weekDate, 1);

  const today = new Date();
  const { end } = getWeekRange(weekDate);
  const canGoNext = end < today;

  const prevWeekParam = toISODateString(prevWeek);
  const nextWeekParam = toISODateString(nextWeek);

  const arrowClass =
    "inline-flex items-center justify-center rounded-xl h-10 w-10 lg:h-11 lg:w-11 shrink-0 transition-colors hover:bg-muted";

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    setOpen(false);
    router.push(`/?week=${toISODateString(weekStart)}`);
  };

  return (
    <Card className="flex flex-row items-center justify-between gap-2 p-2 lg:p-3 border-border/50">
      <Link
        href={`/?week=${prevWeekParam}`}
        className={arrowClass}
        aria-label="Poprzedni tydzień"
      >
        <ChevronLeft className="w-5 h-5" />
      </Link>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-muted aria-expanded:bg-muted">
          <CalendarIcon className="w-4 h-4 text-muted-foreground hidden sm:block shrink-0" />
          <span className="font-semibold text-sm lg:text-base text-center">
            {getWeekLabel(weekDate)}
          </span>
        </PopoverTrigger>
        <PopoverContent align="center">
          <Calendar
            mode="single"
            selected={weekDate}
            defaultMonth={weekDate}
            onSelect={handleSelect}
            modifiers={{
              activeWeek: (date) =>
                isSameWeek(date, weekDate, { weekStartsOn: 1 }),
            }}
            modifiersClassNames={{ activeWeek: "bg-muted" }}
          />
        </PopoverContent>
      </Popover>

      {canGoNext ? (
        <Link
          href={`/?week=${nextWeekParam}`}
          className={arrowClass}
          aria-label="Następny tydzień"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      ) : (
        <div className={`${arrowClass} opacity-30 cursor-not-allowed`}>
          <ChevronRight className="w-5 h-5" />
        </div>
      )}
    </Card>
  );
}
