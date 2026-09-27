"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { register } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeading } from "@/components/auth-heading";
import { PasswordInput } from "@/components/password-input";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Same pattern as the login form: onSubmit keeps the fields filled on error, and
  // one transition spans the action and the navigation. Registration signs in.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await register(formData);
        if (result?.error) {
          setError(result.error);
          return;
        }
        router.replace("/");
      } catch {
        setError("Wystąpił błąd podczas rejestracji");
      }
    });
  }

  return (
    <div className="space-y-8">
      <AuthHeading
        title="Załóż konto"
        description="Dostaniesz gotową pulę: siłownia, bieganie, rower i basen. Cele zmienisz w ustawieniach."
      />

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
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Hasło</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={6}
            required
            placeholder="Minimum 6 znaków"
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Powtórz hasło</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={6}
            required
            className="h-12 rounded-xl"
          />
        </div>
        <Button type="submit" disabled={isPending} className="h-12 w-full rounded-xl text-base font-semibold">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Tworzenie konta…
            </>
          ) : (
            <>
              Załóż konto
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Masz już konto?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Zaloguj się
        </Link>
      </p>
    </div>
  );
}
