// ──────────────────────────────────────────────
// Layout: Top Bar (polished, with hover glow)
// ──────────────────────────────────────────────
import {
  PanelLeft,
  Settings,
  Link,
  BookOpen,
  Users,
  Sparkles,
  FileText,
  Gamepad2,
  MessageSquare,
  Theater,
  UserCircle,
} from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";

const RIGHT_PANEL_BUTTONS = [
  { panel: "characters" as const, icon: Users, label: "Characters", color: "from-pink-400 to-rose-500" },
  { panel: "lorebooks" as const, icon: BookOpen, label: "Lorebooks", color: "from-amber-400 to-orange-500" },
  { panel: "presets" as const, icon: FileText, label: "Presets", color: "from-purple-400 to-violet-500" },
  { panel: "connections" as const, icon: Link, label: "Connections", color: "from-sky-400 to-blue-500" },
  { panel: "agents" as const, icon: Sparkles, label: "Agents", color: "from-pink-300 to-purple-400" },
  { panel: "personas" as const, icon: UserCircle, label: "Personas", color: "from-emerald-400 to-teal-500" },
  { panel: "settings" as const, icon: Settings, label: "Settings", color: "from-gray-400 to-gray-500" },
] as const;

const MODE_ICONS: Record<string, React.ReactNode> = {
  conversation: <MessageSquare size={14} />,
  roleplay: <BookOpen size={14} />,
  visual_novel: <Theater size={14} />,
};

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const activeChat = useChatStore((s) => s.activeChat);

  return (
    <header className="glass-strong relative flex h-12 flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
      {/* Pastel gradient top accent */}
      <div className="pastel-gradient pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-80" />

      {/* Left section: window controls + chat info */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--y2k-pink)] active:scale-95"
          title="Toggle sidebar"
        >
          <PanelLeft size={18} />
        </button>

        {activeChat && (
          <div className="flex animate-fade-in-up items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-sm">
              {MODE_ICONS[activeChat.mode] ?? <Gamepad2 size={14} />}
            </div>
            <span className="text-sm font-semibold tracking-tight text-[var(--y2k-lavender)]">{activeChat.name}</span>
            <span className="retro-badge">
              {activeChat.mode.replace("_", " ")}
            </span>
          </div>
        )}
      </div>

      {/* Right section - Panel toggles */}
      <div data-tour="panel-buttons" className="flex items-center gap-0.5 rounded-xl border border-[var(--y2k-purple)]/20 bg-[var(--secondary)]/50 p-1 max-sm:gap-0 max-sm:p-0.5">
        {RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, color }) => {
          const isActive = rightPanelOpen && rightPanel === panel;
          return (
            <button
              key={panel}
              onClick={() => toggleRightPanel(panel)}
              className={cn(
                "relative rounded-lg p-2 transition-all duration-200 max-sm:p-1.5",
                isActive
                  ? "bg-[var(--accent)] text-[var(--y2k-pink)] shadow-sm shadow-pink-500/10"
                  : "text-[var(--muted-foreground)] hover:text-[var(--y2k-pink)]",
              )}
              title={label}
            >
              <Icon size={15} />
              {isActive && (
                <span className={cn("absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r", color)} />
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
