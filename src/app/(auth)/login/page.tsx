import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <div className="h-[440px] w-full animate-pulse rounded-3xl bg-card ring-1 ring-foreground/10" />
  );
}
