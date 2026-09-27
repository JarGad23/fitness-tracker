"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeading } from "@/components/auth-heading";
import { PasswordInput } from "@/components/password-input";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // onSubmit, not <form action>: React resets a form after its action runs, which
  // wiped the email and password on every failed attempt.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    // One transition covers the action and the navigation, so the button keeps
    // its spinner until the dashboard is ready instead of going idle in between.
    startTransition(async () => {
      try {
        const result = await login(formData);
        if (result?.error) {
          setError(result.error);
          return;
        }
        router.replace("/");
      } catch {
        setError("Wystąpił błąd podczas logowania");
      }
    });
  }

  return (
    <div className="space-y-8">
      <AuthHeading title="Witaj z powrotem" description="Zaloguj się, żeby zobaczyć swój tydzień." />

      {/* method="post": if Enter lands before hydration, the native submit must not put the password in the URL. */}
      <form method="post" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="twoj@email.pl"
            required
            autoFocus
            aria-invalid={error ? true : undefined}
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Hasło</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
            className="h-12 rounded-xl"
          />
        </div>
        <Button type="submit" disabled={isPending} className="h-12 w-full rounded-xl text-base font-semibold">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Logowanie…
            </>
          ) : (
            <>
              Zaloguj się
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Nie masz konta?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Załóż je
        </Link>
      </p>
    </div>
  );
}
