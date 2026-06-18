"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { logout } from "@/actions/auth";

export function UserInfo() {
  const [email, setEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.email) {
          setEmail(data.user.email);
        }
      });
  }, []);

  function handleLogout() {
    startTransition(async () => {
      try {
        await logout();
        toast.success("Wylogowano");
        router.push("/login");
        router.refresh();
      } catch {
        toast.error("Nie udało się wylogować");
      }
    });
  }

  return (
    <div className="p-4 border-t border-border/50">
      <Card className="p-4 bg-primary/5 border-primary/20">
        <p className="text-sm font-medium mb-1">Zalogowany jako:</p>
        <p className="text-sm text-muted-foreground truncate">
          {email || "Ładowanie..."}
        </p>
      </Card>
      <Button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        variant="outline"
        className="mt-3 w-full gap-2 h-11 rounded-xl"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LogOut className="w-4 h-4" />
        )}
        Wyloguj się
      </Button>
    </div>
  );
}
