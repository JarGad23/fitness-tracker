"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardContent } from "@/components/ui/card";
import { AuthCard } from "@/components/auth-card";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    try {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setIsPending(false);
        return;
      }
      toast.success("Zalogowano");
      router.push("/");
      router.refresh();
    } catch {
      const message = "Wystąpił błąd podczas logowania";
      setError(message);
      toast.error(message);
      setIsPending(false);
    }
  }

  return (
    <AuthCard title="Fitness Tracker" description="Zaloguj się do swojego konta">
      <form action={handleSubmit}>
        <CardContent className="space-y-5 px-6 pb-8 pt-5 sm:px-8">
          {registered && (
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm font-medium text-primary">
              Konto utworzone! Możesz się teraz zalogować.
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="twoj@email.pl"
              required
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Hasło
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-4 pt-1">
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-semibold"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logowanie...
                </>
              ) : (
                "Zaloguj się"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Nie masz konta?{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline"
              >
                Zarejestruj się
              </Link>
            </p>
          </div>
        </CardContent>
      </form>
    </AuthCard>
  );
}
