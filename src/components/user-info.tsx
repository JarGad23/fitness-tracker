"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";

export function UserInfo() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.email) {
          setEmail(data.user.email);
        }
      });
  }, []);

  return (
    <div className="p-4 border-t border-border/50">
      <Card className="p-4 bg-primary/5 border-primary/20">
        <p className="text-sm font-medium mb-1">Zalogowany jako:</p>
        <p className="text-sm text-muted-foreground truncate">
          {email || "Ładowanie..."}
        </p>
      </Card>
      <form action={logout} className="mt-3">
        <Button
          type="submit"
          variant="outline"
          className="w-full gap-2 h-11 rounded-xl"
        >
          <LogOut className="w-4 h-4" />
          Wyloguj się
        </Button>
      </form>
    </div>
  );
}
