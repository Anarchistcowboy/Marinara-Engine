// ──────────────────────────────────────────────
// Layout: Main App Shell (Discord-like three-column)
// ──────────────────────────────────────────────
import { ChatSidebar } from "./ChatSidebar";
import { ChatArea } from "../chat/ChatArea";
import { CharacterEditor } from "../characters/CharacterEditor";
import { LorebookEditor } from "../lorebooks/LorebookEditor";
import { PresetEditor } from "../presets/PresetEditor";
import { ConnectionEditor } from "../connections/ConnectionEditor";
import { AgentEditor } from "../agents/AgentEditor";
import { ToolEditor } from "../agents/ToolEditor";
import { PersonaEditor } from "../personas/PersonaEditor";
import { RegexScriptEditor } from "../agents/RegexScriptEditor";
import { RightPanel } from "./RightPanel";
import { TopBar } from "./TopBar";
import { OnboardingTutorial } from "../onboarding/OnboardingTutorial";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const regexDetailId = useUIStore((s) => s.regexDetailId);

  return (
    <div className="retro-scanlines noise-bg geometric-grid flex h-screen w-screen max-w-[100vw] overflow-hidden bg-[var(--background)]">
      {/* Y2K decorative stars */}
      <div className="y2k-star hidden md:block" style={{ top: '10%', left: '5%', animationDelay: '0s' }} />
      <div className="y2k-star-md hidden md:block" style={{ top: '25%', right: '8%', animationDelay: '1.5s' }} />
      <div className="y2k-star-lg hidden md:block" style={{ top: '60%', left: '3%', animationDelay: '3s' }} />
      <div className="y2k-star hidden md:block" style={{ top: '80%', right: '12%', animationDelay: '0.8s' }} />
      <div className="y2k-star-md hidden md:block" style={{ top: '45%', left: '50%', animationDelay: '2.2s' }} />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar - Chat list */}
      <aside
        data-tour="sidebar"
        className={cn(
          "flex-shrink-0 overflow-hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          // Mobile: fixed overlay
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl",
          !sidebarOpen && "max-md:!w-0",
        )}
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
      >
        <div className="h-full" style={{ width: sidebarWidth }}>
          <ChatSidebar />
        </div>
      </aside>

      {/* Center content */}
      <div data-tour="chat-area" className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        {regexDetailId ? <RegexScriptEditor /> : personaDetailId ? <PersonaEditor /> : toolDetailId ? <ToolEditor /> : agentDetailId ? <AgentEditor /> : connectionDetailId ? <ConnectionEditor /> : presetDetailId ? <PresetEditor /> : characterDetailId ? <CharacterEditor /> : lorebookDetailId ? <LorebookEditor /> : <ChatArea />}
      </div>

      {/* Mobile right panel backdrop */}
      {rightPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => closeRightPanel()}
        />
      )}

      {/* Right panel - Context / Settings */}
      <AnimatePresence mode="wait">
        {rightPanelOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className={cn(
              "flex-shrink-0 overflow-hidden border-l border-[var(--sidebar-border)] bg-[var(--sidebar)]",
              // Mobile: fixed full-width overlay  
              "max-md:!fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:!w-full max-md:max-w-[100vw] max-md:shadow-2xl",
            )}
          >
            <div className="h-full max-md:w-full" style={{ width: 320 }}>
              <RightPanel />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* First-time onboarding tutorial */}
      <OnboardingTutorial />
    </div>
  );
}
