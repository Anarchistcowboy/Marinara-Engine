// ──────────────────────────────────────────────
// Chat: Main chat area — mode-aware rendering
// ──────────────────────────────────────────────
import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useChatMessages, useChat, useDeleteMessage, useCreateChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useGenerate } from "../../hooks/use-generate";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatSettingsDrawer } from "./ChatSettingsDrawer";
import { ChatFilesDrawer } from "./ChatFilesDrawer";
import { RoleplayHUD } from "./RoleplayHUD";
import { WeatherEffects } from "./WeatherEffects";
import { SpriteOverlay } from "./SpriteOverlay";
import { MessageSquare, BookOpen, Theater, Settings2, FolderOpen, Swords } from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { EncounterModal } from "./EncounterModal";
import { useEncounter } from "../../hooks/use-encounter";
import { useEncounterStore } from "../../stores/encounter.store";

/** Map characterId → { name, avatarUrl, colors } */
export type CharacterMap = Map<string, {
  name: string;
  avatarUrl: string | null;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
}>;

export function ChatArea() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamBuffer = useChatStore((s) => s.streamBuffer);
  const chatBackground = useUIStore((s) => s.chatBackground);
  const weatherEffects = useUIStore((s) => s.weatherEffects);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);

  const { data: chat } = useChat(activeChatId);
  const { data: messages, isLoading } = useChatMessages(activeChatId);
  const { data: allCharacters } = useCharacters();
  const { data: allPersonas } = usePersonas();
  const deleteMessage = useDeleteMessage(activeChatId);
  const createChat = useCreateChat();
  const { generate } = useGenerate();
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);

  const handleQuickStart = useCallback((mode: "conversation" | "roleplay") => {
    const label = mode === "conversation" ? "Conversation" : "Roleplay";
    createChat.mutate(
      { name: `New ${label}`, mode, characterIds: [] },
      { onSuccess: (chat) => setActiveChatId(chat.id) },
    );
  }, [createChat, setActiveChatId]);

  // Build character lookup map
  const characterMap: CharacterMap = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl: string | null; nameColor?: string; dialogueColor?: string; boxColor?: string }>();
    if (!allCharacters) return map;
    for (const char of allCharacters as Array<{ id: string; data: string; avatarPath: string | null }>) {
      try {
        const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
        map.set(char.id, {
          name: parsed.name ?? "Unknown",
          avatarUrl: char.avatarPath ?? null,
          nameColor: parsed.extensions?.nameColor || undefined,
          dialogueColor: parsed.extensions?.dialogueColor || undefined,
          boxColor: parsed.extensions?.boxColor || undefined,
        });
      } catch {
        map.set(char.id, { name: "Unknown", avatarUrl: null });
      }
    }
    return map;
  }, [allCharacters]);

  // Active persona colors (for user message styling)
  const personaColors = useMemo(() => {
    if (!allPersonas) return undefined;
    const active = (allPersonas as Array<{ isActive: string | boolean; nameColor?: string; dialogueColor?: string; boxColor?: string }>).find(
      (p) => p.isActive === "true" || p.isActive === true,
    );
    if (!active) return undefined;
    return {
      nameColor: active.nameColor || undefined,
      dialogueColor: active.dialogueColor || undefined,
      boxColor: active.boxColor || undefined,
    };
  }, [allPersonas]);

  const chatMode = (chat as unknown as { mode?: string })?.mode ?? "conversation";
  const isRoleplay = chatMode === "roleplay" || chatMode === "visual_novel";
  const { startEncounter } = useEncounter();
  const encounterActive = useEncounterStore((s) => s.active || s.showConfigModal);

  // Count characters in this chat
  const chatCharIds: string[] = chat
    ? typeof (chat as unknown as { characterIds: unknown }).characterIds === "string"
      ? JSON.parse((chat as unknown as { characterIds: string }).characterIds)
      : (chat.characterIds ?? [])
    : [];

  const handleDelete = useCallback(
    (messageId: string) => {
      deleteMessage.mutate(messageId);
    },
    [deleteMessage],
  );

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!activeChatId || isStreaming) return;
      const msgIndex = messages?.findIndex((m) => m.id === messageId) ?? -1;
      if (msgIndex < 0 || !messages) return;

      const toDelete = messages.slice(msgIndex);
      for (const msg of toDelete) {
        await deleteMessage.mutateAsync(msg.id);
      }

      await generate({ chatId: activeChatId, connectionId: null });
    },
    [activeChatId, isStreaming, messages, deleteMessage, generate],
  );

  useEffect(() => {
    if (chat) setActiveChat(chat);
  }, [chat, setActiveChat]);

  // Auto-scroll on new messages / streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  // ═══════════════════════════════════════════════
  // Empty state (no active chat)
  // ═══════════════════════════════════════════════
  if (!activeChatId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        {/* Central hero */}
        <div className="relative">
          <div className="animate-pulse-ring bunny-glow flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-400 to-orange-500 shadow-xl shadow-orange-500/20">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3c0 1.5 1 2 1 3.5S8 9 8 9" opacity=".6" />
              <path d="M12 2c0 1.5 1 2 1 3.5S12 8 12 8" opacity=".6" />
              <path d="M16 3c0 1.5 1 2 1 3.5S16 9 16 9" opacity=".6" />
              <path d="M3 11h18" />
              <path d="M3 11c0 5 4 8 9 8s9-3 9-8" />
              <path d="M8 19c0 1.5 1.5 2 4 2s4-.5 4-2" />
            </svg>
          </div>
        </div>

        <div className="text-center">
          <h3 className="retro-glow-text text-xl font-bold tracking-tight">
            ✧ Marinara Engine ✧
          </h3>
          <p className="mt-2 max-w-xs text-sm text-[var(--muted-foreground)]">
            Select a chat or create a new one to get started
          </p>
        </div>

        <div className="stagger-children flex gap-3">
          <QuickStartCard icon={<MessageSquare size={18} />} label="Conversation" gradient="from-sky-400 to-blue-500" onClick={() => handleQuickStart("conversation")} />
          <QuickStartCard icon={<BookOpen size={18} />} label="Roleplay" gradient="from-pink-400 to-rose-500" onClick={() => handleQuickStart("roleplay")} />
          <QuickStartCard icon={<Theater size={18} />} label="Visual Novel" gradient="from-purple-400 to-violet-500" disabled comingSoon />
        </div>

        <div className="retro-divider w-48" />
      </div>
    );
  }

  // Helper: is this message grouped with the previous one?
  const isGrouped = (i: number) => {
    if (i === 0 || !messages) return false;
    const prev = messages[i - 1];
    const curr = messages[i];
    return prev.role === curr.role && prev.characterId === curr.characterId;
  };

  // ═══════════════════════════════════════════════
  // Roleplay Mode — immersive dark atmosphere
  // ═══════════════════════════════════════════════
  if (isRoleplay) {
    return (
      <div className="rpg-chat-area relative flex flex-1 flex-col overflow-hidden">
        {/* Background layer */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={chatBackground ? { backgroundImage: `url(${chatBackground})` } : undefined}
        />
        {/* Dark atmospheric overlay */}
        <div className="absolute inset-0 rpg-overlay" />
        {/* Vignette effect */}
        <div className="absolute inset-0 rpg-vignette pointer-events-none" />

        {/* Dynamic weather effects */}
        {weatherEffects && (() => {
          const meta = typeof chat?.metadata === "string" ? JSON.parse(chat.metadata) : chat?.metadata ?? {};
          const ws = meta.worldState ?? {};
          return <WeatherEffects weather={ws.weather ?? null} timeOfDay={ws.time ?? ws.timeOfDay ?? null} />;
        })()}

        {/* VN-style character sprites */}
        <SpriteOverlay
          characterIds={chatCharIds}
          messages={(messages ?? []).map((m) => ({ role: m.role, characterId: m.characterId, content: m.content }))}
        />

        {/* Chat header with settings */}
        <div className="relative z-20 flex items-center justify-between border-b border-white/5 bg-black/30 px-4 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 text-white">
              <BookOpen size={12} />
            </div>
            <span className="text-sm font-semibold text-white/90">{chat?.name ?? "Roleplay"}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => startEncounter()}
              className="rounded-lg p-1.5 text-white/50 transition-all hover:bg-white/10 hover:text-orange-300"
              title="Start Combat Encounter"
            >
              <Swords size={16} />
            </button>
            <button
              onClick={() => setFilesOpen(true)}
              className="rounded-lg p-1.5 text-white/50 transition-all hover:bg-white/10 hover:text-white/80"
              title="Manage Chat Files"
            >
              <FolderOpen size={16} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-1.5 text-white/50 transition-all hover:bg-white/10 hover:text-white/80"
              title="Chat Settings"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>

        {/* HUD overlay */}
        {chat && <RoleplayHUD chat={chat} characterCount={chatCharIds.length} />}

        {/* Combat Encounter Modal */}
        {encounterActive && <EncounterModal />}

        {/* Messages scroll area */}
        <div className="relative z-10 flex-1 overflow-y-auto px-3 py-4">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
            </div>
          )}

          {messages?.map((msg, i) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              index={i}
              onDelete={handleDelete}
              onRegenerate={handleRegenerate}
              characterMap={characterMap}
              personaColors={personaColors}
              chatMode={chatMode}
              isGrouped={isGrouped(i)}
            />
          ))}

          {/* Streaming indicator */}
          {isStreaming && streamBuffer && (
            <div className="animate-message-in">
              <ChatMessage
                message={{
                  id: "__streaming__",
                  chatId: activeChatId,
                  role: "assistant",
                  characterId: null,
                  content: streamBuffer,
                  activeSwipeIndex: 0,
                  extra: { displayText: null, isGenerated: true, tokenCount: 0, generationInfo: null },
                  createdAt: new Date().toISOString(),
                }}
                isStreaming
                index={-1}
                characterMap={characterMap}
              personaColors={personaColors}
                chatMode={chatMode}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area — semi-transparent */}
        <div className="relative z-20">
          <ChatInput mode="roleplay" />
        </div>

        {/* Settings drawer */}
        {chat && (
          <ChatSettingsDrawer chat={chat} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        )}
        {/* Chat files drawer */}
        {chat && (
          <ChatFilesDrawer chat={chat} open={filesOpen} onClose={() => setFilesOpen(false)} />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // Conversation Mode — clean texting style
  // ═══════════════════════════════════════════════
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {/* Character avatar stack or icon */}
          {chatCharIds.length > 0 ? (
            <div className="flex -space-x-2">
              {chatCharIds.slice(0, 3).map((cid) => {
                const info = characterMap.get(cid);
                return info?.avatarUrl ? (
                  <img
                    key={cid}
                    src={info.avatarUrl}
                    alt={info.name}
                    className="h-7 w-7 rounded-full object-cover ring-2 ring-[var(--background)]"
                  />
                ) : (
                  <div
                    key={cid}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold ring-2 ring-[var(--background)]"
                  >
                    {(info?.name ?? "?")[0]}
                  </div>
                );
              })}
              {chatCharIds.length > 3 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--secondary)] text-[9px] font-bold ring-2 ring-[var(--background)]">
                  +{chatCharIds.length - 3}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-white">
              <MessageSquare size={12} />
            </div>
          )}
          <div>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {chat?.name ?? "Conversation"}
            </span>
            {chatCharIds.length > 0 && (
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {chatCharIds.map((cid) => characterMap.get(cid)?.name).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => startEncounter()}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-orange-400"
            title="Start Combat Encounter"
          >
            <Swords size={16} />
          </button>
          <button
            onClick={() => setFilesOpen(true)}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Manage Chat Files"
          >
            <FolderOpen size={16} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Chat Settings"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Combat Encounter Modal */}
      {encounterActive && <EncounterModal />}

      {/* Messages area */}
      <div className="relative flex-1 overflow-hidden">
        {chatBackground && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${chatBackground})` }}
            />
            <div className="absolute inset-0 bg-[var(--background)]/60" />
          </>
        )}
        <div className="relative h-full overflow-y-auto px-4 py-4">

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="shimmer h-12 w-12 rounded-xl" />
            <div className="shimmer h-3 w-32 rounded-full" />
          </div>
        )}

        {messages?.map((msg, i) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            index={i}
            onDelete={handleDelete}
            onRegenerate={handleRegenerate}
            characterMap={characterMap}
              personaColors={personaColors}
            chatMode={chatMode}
            isGrouped={isGrouped(i)}
          />
        ))}

        {/* Streaming */}
        {isStreaming && streamBuffer && (
          <div className="animate-message-in">
            <ChatMessage
              message={{
                id: "__streaming__",
                chatId: activeChatId,
                role: "assistant",
                characterId: null,
                content: streamBuffer,
                activeSwipeIndex: 0,
                extra: { displayText: null, isGenerated: true, tokenCount: 0, generationInfo: null },
                createdAt: new Date().toISOString(),
              }}
              isStreaming
              index={-1}
              characterMap={characterMap}
              personaColors={personaColors}
              chatMode={chatMode}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="relative">
        <ChatInput mode="conversation" />
      </div>

      {/* Settings drawer */}
      {chat && (
        <ChatSettingsDrawer chat={chat} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
      {/* Chat files drawer */}
      {chat && (
        <ChatFilesDrawer chat={chat} open={filesOpen} onClose={() => setFilesOpen(false)} />
      )}
    </div>
  );
}

function QuickStartCard({ icon, label, gradient, onClick, disabled, comingSoon }: { icon: React.ReactNode; label: string; gradient: string; onClick?: () => void; disabled?: boolean; comingSoon?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={cn(
        "group card-3d-tilt flex w-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-[var(--y2k-purple)]/20 bg-[var(--card)] p-4 text-center transition-all",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "cursor-pointer hover:-translate-y-1 hover:border-[var(--y2k-pink)]/40 hover:shadow-lg hover:shadow-pink-500/10",
      )}
    >
      {comingSoon && (
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Coming Soon</span>
      )}
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm transition-transform ${disabled ? '' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}
