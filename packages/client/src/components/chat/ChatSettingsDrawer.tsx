// ──────────────────────────────────────────────
// Chat: Settings Drawer — per-chat configuration
// ──────────────────────────────────────────────
import { useState, useRef, useEffect } from "react";
import {
  X,
  Users,
  BookOpen,
  Sliders,
  Plug,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  Wrench,
  Search,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { useCharacters } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import { useUpdateChat, useUpdateChatMetadata, useChat } from "../../hooks/use-chats";
import type { Chat } from "@rpg-engine/shared";

interface ChatSettingsDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
}

export function ChatSettingsDrawer({ chat, open, onClose }: ChatSettingsDrawerProps) {
  const updateChat = useUpdateChat();
  const updateMeta = useUpdateChatMetadata();

  const { data: allCharacters } = useCharacters();
  const { data: lorebooks } = useLorebooks();
  const { data: presets } = usePresets();
  const { data: connections } = useConnections();

  const chatCharIds: string[] =
    typeof chat.characterIds === "string"
      ? JSON.parse(chat.characterIds)
      : chat.characterIds ?? [];

  const metadata =
    typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata ?? {};
  const activeLorebookIds: string[] = metadata.activeLorebookIds ?? [];

  // ── Helpers ──
  const characters = (allCharacters ?? []) as Array<{
    id: string;
    data: string;
    avatarPath: string | null;
  }>;

  const charName = (c: { data: string }) => {
    try {
      const p = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
      return (p as { name?: string }).name ?? "Unknown";
    } catch {
      return "Unknown";
    }
  };

  // ── Mutations ──
  const toggleCharacter = (charId: string) => {
    const current = [...chatCharIds];
    const idx = current.indexOf(charId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(charId);
    updateChat.mutate({ id: chat.id, characterIds: current });
  };

  const toggleLorebook = (lbId: string) => {
    const current = [...activeLorebookIds];
    const idx = current.indexOf(lbId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(lbId);
    updateMeta.mutate({ id: chat.id, activeLorebookIds: current });
  };

  const setPreset = (presetId: string | null) => {
    updateChat.mutate({ id: chat.id, promptPresetId: presetId });
  };

  const setConnection = (connectionId: string | null) => {
    updateChat.mutate({ id: chat.id, connectionId });
  };

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(chat.name);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [showLbPicker, setShowLbPicker] = useState(false);
  const [charSearch, setCharSearch] = useState("");
  const [lbSearch, setLbSearch] = useState("");

  const saveName = () => {
    if (nameVal.trim() && nameVal !== chat.name) {
      updateChat.mutate({ id: chat.id, name: nameVal.trim() });
    }
    setEditingName(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-bold">Chat Settings</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Chat Name */}
          <Section label="Chat Name">
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  autoFocus
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--primary)]/40"
                />
                <button
                  onClick={saveName}
                  className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs text-white"
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setNameVal(chat.name); setEditingName(true); }}
                className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
              >
                {chat.name}
              </button>
            )}
          </Section>

          {/* Characters — only show added ones + add button */}
          <Section label="Characters" icon={<Users size={14} />} count={chatCharIds.length} help="Characters in this chat. Each character has their own personality that the AI roleplays as.">
            {/* Active characters */}
            {chatCharIds.length === 0 ? (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                No characters added to this chat.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {chatCharIds.map((cid) => {
                  const c = characters.find((ch) => ch.id === cid);
                  if (!c) return null;
                  const name = charName(c);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                    >
                      {c.avatarPath ? (
                        <img src={c.avatarPath} alt={name} className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold">
                          {name[0]}
                        </div>
                      )}
                      <span className="flex-1 truncate text-xs">{name}</span>
                      <button
                        onClick={() => toggleCharacter(c.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        title="Remove from chat"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add character picker */}
            {!showCharPicker ? (
              <button
                onClick={() => { setShowCharPicker(true); setCharSearch(""); }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <Plus size={12} /> Add Character
              </button>
            ) : (
              <PickerDropdown
                search={charSearch}
                onSearchChange={setCharSearch}
                onClose={() => setShowCharPicker(false)}
                placeholder="Search characters…"
              >
                {characters
                  .filter((c) => !chatCharIds.includes(c.id))
                  .filter((c) => charName(c).toLowerCase().includes(charSearch.toLowerCase()))
                  .map((c) => {
                    const name = charName(c);
                    return (
                      <button
                        key={c.id}
                        onClick={() => { toggleCharacter(c.id); setShowCharPicker(false); }}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                      >
                        {c.avatarPath ? (
                          <img src={c.avatarPath} alt={name} className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold">
                            {name[0]}
                          </div>
                        )}
                        <span className="flex-1 truncate text-xs">{name}</span>
                        <Plus size={12} className="text-[var(--muted-foreground)]" />
                      </button>
                    );
                  })}
                {characters.filter((c) => !chatCharIds.includes(c.id)).filter((c) => charName(c).toLowerCase().includes(charSearch.toLowerCase())).length === 0 && (
                  <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                    {characters.filter((c) => !chatCharIds.includes(c.id)).length === 0 ? "All characters already added." : "No matches."}
                  </p>
                )}
              </PickerDropdown>
            )}
          </Section>

          {/* Lorebooks — only show active ones + add button */}
          <Section label="Lorebooks" icon={<BookOpen size={14} />} count={activeLorebookIds.length} help="Lorebooks contain world info, character backstories, and lore that gets injected into the AI's context when relevant keywords appear.">
            {/* Active lorebooks */}
            {activeLorebookIds.length === 0 ? (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                No lorebooks added to this chat.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {activeLorebookIds.map((lbId) => {
                  const lb = (lorebooks ?? []).find((l: { id: string }) => l.id === lbId) as { id: string; name: string } | undefined;
                  if (!lb) return null;
                  return (
                    <div
                      key={lb.id}
                      className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                    >
                      <BookOpen size={14} className="text-[var(--primary)]" />
                      <span className="flex-1 truncate text-xs">{lb.name}</span>
                      <button
                        onClick={() => toggleLorebook(lb.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        title="Remove from chat"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add lorebook picker */}
            {!showLbPicker ? (
              <button
                onClick={() => { setShowLbPicker(true); setLbSearch(""); }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <Plus size={12} /> Add Lorebook
              </button>
            ) : (
              <PickerDropdown
                search={lbSearch}
                onSearchChange={setLbSearch}
                onClose={() => setShowLbPicker(false)}
                placeholder="Search lorebooks…"
              >
                {((lorebooks ?? []) as Array<{ id: string; name: string }>)
                  .filter((lb) => !activeLorebookIds.includes(lb.id))
                  .filter((lb) => lb.name.toLowerCase().includes(lbSearch.toLowerCase()))
                  .map((lb) => (
                    <button
                      key={lb.id}
                      onClick={() => { toggleLorebook(lb.id); setShowLbPicker(false); }}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                    >
                      <BookOpen size={14} className="text-[var(--muted-foreground)]" />
                      <span className="flex-1 truncate text-xs">{lb.name}</span>
                      <Plus size={12} className="text-[var(--muted-foreground)]" />
                    </button>
                  ))}
                {((lorebooks ?? []) as Array<{ id: string; name: string }>)
                  .filter((lb) => !activeLorebookIds.includes(lb.id))
                  .filter((lb) => lb.name.toLowerCase().includes(lbSearch.toLowerCase())).length === 0 && (
                  <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                    {((lorebooks ?? []) as Array<{ id: string }>).filter((lb) => !activeLorebookIds.includes(lb.id)).length === 0 ? "All lorebooks already added." : "No matches."}
                  </p>
                )}
              </PickerDropdown>
            )}
          </Section>

          {/* Preset */}
          <Section label="Prompt Preset" icon={<Sliders size={14} />} help="Presets control how the system prompt is structured and what generation parameters are used. Different presets produce different AI behaviors.">
            <select
              value={chat.promptPresetId ?? ""}
              onChange={(e) => setPreset(e.target.value || null)}
              className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            >
              <option value="">Default</option>
              {((presets ?? []) as Array<{ id: string; name: string }>).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Section>

          {/* Connection */}
          <Section label="Connection" icon={<Plug size={14} />} help="Which AI provider and model to use for this chat. 'Random' picks a different connection each time from your random pool.">
            <select
              value={chat.connectionId ?? ""}
              onChange={(e) => setConnection(e.target.value || null)}
              className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            >
              <option value="">Default</option>
              <option value="random">🎲 Random</option>
              {((connections ?? []) as Array<{ id: string; name: string }>).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {chat.connectionId === "random" && (
              <p className="mt-1.5 text-[10px] text-amber-400/80">
                Each generation will randomly pick from connections marked for the random pool.
              </p>
            )}
          </Section>

          {/* Function Calling / Tool Use */}
          <Section label="Function Calling" icon={<Wrench size={14} />} help="When enabled, the AI can call built-in tools like dice rolls, game state updates, and lorebook searches during conversation.">
            <div className="space-y-2">
              <button
                onClick={() => {
                  updateMeta.mutate({ id: chat.id, enableTools: !metadata.enableTools });
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                  metadata.enableTools
                    ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                )}
              >
                <div>
                  <span className="text-xs font-medium">Enable Tool Use</span>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Allow AI to call functions (dice rolls, game state, etc.)
                  </p>
                </div>
                <div
                  className={cn(
                    "h-5 w-9 rounded-full p-0.5 transition-colors",
                    metadata.enableTools ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/30",
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      metadata.enableTools && "translate-x-4",
                    )}
                  />
                </div>
              </button>
              {metadata.enableTools && (
                <p className="text-[10px] text-[var(--muted-foreground)] px-1">
                  Tools: roll_dice, update_game_state, set_expression, trigger_event, search_lorebook.
                  Multi-call agentic loops enabled (up to 5 rounds per turn).
                </p>
              )}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

// ── Reusable section wrapper ──
function Section({
  label,
  icon,
  count,
  help,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  help?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        {icon && <span className="text-[var(--muted-foreground)]">{icon}</span>}
        <span className="flex-1 text-xs font-semibold">{label}</span>
        {help && <span onClick={(e) => e.stopPropagation()}><HelpTooltip text={help} side="left" /></span>}
        {count != null && count > 0 && (
          <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
            {count}
          </span>
        )}
        <ChevronDown
          size={12}
          className={cn(
            "text-[var(--muted-foreground)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Picker dropdown (for adding characters / lorebooks) ──
function PickerDropdown({
  search,
  onSearchChange,
  onClose,
  placeholder,
  children,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onClose: () => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="mt-2 rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden">
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Search size={12} className="text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
        />
        <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <X size={12} />
        </button>
      </div>
      {/* List */}
      <div className="max-h-48 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
