// ──────────────────────────────────────────────
// Chat: Dynamic Weather Effects — ambient particles
// that change based on roleplay weather + time of day
// ──────────────────────────────────────────────
import { useEffect, useRef, useMemo } from "react";

interface WeatherEffectsProps {
  weather?: string | null;
  timeOfDay?: string | null;
}

// ── Particle types ──
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  type: "rain" | "snow" | "leaf" | "firefly" | "star" | "fog" | "dust" | "petal";
  wobble: number;
  life: number;
  maxLife: number;
}

// ── Map weather string → effect config ──
function parseWeather(weather?: string | null): {
  type: Particle["type"];
  count: number;
  overlay: string;
} {
  if (!weather) return { type: "dust", count: 15, overlay: "" };

  const w = weather.toLowerCase();

  if (w.includes("rain") || w.includes("storm") || w.includes("downpour")) {
    const isHeavy = w.includes("heavy") || w.includes("storm") || w.includes("downpour");
    return { type: "rain", count: isHeavy ? 200 : 80, overlay: "rgba(50,80,120,0.08)" };
  }
  if (w.includes("snow") || w.includes("blizzard") || w.includes("frost")) {
    const isHeavy = w.includes("heavy") || w.includes("blizzard");
    return { type: "snow", count: isHeavy ? 120 : 50, overlay: "rgba(200,220,255,0.06)" };
  }
  if (w.includes("fog") || w.includes("mist") || w.includes("haze")) {
    return { type: "fog", count: 20, overlay: "rgba(180,180,200,0.12)" };
  }
  if (w.includes("wind") || w.includes("breez")) {
    return { type: "leaf", count: 25, overlay: "" };
  }
  if (w.includes("cherry") || w.includes("blossom") || w.includes("petal")) {
    return { type: "petal", count: 30, overlay: "rgba(255,180,200,0.04)" };
  }
  if (w.includes("clear") || w.includes("sunny") || w.includes("bright")) {
    return { type: "dust", count: 12, overlay: "" };
  }
  if (w.includes("cloud") || w.includes("overcast")) {
    return { type: "dust", count: 8, overlay: "rgba(100,100,120,0.05)" };
  }

  return { type: "dust", count: 10, overlay: "" };
}

// ── Map time of day → tint + fireflies ──
function parseTime(
  timeOfDay?: string | null,
  baseType?: Particle["type"],
): { tint: string; addFireflies: boolean; addStars: boolean } {
  if (!timeOfDay) return { tint: "", addFireflies: false, addStars: false };

  const t = timeOfDay.toLowerCase();

  if (t.includes("night") || t.includes("midnight")) {
    return {
      tint: "rgba(10,10,40,0.15)",
      addFireflies: baseType !== "rain" && baseType !== "snow",
      addStars: baseType !== "fog" && baseType !== "snow",
    };
  }
  if (t.includes("dusk") || t.includes("sunset") || t.includes("twilight") || t.includes("evening")) {
    return {
      tint: "rgba(80,30,20,0.10)",
      addFireflies: baseType !== "rain",
      addStars: false,
    };
  }
  if (t.includes("dawn") || t.includes("sunrise") || t.includes("morning")) {
    return { tint: "rgba(120,80,40,0.06)", addFireflies: false, addStars: false };
  }

  return { tint: "", addFireflies: false, addStars: false };
}

// ── Create particle ──
function createParticle(
  type: Particle["type"],
  w: number,
  h: number,
  fromTop = false,
): Particle {
  const base: Particle = {
    x: Math.random() * w,
    y: fromTop ? -10 : Math.random() * h,
    vx: 0,
    vy: 0,
    size: 2,
    opacity: 0.5,
    type,
    wobble: Math.random() * Math.PI * 2,
    life: 0,
    maxLife: 600 + Math.random() * 400,
  };

  switch (type) {
    case "rain":
      base.vy = 8 + Math.random() * 6;
      base.vx = -1 + Math.random() * -2;
      base.size = 1.5;
      base.opacity = 0.25 + Math.random() * 0.2;
      base.maxLife = 200;
      break;
    case "snow":
      base.vy = 0.5 + Math.random() * 1.2;
      base.vx = -0.3 + Math.random() * 0.6;
      base.size = 2 + Math.random() * 3;
      base.opacity = 0.4 + Math.random() * 0.3;
      base.maxLife = 800;
      break;
    case "leaf":
      base.vy = 0.8 + Math.random() * 1;
      base.vx = 1.5 + Math.random() * 2;
      base.size = 4 + Math.random() * 3;
      base.opacity = 0.5 + Math.random() * 0.3;
      base.maxLife = 500;
      break;
    case "petal":
      base.vy = 0.4 + Math.random() * 0.8;
      base.vx = 0.5 + Math.random() * 1;
      base.size = 3 + Math.random() * 3;
      base.opacity = 0.4 + Math.random() * 0.3;
      base.maxLife = 600;
      break;
    case "firefly":
      base.vy = -0.2 + Math.random() * 0.4;
      base.vx = -0.3 + Math.random() * 0.6;
      base.size = 2 + Math.random() * 2;
      base.opacity = 0;
      base.maxLife = 300 + Math.random() * 300;
      break;
    case "star":
      base.vy = 0;
      base.vx = 0;
      base.size = 1 + Math.random() * 1.5;
      base.opacity = 0;
      base.maxLife = 400 + Math.random() * 400;
      base.y = Math.random() * h * 0.4; // upper portion
      break;
    case "fog":
      base.vy = 0;
      base.vx = 0.2 + Math.random() * 0.4;
      base.size = 60 + Math.random() * 80;
      base.opacity = 0.03 + Math.random() * 0.04;
      base.maxLife = 1000;
      break;
    case "dust":
      base.vy = -0.1 + Math.random() * 0.2;
      base.vx = -0.1 + Math.random() * 0.2;
      base.size = 1 + Math.random() * 2;
      base.opacity = 0.15 + Math.random() * 0.15;
      base.maxLife = 600 + Math.random() * 400;
      break;
  }

  return base;
}

// ── Draw helpers ──
function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const fadeIn = Math.min(p.life / 60, 1);
  const fadeOut = Math.max(1 - p.life / p.maxLife, 0);
  const alpha = p.opacity * fadeIn * fadeOut;
  if (alpha <= 0) return;

  ctx.globalAlpha = alpha;

  switch (p.type) {
    case "rain": {
      ctx.strokeStyle = "rgba(180,210,255,0.8)";
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
      ctx.stroke();
      break;
    }
    case "snow": {
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      gradient.addColorStop(0, "rgba(255,255,255,0.9)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "leaf": {
      ctx.fillStyle = `hsl(${100 + Math.sin(p.wobble) * 30}, 60%, 45%)`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "petal": {
      ctx.fillStyle = `hsl(${340 + Math.sin(p.wobble) * 15}, 80%, 80%)`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "firefly": {
      const pulse = Math.sin(p.life * 0.05) * 0.5 + 0.5;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      glow.addColorStop(0, `rgba(200,255,100,${pulse * 0.8})`);
      glow.addColorStop(0.5, `rgba(180,255,80,${pulse * 0.3})`);
      glow.addColorStop(1, "rgba(180,255,80,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "star": {
      const twinkle = Math.sin(p.life * 0.04 + p.wobble) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255,255,240,${twinkle * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // cross sparkle
      ctx.strokeStyle = `rgba(255,255,240,${twinkle * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x - p.size * 2, p.y);
      ctx.lineTo(p.x + p.size * 2, p.y);
      ctx.moveTo(p.x, p.y - p.size * 2);
      ctx.lineTo(p.x, p.y + p.size * 2);
      ctx.stroke();
      break;
    }
    case "fog": {
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      gradient.addColorStop(0, "rgba(200,200,220,0.06)");
      gradient.addColorStop(1, "rgba(200,200,220,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "dust": {
      ctx.fillStyle = "rgba(255,240,220,0.6)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════

export function WeatherEffects({ weather, timeOfDay }: WeatherEffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);

  const config = useMemo(() => {
    const wc = parseWeather(weather);
    const tc = parseTime(timeOfDay, wc.type);
    return { ...wc, ...tc };
  }, [weather, timeOfDay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles
    particlesRef.current = [];
    const w = canvas.width;
    const h = canvas.height;

    for (let i = 0; i < config.count; i++) {
      particlesRef.current.push(createParticle(config.type, w, h));
    }
    if (config.addFireflies) {
      for (let i = 0; i < 15; i++) {
        particlesRef.current.push(createParticle("firefly", w, h));
      }
    }
    if (config.addStars) {
      for (let i = 0; i < 30; i++) {
        particlesRef.current.push(createParticle("star", w, h));
      }
    }

    const tick = () => {
      if (!running) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw ambient overlay tint
      if (config.tint) {
        ctx.fillStyle = config.tint;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (config.overlay) {
        ctx.fillStyle = config.overlay;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Wobble for organic movement
        if (p.type === "snow" || p.type === "leaf" || p.type === "petal") {
          p.wobble += 0.02;
          p.x += Math.sin(p.wobble) * 0.5;
        }
        if (p.type === "firefly") {
          p.wobble += 0.03;
          p.x += Math.sin(p.wobble) * 0.8;
          p.y += Math.cos(p.wobble * 0.7) * 0.4;
        }

        drawParticle(ctx, p);

        // Respawn if off-screen or expired
        const offScreen =
          p.y > canvas.height + 20 ||
          p.y < -20 ||
          p.x > canvas.width + 20 ||
          p.x < -20;
        if (offScreen || p.life > p.maxLife) {
          particles[i] = createParticle(p.type, canvas.width, canvas.height, true);
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[5]"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
