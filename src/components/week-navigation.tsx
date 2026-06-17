"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { getWeekLabel, getWeekRange, toISODateString } from "@/lib/utils";
import { addWeeks, subWeeks } from "date-fns";

type WeekNavigationProps = {
  weekDate: Date;
};

export function WeekNavigation({ weekDate }: WeekNavigationProps) {
  const prevWeek = subWeeks(weekDate, 1);
  const nextWeek = addWeeks(weekDate, 1);

  const today = new Date();
  const { end } = getWeekRange(weekDate);
  const canGoNext = end < today;

  const prevWeekParam = toISODateString(prevWeek);
  const nextWeekParam = toISODateString(nextWeek);

  const buttonBaseClass =
    "inline-flex items-center justify-center rounded-xl h-10 w-10 lg:h-11 lg:w-11 transition-colors hover:bg-muted";

  return (
    <Card className="flex items-center justify-between gap-2 p-2 lg:p-3 border-border/50">
      <Link href={`/?week=${prevWeekParam}`} className={buttonBaseClass}>
        <ChevronLeft className="w-5 h-5" />
      </Link>
      <div className="flex items-center gap-2 flex-1 justify-center">
        <Calendar className="w-4 h-4 text-muted-foreground hidden sm:block" />
        <span className="font-semibold text-sm lg:text-base text-center">
          {getWeekLabel(weekDate)}
        </span>
      </div>
      {canGoNext ? (
        <Link href={`/?week=${nextWeekParam}`} className={buttonBaseClass}>
          <ChevronRight className="w-5 h-5" />
        </Link>
      ) : (
        <div className={`${buttonBaseClass} opacity-30 cursor-not-allowed`}>
          <ChevronRight className="w-5 h-5" />
        </div>
      )}
    </Card>
  );
}
