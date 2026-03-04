// ──────────────────────────────────────────────
// Chat: Message — mode-aware rendering
// ──────────────────────────────────────────────
import { cn } from "../../lib/utils";
import { User, Bot, ChevronLeft, ChevronRight, Copy, RefreshCw, Trash2 } from "lucide-react";
import type { Message } from "@rpg-engine/shared";
import { useState, useMemo, type ReactNode } from "react";
import type { CharacterMap } from "./ChatArea";
import { useApplyRegex } from "../../hooks/use-apply-regex";

interface PersonaColors {
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
}

interface ChatMessageProps {
  message: Message & { swipes?: Array<{ id: string; content: string }> };
  isStreaming?: boolean;
  index: number;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  characterMap?: CharacterMap;
  chatMode?: string;
  /** Whether previous message is from the same sender (for grouping) */
  isGrouped?: boolean;
  /** Active persona's color settings (for user messages) */
  personaColors?: PersonaColors;
}

/**
 * Highlight quoted dialogue — text in "", "", «», or '' gets bold + colored.
 * Returns an array of ReactNodes (strings + <strong> elements).
 */
function highlightDialogue(text: string, dialogueColor?: string): ReactNode[] {
  // Match text in various quotation marks
  const regex = /(?:"([^"]+)"|"([^"]+)"|«([^»]+)»|'([^']+)')/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    // The full match including quotes
    const fullMatch = match[0];
    // Determine which capture group matched
    const innerText = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    // Get the opening and closing quotes from the full match
    const openQuote = fullMatch[0];
    const closeQuote = fullMatch[fullMatch.length - 1];

    nodes.push(
      <strong
        key={key++}
        style={dialogueColor ? { color: dialogueColor } : undefined}
        className={!dialogueColor ? "text-white" : undefined}
      >
        {openQuote}{innerText}{closeQuote}
      </strong>,
    );
    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

/** Build style object for name color (supports gradients). */
function nameColorStyle(color?: string): React.CSSProperties | undefined {
  if (!color) return undefined;
  if (color.startsWith("linear-gradient")) {
    return {
      background: color,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    };
  }
  return { color };
}

export function ChatMessage({
  message,
  isStreaming,
  index,
  onDelete,
  onRegenerate,
  characterMap,
  chatMode,
  isGrouped,
  personaColors,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isNarrator = message.role === "narrator";
  const isRoleplay = chatMode === "roleplay" || chatMode === "visual_novel";
  const [copied, setCopied] = useState(false);

  // Apply regex scripts to AI output (assistant/narrator roles)
  const { applyToAIOutput } = useApplyRegex();
  const displayContent = useMemo(() => {
    if (isUser || isSystem) return message.content;
    return applyToAIOutput(message.content);
  }, [message.content, isUser, isSystem, applyToAIOutput]);

  // Resolve character info
  const charInfo =
    message.characterId && characterMap
      ? characterMap.get(message.characterId)
      : null;
  const displayName = isUser
    ? "You"
    : (charInfo?.name ?? message.characterId ?? "Assistant");
  const avatarUrl = charInfo?.avatarUrl ?? null;

  // Resolve colors: character colors for assistant, persona colors for user
  const msgColors = isUser ? personaColors : charInfo;
  const dialogueColor = msgColors?.dialogueColor;
  const boxBgColor = msgColors?.boxColor;
  const msgNameColor = msgColors?.nameColor;

  // Render content with dialogue highlighting
  const renderedContent = useMemo(() => {
    const text = typeof displayContent === "string" ? displayContent : message.content;
    return highlightDialogue(text, dialogueColor);
  }, [displayContent, message.content, dialogueColor]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ─── System messages (shared across modes) ───
  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="rounded-full bg-[var(--secondary)]/80 px-4 py-1.5 text-[11px] text-[var(--muted-foreground)] backdrop-blur-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // Roleplay Mode — immersive narrative
  // ═══════════════════════════════════════════════
  if (isRoleplay) {
    // Narrator messages
    if (isNarrator) {
      return (
        <div
          className="rpg-narrator-msg animate-message-in mb-4 px-2"
          style={{ animationDelay: `${Math.min(index * 30, 200)}ms`, animationFillMode: "backwards" }}
        >
          <div className="rounded-xl border border-amber-500/10 bg-black/30 px-5 py-4 backdrop-blur-md">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">
              <span className="h-px flex-1 bg-amber-400/20" />
              Narrator
              <span className="h-px flex-1 bg-amber-400/20" />
            </div>
            <div className="whitespace-pre-wrap text-[13px] leading-[1.8] text-amber-100/80 italic">
              {displayContent}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "group mb-4 flex gap-3 animate-message-in px-2",
          isUser && "flex-row-reverse",
        )}
        style={{ animationDelay: `${Math.min(index * 30, 200)}ms`, animationFillMode: "backwards" }}
      >
        {/* Avatar Column */}
        {!isGrouped && (
          <div className="flex-shrink-0 pt-1">
            {avatarUrl && !isUser ? (
              <div className="rpg-avatar-glow">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                />
              </div>
            ) : (
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full ring-2 shadow-lg",
                  isUser
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 ring-blue-400/20"
                    : "bg-gradient-to-br from-purple-500 to-pink-600 ring-purple-400/20",
                )}
              >
                {isUser ? (
                  <User size={16} className="text-white" />
                ) : (
                  <Bot size={16} className="text-white" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Spacer if grouped (no avatar) */}
        {isGrouped && <div className="w-10 flex-shrink-0" />}

        {/* Content */}
        <div className={cn("flex max-w-[82%] flex-col gap-0.5", isUser && "items-end")}>
          {/* Name + time (only if not grouped) */}
          {!isGrouped && (
            <div className={cn("flex items-baseline gap-2 px-1", isUser && "flex-row-reverse")}>
              <span
                className={cn(
                  "text-[12px] font-bold tracking-tight",
                  !msgNameColor && (isUser ? "text-blue-300" : "rpg-char-name"),
                )}
                style={nameColorStyle(msgNameColor)}
              >
                {displayName}
              </span>
              <span className="text-[10px] text-white/30">
                {formatTime(message.createdAt)}
              </span>
            </div>
          )}

          {/* Message bubble */}
          <div
            className={cn(
              "relative rounded-2xl px-4 py-3 text-[13px] leading-[1.8] backdrop-blur-md",
              isUser
                ? "rounded-tr-sm text-blue-50 ring-1 ring-blue-400/15"
                : "rounded-tl-sm text-white/90 ring-1 ring-white/8",
              !boxBgColor && (isUser ? "bg-blue-600/30" : "bg-white/8"),
              isGrouped && (isUser ? "rounded-tr-2xl" : "rounded-tl-2xl"),
              isStreaming && "rpg-streaming",
            )}
            style={boxBgColor ? { backgroundColor: boxBgColor } : undefined}
          >
            <div className="whitespace-pre-wrap break-words">
              {renderedContent}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full bg-blue-400" />
              )}
            </div>
          </div>

          {/* Swipes */}
          {message.swipes && message.swipes.length > 1 && (
            <div className="flex items-center gap-1.5 px-1 text-[10px] text-white/40">
              <button className="rounded-md p-0.5 transition-colors hover:bg-white/10">
                <ChevronLeft size={12} />
              </button>
              <span className="tabular-nums">1/{message.swipes.length}</span>
              <button className="rounded-md p-0.5 transition-colors hover:bg-white/10">
                <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Hover actions */}
          <div
            className={cn(
              "flex items-center gap-0.5 px-1 opacity-0 transition-all group-hover:opacity-100",
              isUser && "flex-row-reverse",
            )}
          >
            <ActionBtn icon={copied ? "✓" : <Copy size={11} />} onClick={handleCopy} title="Copy" dark />
            <ActionBtn icon={<RefreshCw size={11} />} onClick={() => onRegenerate?.(message.id)} title="Regenerate" dark />
            <ActionBtn icon={<Trash2 size={11} />} onClick={() => onDelete?.(message.id)} title="Delete" className="hover:text-red-400" dark />
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // Conversation Mode — iMessage / texting style
  // ═══════════════════════════════════════════════
  return (
    <div
      className={cn(
        "group flex animate-message-in",
        isUser ? "justify-end" : "justify-start",
        isGrouped ? "mb-0.5" : "mb-3",
      )}
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms`, animationFillMode: "backwards" }}
    >
      <div className={cn("flex max-w-[72%] gap-2", isUser && "flex-row-reverse")}>
        {/* Avatar — only show for first in group (not user) */}
        {!isUser && (
          <div className={cn("flex-shrink-0 self-end", isGrouped && "invisible")}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-[var(--muted-foreground)]">
                {displayName[0]}
              </div>
            )}
          </div>
        )}

        <div className={cn("flex flex-col gap-0.5", isUser ? "items-end" : "items-start")}>
          {/* Name — only for first in group */}
          {!isGrouped && !isUser && (
            <span
              className={cn(
                "px-3 text-[11px] font-semibold",
                !msgNameColor && "text-[var(--muted-foreground)]",
              )}
              style={nameColorStyle(msgNameColor)}
            >
              {displayName}
            </span>
          )}

          {/* Bubble */}
          <div
            className={cn(
              "texting-bubble relative px-3.5 py-2 text-[14px] leading-[1.6]",
              isUser
                ? "texting-bubble-user rounded-2xl rounded-br-md"
                : "texting-bubble-other rounded-2xl rounded-bl-md",
              isGrouped && isUser && "rounded-br-2xl rounded-tr-md",
              isGrouped && !isUser && "rounded-bl-2xl rounded-tl-md",
              isStreaming && "ring-2 ring-[var(--primary)]/20",
            )}
            style={boxBgColor ? { backgroundColor: boxBgColor } : undefined}
          >
            <div className="whitespace-pre-wrap break-words">
              {renderedContent}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full bg-white/70" />
              )}
            </div>
          </div>

          {/* Timestamp — only for last in a group or standalone */}
          {!isGrouped && (
            <span
              className={cn(
                "px-3 text-[10px] text-[var(--muted-foreground)]/50",
                isUser && "text-right",
              )}
            >
              {formatTime(message.createdAt)}
            </span>
          )}

          {/* Swipes */}
          {message.swipes && message.swipes.length > 1 && (
            <div className="flex items-center gap-1.5 px-2 text-[10px] text-[var(--muted-foreground)]">
              <button className="rounded p-0.5 transition-colors hover:bg-[var(--accent)]">
                <ChevronLeft size={11} />
              </button>
              <span className="tabular-nums">1/{message.swipes.length}</span>
              <button className="rounded p-0.5 transition-colors hover:bg-[var(--accent)]">
                <ChevronRight size={11} />
              </button>
            </div>
          )}

          {/* Hover actions */}
          <div
            className={cn(
              "flex items-center gap-0 px-1 opacity-0 transition-all group-hover:opacity-100",
              isUser && "flex-row-reverse",
            )}
          >
            <ActionBtn icon={copied ? "✓" : <Copy size={10} />} onClick={handleCopy} title="Copy" />
            <ActionBtn icon={<RefreshCw size={10} />} onClick={() => onRegenerate?.(message.id)} title="Regenerate" />
            <ActionBtn icon={<Trash2 size={10} />} onClick={() => onDelete?.(message.id)} title="Delete" className="hover:text-[var(--destructive)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Action button ──
function ActionBtn({
  icon,
  onClick,
  title,
  className,
  dark,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
  dark?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-md p-1 transition-all active:scale-90",
        dark
          ? "text-white/40 hover:bg-white/10 hover:text-white/70"
          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      {icon}
    </button>
  );
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
