"use client";

import { useOptimistic, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { parseISO, format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmGymPrompt, dismissGymPrompt } from "@/actions/gym";
import { capitalizeFirst } from "@/lib/utils";

type Prompt = { date: string; minutes: number | null };

export function GymPrompts({ prompts }: { prompts: Prompt[] }) {
  const [visible, hide] = useOptimistic(prompts, (list, date: string) =>
    list.filter((p) => p.date !== date)
  );

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((p) => (
        <GymPromptCard key={p.date} prompt={p} hide={hide} />
      ))}
    </div>
  );
}

function GymPromptCard({
  prompt,
  hide,
}: {
  prompt: Prompt;
  hide: (date: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [what, setWhat] = useState("");
  const [opening, startOpen] = useTransition();
  const [, startDismiss] = useTransition();

  // "Tak" stays visible with a spinner until the redirect lands on the workout page.
  const confirm = () => {
    startOpen(async () => {
      try {
        await confirmGymPrompt(prompt.date);
      } catch (error) {
        unstable_rethrow(error); // the redirect itself arrives as a thrown error
        console.error("Failed to confirm gym prompt:", error);
        toast.error("Nie udało się zapisać odpowiedzi");
      }
    });
  };

  const dismiss = (answer: string) => {
    startDismiss(async () => {
      hide(prompt.date);
      try {
        await dismissGymPrompt(prompt.date, answer);
      } catch (error) {
        console.error("Failed to dismiss gym prompt:", error);
        toast.error("Nie udało się zapisać odpowiedzi");
      }
    });
  };

  const day = capitalizeFirst(format(parseISO(prompt.date), "EEE d MMM", { locale: pl }));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-yellow-200 bg-yellow-50 p-3">
      <div className="flex items-center gap-3 min-w-0 flex-1 basis-56">
        <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
          <Watch className="w-4 h-4 text-yellow-700" />
        </div>
        <p className="text-sm">
          <span className="font-semibold">{day}</span>
          {" · "}
          {asking ? "Co to było?" : `${prompt.minutes} min ćwiczeń — to była siłownia?`}
        </p>
      </div>

      {asking ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            dismiss(what);
          }}
          className="flex w-full gap-2"
        >
          <Input
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder="np. góry, spacer"
            aria-label="Co to była za aktywność"
            maxLength={120}
            autoFocus
            className="h-9 min-w-0 flex-1 rounded-xl bg-card"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => dismiss("")}
            className="h-9 rounded-xl px-3"
          >
            Pomiń
          </Button>
          <Button type="submit" disabled={!what.trim()} className="h-9 rounded-xl px-4">
            Zapisz
          </Button>
        </form>
      ) : (
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => setAsking(true)}
            disabled={opening}
            className="h-9 rounded-xl px-4"
          >
            Nie
          </Button>
          <Button onClick={confirm} disabled={opening} className="h-9 rounded-xl px-4">
            {opening && <Loader2 className="animate-spin" />}
            Tak
          </Button>
        </div>
      )}
    </div>
  );
}
