import {
  Dumbbell,
  Bike,
  Waves,
  Footprints,
  Mountain,
  Volleyball,
  Flame,
  HeartPulse,
  Trophy,
  Zap,
  Timer,
  Medal,
  type LucideIcon,
} from "lucide-react";

// Subtle, decorative sport icons scattered behind the auth card. Purely visual:
// very low opacity + varied rotation so they read as a delicate texture, not noise.
const DECOR_ICONS: { Icon: LucideIcon; className: string }[] = [
  { Icon: Dumbbell, className: "left-[6%] top-[10%] h-12 w-12 -rotate-12" },
  { Icon: Footprints, className: "left-[16%] top-[64%] h-10 w-10 rotate-6" },
  { Icon: Bike, className: "left-[8%] top-[38%] h-14 w-14 rotate-[10deg] hidden sm:block" },
  { Icon: Waves, className: "left-[24%] top-[20%] h-9 w-9 -rotate-6 hidden sm:block" },
  { Icon: Mountain, className: "left-[12%] bottom-[10%] h-11 w-11 rotate-3 hidden sm:block" },
  { Icon: Volleyball, className: "right-[8%] top-[14%] h-12 w-12 rotate-12" },
  { Icon: Flame, className: "right-[18%] top-[58%] h-10 w-10 -rotate-6" },
  { Icon: HeartPulse, className: "right-[6%] top-[40%] h-14 w-14 -rotate-[10deg] hidden sm:block" },
  { Icon: Trophy, className: "right-[22%] bottom-[16%] h-9 w-9 rotate-6 hidden sm:block" },
  { Icon: Zap, className: "right-[12%] bottom-[8%] h-11 w-11 -rotate-3 hidden sm:block" },
  { Icon: Timer, className: "left-[46%] top-[5%] h-9 w-9 rotate-[14deg] hidden md:block" },
  { Icon: Medal, className: "left-[52%] bottom-[6%] h-10 w-10 -rotate-6 hidden md:block" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-muted/40 via-background to-primary/10 p-4 sm:p-6">
      {/* Soft colored glows for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl"
      />

      {/* Scattered sport icons */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {DECOR_ICONS.map(({ Icon, className }, i) => (
          <Icon
            key={i}
            className={`absolute text-primary/[0.07] ${className}`}
            strokeWidth={1.5}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
