// ──────────────────────────────────────────────
// Onboarding Tutorial — first-time guided tour
// ──────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { useUIStore } from "../../stores/ui.store";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X, Sparkles, HelpCircle, ArrowRightLeft } from "lucide-react";

// ─── Step definitions ─────────────────────────

interface TourStep {
  /** data-tour attribute value of the element to highlight, or null for centered modal */
  target: string | null;
  title: string;
  body: string;
  /** Preferred side for the tooltip relative to the highlighted element */
  side?: "top" | "bottom" | "left" | "right";
  /** If set, show a special action button with this label */
  actionLabel?: string;
  /** Key used internally to trigger special step actions */
  actionKey?: string;
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: "Welcome to Marinara Engine!",
    body: "Hi! Here's a quick tutorial to show you around. Confident in your skill? Feel free to skip it!",
  },
  {
    target: "sidebar",
    title: "Chat Sidebar",
    body: "This is where all your conversations live. Create new chats, search through them, and organize your history. You can have as many chats as you want!",
    side: "right",
  },
  {
    target: "panel-buttons",
    title: "Tab Buttons",
    body: "These buttons open panels on the right for Characters, Lorebooks, Presets, Connections, Agents, and Settings. Everything you need is one click away!",
    side: "bottom",
  },
  {
    target: "chat-area",
    title: "Chat Area",
    body: "This is your main workspace — where you chat with AI characters, enjoy roleplay, and read generated stories. Messages appear here in real time.",
    side: "left",
  },
  {
    target: null,
    title: "Set Up a Connection",
    body: "Before you start chatting, you'll need to connect an AI provider. Click the chain-link icon (🔗) in the top-right tab buttons, then add your API key for OpenAI, Anthropic, or another provider.",
  },
  {
    target: null,
    title: "Migrating from SillyTavern?",
    body: "If you have characters, chats, or presets from SillyTavern, you can import them all in one go from the Settings panel.",
    actionLabel: "Take Me There",
    actionKey: "migrate",
  },
  {
    target: null,
    title: "You're All Set!",
    body: "Look for the (?) icons throughout the app — hover over them anytime to learn what each option does. Have fun exploring!",
  },
];

// ─── Spotlight overlay helpers ────────────────

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8; // px padding around the spotlight cutout

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function buildClipPath(rect: Rect): string {
  const t = Math.max(0, rect.top - PAD);
  const l = Math.max(0, rect.left - PAD);
  const b = rect.top + rect.height + PAD;
  const r = rect.left + rect.width + PAD;
  const rad = 12; // border-radius in px for the cutout
  // Use inset with round for a nice cutout
  return `polygon(
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${l}px ${t + rad}px,
    ${l + rad}px ${t}px,
    ${r - rad}px ${t}px,
    ${r}px ${t + rad}px,
    ${r}px ${b - rad}px,
    ${r - rad}px ${b}px,
    ${l + rad}px ${b}px,
    ${l}px ${b - rad}px,
    ${l}px ${t + rad}px
  )`;
}

// ─── Tooltip position ─────────────────────────

function computeTooltipStyle(
  rect: Rect,
  side: "top" | "bottom" | "left" | "right" = "right",
): React.CSSProperties {
  const TOOLTIP_W = 320;
  const GAP = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  if (side === "right") {
    top = rect.top + rect.height / 2;
    left = rect.left + rect.width + GAP + PAD;
    if (left + TOOLTIP_W > vw - 16) {
      // flip to left
      left = rect.left - TOOLTIP_W - GAP - PAD;
    }
  } else if (side === "left") {
    top = rect.top + rect.height / 2;
    left = rect.left - TOOLTIP_W - GAP - PAD;
    if (left < 16) {
      left = rect.left + rect.width + GAP + PAD;
    }
  } else if (side === "bottom") {
    top = rect.top + rect.height + GAP + PAD;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  } else {
    top = rect.top - GAP - PAD;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  }

  // Clamp within viewport
  left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16));
  top = Math.max(16, Math.min(top, vh - 240));

  return {
    position: "fixed",
    top,
    left,
    width: TOOLTIP_W,
    transform: side === "right" || side === "left" ? "translateY(-50%)" : undefined,
  };
}

// ─── Card content (shared between centered & positioned variants) ──

function TourCardContent({
  step,
  currentStep,
  isLast,
  onNext,
  onSkip,
  onAction,
}: {
  step: number;
  currentStep: TourStep;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
  onAction?: (key: string) => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        {step === 0 ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md shadow-pink-500/20">
            <Sparkles size={16} />
          </div>
        ) : isLast ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-500/20">
            <HelpCircle size={16} />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)]">
            {step}
          </div>
        )}
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {currentStep.title}
        </h3>
      </div>

      {/* Body */}
      <p className="mb-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
        {currentStep.body}
      </p>

      {/* Progress dots */}
      <div className="mb-3 flex items-center justify-center gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step
                ? "w-4 bg-[var(--primary)]"
                : i < step
                  ? "w-1.5 bg-[var(--primary)]/40"
                  : "w-1.5 bg-[var(--muted-foreground)]/20"
            }`}
          />
        ))}
      </div>

      {/* Action button (e.g. migrate) */}
      {currentStep.actionLabel && currentStep.actionKey && onAction && (
        <button
          onClick={() => onAction(currentStep.actionKey!)}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-2 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/20 active:scale-[0.98]"
        >
          <ArrowRightLeft size={13} />
          {currentStep.actionLabel}
        </button>
      )}

      {/* Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        >
          {step === 0 ? "Skip Tutorial" : "Skip"}
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-[var(--primary-foreground)] shadow-sm transition-all hover:opacity-90 active:scale-95"
        >
          {isLast ? "Get Started" : "Next"}
          {!isLast && <ChevronRight size={12} />}
        </button>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────

export function OnboardingTutorial() {
  const hasCompleted = useUIStore((s) => s.hasCompletedOnboarding);
  const setCompleted = useUIStore((s) => s.setHasCompletedOnboarding);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);

  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const rafRef = useRef<number>(0);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Track the target element position (handles resize/scroll)
  const updateRect = useCallback(() => {
    if (!currentStep?.target) {
      setTargetRect(null);
      return;
    }
    const r = getTargetRect(currentStep.target);
    setTargetRect(r);
    rafRef.current = requestAnimationFrame(updateRect);
  }, [currentStep?.target]);

  useEffect(() => {
    updateRect();
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateRect]);

  const finish = useCallback(() => setCompleted(true), [setCompleted]);

  const handleAction = useCallback((key: string) => {
    if (key === "migrate") {
      openRightPanel("settings");
      setSettingsTab("import");
      finish();
    }
  }, [openRightPanel, setSettingsTab, finish]);

  const next = useCallback(() => {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, finish]);

  if (hasCompleted) return null;

  const isCentered = !currentStep.target || !targetRect;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Centered steps use a flex wrapper so Framer Motion transforms don't override CSS centering */}
      {isCentered ? (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-5 shadow-2xl ring-1 ring-[var(--primary)]/20"
              style={{ width: 380 }}
            >
              <TourCardContent step={step} currentStep={currentStep} isLast={isLast} onNext={next} onSkip={finish} onAction={handleAction} />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-5 shadow-2xl ring-1 ring-[var(--primary)]/20"
            style={computeTooltipStyle(targetRect!, currentStep.side)}
          >
            <TourCardContent step={step} currentStep={currentStep} isLast={isLast} onNext={next} onSkip={finish} onAction={handleAction} />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
