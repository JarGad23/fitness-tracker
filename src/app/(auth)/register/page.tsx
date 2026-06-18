"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { register } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dumbbell, Loader2 } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-muted/30 via-background to-primary/5">
      <Card className="w-full max-w-md border-border/50 shadow-xl shadow-black/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
            <Dumbbell className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Utwórz konto</CardTitle>
          <CardDescription className="text-base">Zacznij śledzić swoje treningi</CardDescription>
        </CardHeader>
        <form action={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
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
              <Label htmlFor="password" className="text-sm font-medium">Hasło</Label>
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
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Potwierdź hasło</Label>
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Tworzenie konta...
                </>
              ) : (
                "Zarejestruj się"
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Masz już konto?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Zaloguj się
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
