import { AuthShowcase, AuthShowcaseCompact } from "@/components/auth-showcase";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <AuthShowcase />
      </aside>

      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm space-y-10">
          <div className="lg:hidden">
            <AuthShowcaseCompact />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
