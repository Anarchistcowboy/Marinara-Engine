// ──────────────────────────────────────────────
// Chat: Input — mode-aware styling
// ──────────────────────────────────────────────
import { useState, useRef, useCallback } from "react";
import { Send, Loader2, Paperclip, StopCircle } from "lucide-react";
import { useChatStore } from "../../stores/chat.store";
import { useGenerate } from "../../hooks/use-generate";
import { useApplyRegex } from "../../hooks/use-apply-regex";
import { cn } from "../../lib/utils";

interface ChatInputProps {
  mode?: "conversation" | "roleplay";
}

export function ChatInput({ mode = "conversation" }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const { generate } = useGenerate();
  const { applyToUserInput } = useApplyRegex();

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeChatId || isStreaming) return;

    const message = applyToUserInput(input.trim());
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await generate({
        chatId: activeChatId,
        connectionId: null,
        userMessage: message,
      });
    } catch (error) {
      console.error("Send failed:", error);
    }
  }, [input, activeChatId, isStreaming, generate, applyToUserInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const hasInput = input.trim().length > 0;

  const isRP = mode === "roleplay";

  return (
    <div className={cn(
      "border-t p-3",
      isRP
        ? "border-white/5 bg-black/40 backdrop-blur-md"
        : "glass-strong border-[var(--border)]",
    )}>
      {/* Main input container */}
      <div className={cn(
        "relative flex items-end gap-2 rounded-2xl border-2 px-4 py-3 transition-all duration-200",
        isRP
          ? cn(
              "bg-white/5 backdrop-blur-md",
              hasInput ? "border-blue-400/30 shadow-md shadow-blue-500/5" : "border-white/10",
            )
          : cn(
              "bg-[var(--secondary)]",
              hasInput ? "border-[var(--primary)]/40 shadow-md shadow-[var(--primary)]/5" : "border-[var(--border)]/40",
            ),
      )}>
        {/* Attachment button */}
        <button
          className={cn(
            "mb-0.5 rounded-lg p-1.5 transition-all active:scale-90",
            isRP
              ? "text-white/40 hover:bg-white/10 hover:text-white/70"
              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          )}
          title="Attach file"
        >
          <Paperclip size={16} />
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={activeChatId ? (isRP ? "What do you do?" : "Type a message...") : "Select a chat first"}
          disabled={!activeChatId}
          rows={1}
          className={cn(
            "max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:cursor-not-allowed disabled:opacity-40",
            isRP
              ? "text-white/90 placeholder:text-white/30"
              : "text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
          )}
        />

        {/* Send / Stop button */}
        <button
          onClick={isStreaming ? undefined : handleSend}
          disabled={(!hasInput && !isStreaming) || !activeChatId}
          className={cn(
            "mb-0.5 flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
            isStreaming
              ? "bg-[var(--destructive)] text-white hover:opacity-80"
              : hasInput && activeChatId
                ? isRP
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg active:scale-90"
                  : "bg-gradient-to-br from-[var(--primary)] to-blue-600 text-white shadow-md shadow-[var(--primary)]/20 hover:shadow-lg active:scale-90"
                : isRP ? "text-white/20" : "text-[var(--muted-foreground)]",
          )}
        >
          {isStreaming ? (
            <StopCircle size={16} />
          ) : (
            <Send size={15} className={cn(hasInput && "translate-x-[1px]")} />
          )}
        </button>
      </div>

      {/* Bottom hint */}
      <div className={cn(
        "mt-1.5 flex items-center justify-between px-3 text-[10px]",
        isRP ? "text-white/25" : "text-[var(--muted-foreground)]/60",
      )}>
        <span>Shift+Enter for new line</span>
        {isStreaming && (
          <span className={cn("flex items-center gap-1", isRP ? "text-blue-400" : "text-[var(--primary)]")}>
            <Loader2 size={9} className="animate-spin" />
            Generating...
          </span>
        )}
      </div>
    </div>
  );
}
