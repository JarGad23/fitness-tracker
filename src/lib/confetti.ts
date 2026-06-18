// Lightweight, dependency-free confetti burst.
// Client-only. Each call creates a transient full-screen canvas that removes
// itself once all particles have settled. Respects prefers-reduced-motion.

type ConfettiOptions = {
  particleCount?: number;
  colors?: string[];
  spread?: number; // horizontal scatter, degrees
  originY?: number; // 0..1 viewport fraction
};

export function burstConfetti(options: ConfettiOptions = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const {
    particleCount = 90,
    colors = ["#16a34a", "#22c55e", "#eab308", "#f97316", "#3b82f6"],
    spread = 70,
    originY = 0.5,
  } = options;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const originX = w / 2;
  const oy = h * originY;
  const gravity = 0.35;
  const drag = 0.992;
  const maxLife = 180; // frames (~3s @60fps)

  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rot: number;
    vr: number;
    life: number;
  };

  const particles: Particle[] = Array.from({ length: particleCount }, () => {
    const angle = (-90 + (Math.random() - 0.5) * spread) * (Math.PI / 180);
    const speed = 6 + Math.random() * 7;
    return {
      x: originX,
      y: oy,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 0,
    };
  });

  let raf = 0;
  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of particles) {
      p.life++;
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const alpha = Math.max(0, 1 - p.life / maxLife);
      if (alpha > 0 && p.y < h + 20) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    if (alive) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  };
  raf = requestAnimationFrame(tick);
}
