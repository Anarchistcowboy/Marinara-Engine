// ──────────────────────────────────────────────
// Layout: Chat Sidebar (polished with rich buttons)
// ──────────────────────────────────────────────
import { Plus, MessageSquare, Search, Trash2, BookOpen, Theater, Lock, GitBranch } from "lucide-react";
import { useChats, useCreateChat, useDeleteChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { useState, useCallback, useMemo } from "react";
import type { ChatMode } from "@rpg-engine/shared";

const MODE_CONFIG: Record<string, { icon: React.ReactNode; label: string; shortLabel: string; gradient: string; description: string; comingSoon?: boolean }> = {
  conversation: {
    icon: <MessageSquare size={14} />,
    label: "Conversation",
    shortLabel: "Chat",
    gradient: "from-sky-400 to-blue-500",
    description: "A straightforward AI conversation — no roleplay elements.",
  },
  roleplay: {
    icon: <BookOpen size={14} />,
    label: "Roleplay",
    shortLabel: "RP",
    gradient: "from-pink-400 to-rose-500",
    description: "Immersive roleplay with characters, game state tracking, and world simulation.",
  },
  visual_novel: {
    icon: <Theater size={14} />,
    label: "Visual Novel",
    shortLabel: "VN",
    gradient: "from-purple-400 to-violet-500",
    description: "Visual novel experience with backgrounds, sprites, text boxes, and choices.",
    comingSoon: true,
  },
};

export function ChatSidebar() {
  const { data: chats, isLoading } = useChats();
  const createChat = useCreateChat();
  const deleteChat = useDeleteChat();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const hasAnyDetailOpen = useUIStore((s) => s.hasAnyDetailOpen);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModePicker, setShowModePicker] = useState(false);

  const filtered = chats?.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ── Collapse chats that share a groupId into one entry ──
  const displayChats = useMemo(() => {
    if (!filtered) return [];

    // Total group sizes from unfiltered chats (for accurate branch count)
    const totalGroupSizes = new Map<string, number>();
    if (chats) {
      for (const chat of chats) {
        if (chat.groupId) {
          totalGroupSizes.set(chat.groupId, (totalGroupSizes.get(chat.groupId) ?? 0) + 1);
        }
      }
    }

    // Sort by most recently updated first
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    const seenGroups = new Set<string>();
    const result: { chat: (typeof filtered)[0]; branchCount: number }[] = [];

    for (const chat of sorted) {
      if (chat.groupId) {
        if (seenGroups.has(chat.groupId)) continue;
        seenGroups.add(chat.groupId);
        result.push({ chat, branchCount: totalGroupSizes.get(chat.groupId) ?? 1 });
      } else {
        result.push({ chat, branchCount: 1 });
      }
    }

    return result;
  }, [chats, filtered]);

  // Detect if active chat belongs to a group (so its group row highlights)
  const activeChat = chats?.find((c) => c.id === activeChatId);
  const activeGroupId = activeChat?.groupId ?? null;

  const handleNewChat = useCallback((mode: ChatMode) => {
    setShowModePicker(false);
    createChat.mutate(
      { name: `New ${MODE_CONFIG[mode]?.label ?? mode}`, mode, characterIds: [] },
      { onSuccess: (chat) => setActiveChatId(chat.id) },
    );
  }, [createChat, setActiveChatId]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--sidebar-border)] px-4 py-3">
        <h2 className="retro-glow-text text-sm font-bold tracking-tight">
          ✧ Chats
        </h2>
        <button
          onClick={() => setShowModePicker(true)}
          className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--sidebar-accent)] hover:text-[var(--y2k-pink)] active:scale-90"
          title="New Chat"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 ring-1 ring-transparent transition-all focus-within:ring-[var(--primary)]/40">
          <Search size={13} className="text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {isLoading && (
          <div className="flex flex-col gap-2 px-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-10 rounded-lg" />
            ))}
          </div>
        )}

        {displayChats.length === 0 && !isLoading && (
          <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
            <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary)]">
              <MessageSquare size={20} className="text-[var(--muted-foreground)]" />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">No chats yet</p>
          </div>
        )}

        <div className="stagger-children flex flex-col gap-0.5">
          {displayChats.map(({ chat, branchCount }) => {
            const cfg = MODE_CONFIG[chat.mode] ?? MODE_CONFIG.conversation;
            const isActive =
              activeChatId === chat.id ||
              (chat.groupId != null && chat.groupId === activeGroupId);

            return (
              <button
                key={chat.groupId ?? chat.id}
                onClick={() => {
                  if (hasAnyDetailOpen()) {
                    if (!window.confirm("You have an editor open. Any unsaved changes will be lost. Continue?")) return;
                    closeAllDetails();
                  }
                  setActiveChatId(chat.id);
                }}
                className={cn(
                  "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                  isActive
                    ? "bg-[var(--sidebar-accent)] shadow-sm"
                    : "hover:bg-[var(--sidebar-accent)]/60",
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className={cn("absolute -left-0.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b", cfg.gradient)} />
                )}

                {/* Mode icon */}
                <div className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs transition-transform group-active:scale-90",
                  isActive
                    ? `bg-gradient-to-br ${cfg.gradient} text-white shadow-sm`
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
                )}>
                  {cfg.icon}
                </div>

                {/* Name + branch count */}
                <div className="min-w-0 flex-1">
                  <span className={cn(
                    "block truncate text-sm",
                    isActive ? "font-medium text-[var(--sidebar-accent-foreground)]" : "text-[var(--sidebar-foreground)]",
                  )}>
                    {chat.name}
                  </span>
                </div>

                {/* Branch count badge */}
                {branchCount > 1 && (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
                    <GitBranch size={10} />
                    {branchCount}
                  </span>
                )}

                {/* Mode badge on hover */}
                <span className="shrink-0 text-[10px] text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100">
                  {cfg.shortLabel}
                </span>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this chat?")) {
                      deleteChat.mutate(chat.id);
                      if (activeChatId === chat.id) setActiveChatId(null);
                    }
                  }}
                  className="shrink-0 rounded-md p-1 opacity-0 transition-all hover:bg-[var(--destructive)]/20 group-hover:opacity-100"
                >
                  <Trash2 size={12} className="text-[var(--destructive)]" />
                </button>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer - New Chat button */}
      <div className="border-t border-[var(--sidebar-border)] p-3">
        <button
          onClick={() => setShowModePicker(true)}
          className="bunny-glow flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 px-3 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/20 transition-all hover:shadow-pink-500/30 active:scale-[0.98]"
        >
          <Plus size={15} />
          New Chat
        </button>
      </div>

      {/* ── Mode Picker Overlay ── */}
      {showModePicker && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[var(--sidebar)]/95 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--sidebar-border)] px-4 py-3">
            <h2 className="text-sm font-bold">New Chat</h2>
            <button
              onClick={() => setShowModePicker(false)}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--sidebar-accent)]"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-4 text-xs text-[var(--muted-foreground)]">
              Choose what kind of experience you want:
            </p>
            <div className="flex flex-col gap-3">
              {(["conversation", "roleplay", "visual_novel"] as const).map((mode) => {
                const cfg = MODE_CONFIG[mode];
                const disabled = cfg.comingSoon;
                return (
                  <button
                    key={mode}
                    onClick={() => !disabled && handleNewChat(mode)}
                    disabled={disabled}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-xl p-4 text-left ring-1 transition-all",
                      disabled
                        ? "cursor-not-allowed opacity-50 ring-[var(--border)]"
                        : "ring-[var(--border)] hover:ring-[var(--primary)] hover:bg-[var(--sidebar-accent)] active:scale-[0.98]",
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                      cfg.gradient,
                      disabled && "grayscale",
                    )}>
                      {cfg.icon}
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{cfg.label}</span>
                        {disabled && (
                          <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[9px] font-medium text-[var(--muted-foreground)]">
                            <Lock size={8} /> Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                        {cfg.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
