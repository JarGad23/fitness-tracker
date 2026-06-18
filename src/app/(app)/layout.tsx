import {
  Dumbbell,
  History,
  Settings,
  LogOut,
  Home,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { UserInfo } from "@/components/user-info";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-muted/40">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-border/50 lg:hidden">
        <div className="px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Dumbbell className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Fitness Tracker
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/historia">
              <Button
                variant="ghost"
                size="icon"
                title="Historia"
                className="rounded-xl h-10 w-10"
              >
                <History className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/ustawienia">
              <Button
                variant="ghost"
                size="icon"
                title="Ustawienia"
                className="rounded-xl h-10 w-10"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                title="Wyloguj"
                className="rounded-xl h-10 w-10"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </form>
          </nav>
        </div>
      </header>

      <div className="lg:flex lg:h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:border-r lg:border-border/50 lg:bg-white/50 lg:backdrop-blur-sm">
          <div className="p-6 border-b border-border/50">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                <Dumbbell className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight block">
                  Fitness
                </span>
                <span className="text-sm text-muted-foreground">Tracker</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <Link href="/">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 rounded-xl text-base font-medium"
              >
                <Home className="w-5 h-5" />
                Dashboard
              </Button>
            </Link>
            <Link href="/historia">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 rounded-xl text-base font-medium"
              >
                <CalendarDays className="w-5 h-5" />
                Historia
              </Button>
            </Link>
            <Link href="/ustawienia">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 rounded-xl text-base font-medium"
              >
                <Settings className="w-5 h-5" />
                Ustawienia
              </Button>
            </Link>
          </nav>

          <UserInfo />
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:overflow-y-auto lg:p-8">
          <div className="lg:max-w-7xl lg:mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
