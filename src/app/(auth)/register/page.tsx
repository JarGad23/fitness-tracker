"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { register } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardContent } from "@/components/ui/card";
import { AuthCard } from "@/components/auth-card";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    try {
      const result = await register(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setIsPending(false);
        return;
      }
      toast.success("Konto utworzone! Możesz się zalogować.");
      router.push("/login?registered=true");
    } catch {
      const message = "Wystąpił błąd podczas rejestracji";
      setError(message);
      toast.error(message);
      setIsPending(false);
    }
  }

  return (
    <AuthCard title="Utwórz konto" description="Zacznij śledzić swoje treningi">
      <form action={handleSubmit}>
        <CardContent className="space-y-5 px-6 pb-8 pt-5 sm:px-8">
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
              minLength={6}
              required
              className="h-12 rounded-xl"
              placeholder="Minimum 6 znaków"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Potwierdź hasło
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={6}
              required
              className="h-12 rounded-xl"
              placeholder="Powtórz hasło"
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
                  Tworzenie konta...
                </>
              ) : (
                "Zarejestruj się"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Masz już konto?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Zaloguj się
              </Link>
            </p>
          </div>
        </CardContent>
      </form>
    </AuthCard>
  );
}
