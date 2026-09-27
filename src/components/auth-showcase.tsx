import { Bike, Check, Dumbbell, PersonStanding, Watch, Waves, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Static preview of what the app does, shown next to the login / register form.
// Colors match the default activities seeded on registration (src/actions/auth.ts).
const SAMPLE_WEEK: { name: string; Icon: LucideIcon; color: string; done: number; target: number }[] = [
  { name: "Siłownia", Icon: Dumbbell, color: "#eab308", done: 3, target: 4 },
  { name: "Bieganie", Icon: PersonStanding, color: "#f97316", done: 2, target: 3 },
  { name: "Rower", Icon: Bike, color: "#22c55e", done: 3, target: 3 },
  { name: "Basen", Icon: Waves, color: "#3b82f6", done: 1, target: 2 },
];

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({
  color,
  progress,
  Icon,
  index,
  className,
}: {
  color: string;
  progress: number;
  Icon: LucideIcon;
  index: number;
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <svg viewBox="0 0 44 44" className="size-full -rotate-90">
        <circle cx="22" cy="22" r={RADIUS} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth="5" />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="motion-safe:animate-[ring-fill_900ms_cubic-bezier(0.22,1,0.36,1)_both]"
          style={
            {
              "--ring-circumference": CIRCUMFERENCE,
              animationDelay: `${200 + index * 90}ms`,
            } as React.CSSProperties
          }
        />
      </svg>
      <Icon className="absolute inset-0 m-auto size-[38%]" style={{ color }} strokeWidth={2.25} />
    </div>
  );
}

function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
        <Dumbbell className="size-5 text-primary-foreground" />
      </div>
      <span className="text-lg font-bold tracking-tight">Fitness Tracker</span>
    </div>
  );
}

// Desktop: the full left panel.
export function AuthShowcase() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-[oklch(0.27_0.055_163)] p-12 text-white xl:p-16">
      {/* Cheap depth: a radial gradient instead of large blurred blobs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,oklch(0.45_0.12_163/0.55),transparent_60%)]"
      />

      <Brand className="relative" />

      <div className="relative max-w-md space-y-10">
        <div className="space-y-4">
          <h2 className="font-heading text-5xl font-bold leading-[1.05] tracking-tight">
            Wyczyść tygodniową pulę.
          </h2>
          <p className="text-lg text-white/70">
            Cel na tydzień, dowolne dni. Trenujesz, kiedy pasuje — liczy się, żeby pula
            zeszła do zera przed niedzielą.
          </p>
        </div>

        <ul className="space-y-3">
          {SAMPLE_WEEK.map(({ name, Icon, color, done, target }, i) => {
            const cleared = done >= target;
            return (
              <li
                key={name}
                className="flex items-center gap-4 rounded-2xl bg-white/[0.06] p-3 pr-5 ring-1 ring-white/10 motion-safe:animate-[rise-in_500ms_ease-out_both]"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <Ring color={color} progress={done / target} Icon={Icon} index={i} className="size-12" />
                <span className="flex-1 font-semibold">{name}</span>
                {cleared ? (
                  <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
                    <Check className="size-4" strokeWidth={3} />
                    Wyczyszczone
                  </span>
                ) : (
                  <span className="text-sm tabular-nums text-white/60">
                    <span className="text-base font-semibold text-white">{done}</span> / {target}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative flex items-center gap-3 text-sm text-white/70">
        <div className="flex size-9 items-center justify-center rounded-full bg-white/10">
          <Watch className="size-4" />
        </div>
        Rower i bieganie wpadają same z Apple Watch.
      </div>
    </div>
  );
}

// Mobile / tablet: brand + a row of rings above the form.
export function AuthShowcaseCompact() {
  return (
    <div className="space-y-6">
      <Brand />
      <div className="flex items-center gap-3">
        {SAMPLE_WEEK.map(({ name, Icon, color, done, target }, i) => (
          <Ring key={name} color={color} progress={done / target} Icon={Icon} index={i} className="size-12" />
        ))}
        <p className="ml-1 text-sm leading-snug text-muted-foreground">
          Wyczyść
          <br />
          tygodniową pulę.
        </p>
      </div>
    </div>
  );
}
