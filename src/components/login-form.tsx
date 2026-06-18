"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { login } from "@/actions/auth";
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-muted/30 via-background to-primary/5">
      <Card className="w-full max-w-md border-border/50 shadow-xl shadow-black/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
            <Dumbbell className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Fitness Tracker</CardTitle>
          <CardDescription className="text-base">Zaloguj się do swojego konta</CardDescription>
        </CardHeader>
        <form action={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            {registered && (
              <div className="p-4 rounded-xl bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                Konto utworzone! Możesz się teraz zalogować.
              </div>
            )}
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
                required
                className="h-12 rounded-xl"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logowanie...
                </>
              ) : (
                "Zaloguj się"
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Nie masz konta?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Zarejestruj się
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
