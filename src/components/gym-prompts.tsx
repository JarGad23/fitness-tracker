"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseISO, format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmGymPrompt, dismissGymPrompt } from "@/actions/gym";
import { capitalizeFirst } from "@/lib/utils";

type Prompt = { date: string; minutes: number | null };

export function GymPrompts({ prompts }: { prompts: Prompt[] }) {
  const router = useRouter();
  const [visible, hide] = useOptimistic(prompts, (list, date: string) =>
    list.filter((p) => p.date !== date)
  );
  const [, startTransition] = useTransition();

  if (visible.length === 0) return null;

  const answer = (date: string, wasGym: boolean) => {
    startTransition(async () => {
      hide(date);
      try {
        if (wasGym) router.push(`/trening/${await confirmGymPrompt(date)}`);
        else await dismissGymPrompt(date);
      } catch (error) {
        console.error("Failed to answer gym prompt:", error);
        toast.error("Nie udało się zapisać odpowiedzi");
      }
    });
  };

  return (
    <div className="space-y-2">
      {visible.map((p) => (
        <div
          key={p.date}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-yellow-200 bg-yellow-50 p-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1 basis-56">
            <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
              <Watch className="w-4 h-4 text-yellow-700" />
            </div>
            <p className="text-sm">
              <span className="font-semibold">
                {capitalizeFirst(format(parseISO(p.date), "EEE d MMM", { locale: pl }))}
              </span>
              {" · "}
              {p.minutes} min ćwiczeń — to była siłownia?
            </p>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              onClick={() => answer(p.date, false)}
              className="h-9 rounded-xl px-4"
            >
              Nie
            </Button>
            <Button onClick={() => answer(p.date, true)} className="h-9 rounded-xl px-4">
              Tak
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
