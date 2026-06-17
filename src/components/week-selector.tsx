"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { getWeekLabel } from "@/lib/utils";

type WeekSelectorProps = {
  currentDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
};

export function WeekSelector({
  currentDate,
  onPrevious,
  onNext,
  canGoNext,
}: WeekSelectorProps) {
  return (
    <Card className="flex items-center justify-between gap-2 p-2 lg:p-3 border-border/50">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrevious}
        className="rounded-xl h-10 w-10 lg:h-11 lg:w-11 hover:bg-muted"
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>
      <div className="flex items-center gap-2 flex-1 justify-center">
        <Calendar className="w-4 h-4 text-muted-foreground hidden sm:block" />
        <span className="font-semibold text-sm lg:text-base text-center">
          {getWeekLabel(currentDate)}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!canGoNext}
        className="rounded-xl h-10 w-10 lg:h-11 lg:w-11 hover:bg-muted disabled:opacity-30"
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
    </Card>
  );
}
