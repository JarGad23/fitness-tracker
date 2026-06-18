"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { pl } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={pl}
      weekStartsOn={1}
      fixedWeeks
      className={cn("p-3", className)}
      classNames={{
        months: cn("relative flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-3", defaults.month),
        month_caption: cn(
          "flex h-9 items-center justify-center px-10",
          defaults.month_caption
        ),
        caption_label: cn(
          "text-sm font-semibold capitalize",
          defaults.caption_label
        ),
        nav: cn(
          "absolute inset-x-1 top-0 flex items-center justify-between",
          defaults.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          defaults.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          defaults.button_next
        ),
        month_grid: cn("w-full border-collapse", defaults.month_grid),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn(
          "w-9 flex-1 pb-1 text-[0.72rem] font-medium text-muted-foreground capitalize",
          defaults.weekday
        ),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn(
          "relative aspect-square w-9 flex-1 p-0 text-center text-sm",
          defaults.day
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-9 rounded-lg font-normal",
          defaults.day_button
        ),
        today: cn("font-semibold text-primary", defaults.today),
        selected: cn(
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
          defaults.selected
        ),
        outside: cn("text-muted-foreground/40", defaults.outside),
        disabled: cn(
          "text-muted-foreground/30 [&>button]:pointer-events-none",
          defaults.disabled
        ),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("size-4", chevronClassName)} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
