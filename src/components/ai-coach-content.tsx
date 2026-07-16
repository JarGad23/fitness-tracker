"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check, Upload, Bot } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { syncAITargets } from "@/actions/ai-sync";

export function AiCoachContent({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast.success("Skopiowano do schowka");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować");
    }
  };

  const handleSync = () => {
    if (!payload.trim()) {
      toast.error("Wklej odpowiedź AI");
      return;
    }
    startTransition(async () => {
      const result = await syncAITargets(payload);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.updated.length === 0) {
        toast.info("Brak zmian — cele są już aktualne");
        return;
      }
      toast.success(`Zaktualizowano cele: ${result.updated.join(", ")}`);
      setPayload("");
    });
  };

  return (
    <div className="space-y-4">
      {/* Export */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Eksport dla trenera AI
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Skopiuj i wklej do Gemini
                </p>
              </div>
            </div>
            <Button onClick={handleCopy} className="rounded-xl gap-2">
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Skopiowano" : "Kopiuj"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-muted/30 p-4 text-xs whitespace-pre-wrap break-words font-mono">
            {markdown}
          </pre>
        </CardContent>
      </Card>

      {/* Import */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Import celów od AI
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Wklej odpowiedź (JSON) — zaktualizuje cele tygodniowe
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <Textarea
            placeholder='{ "targets": [ { "name": "Siłownia", "target_per_week": 4 } ] }'
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
          <Button
            onClick={handleSync}
            disabled={isPending || !payload.trim()}
            className="w-full h-11 rounded-xl"
          >
            {isPending ? "Synchronizowanie..." : "Zsynchronizuj cele"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
