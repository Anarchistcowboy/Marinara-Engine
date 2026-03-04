// ──────────────────────────────────────────────
// Reusable help tooltip — hover ? icon to see explanation
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface HelpTooltipProps {
  /** The help text to display */
  text: string;
  /** Optional size of the icon (default 12) */
  size?: number;
  /** Preferred position */
  side?: "top" | "bottom" | "left" | "right";
  /** Extra class on the icon wrapper */
  className?: string;
}

export function HelpTooltip({ text, size = 12, side = "top", className }: HelpTooltipProps) {
  const [show, setShow] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  // Reposition if the tooltip overflows the viewport
  useEffect(() => {
    if (!show || !tipRef.current) return;
    const rect = tipRef.current.getBoundingClientRect();
    const el = tipRef.current;
    if (rect.left < 8) el.style.left = "0";
    if (rect.right > window.innerWidth - 8) {
      el.style.left = "auto";
      el.style.right = "0";
    }
    if (rect.top < 8) {
      el.style.top = "100%";
      el.style.bottom = "auto";
      el.style.marginTop = "6px";
    }
  }, [show]);

  return (
    <span
      ref={wrapRef}
      className={cn("relative inline-flex cursor-help", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <HelpCircle
        size={size}
        className="text-[var(--muted-foreground)] opacity-50 transition-opacity hover:opacity-100"
      />
      {show && (
        <div
          ref={tipRef}
          className={cn(
            "pointer-events-none absolute z-[100] w-56 rounded-lg bg-[var(--popover)] px-3 py-2 text-[11px] leading-relaxed text-[var(--popover-foreground)] shadow-xl ring-1 ring-[var(--border)]",
            side === "top" && "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
            side === "bottom" && "top-full left-1/2 mt-1.5 -translate-x-1/2",
            side === "left" && "right-full top-1/2 mr-1.5 -translate-y-1/2",
            side === "right" && "left-full top-1/2 ml-1.5 -translate-y-1/2",
          )}
        >
          {text}
        </div>
      )}
    </span>
  );
}

/** Helper: label text followed by a help tooltip icon */
export function LabelWithHelp({
  label,
  help,
  className,
}: {
  label: string;
  help: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {label}
      <HelpTooltip text={help} />
    </span>
  );
}
