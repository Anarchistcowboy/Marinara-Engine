// ──────────────────────────────────────────────
// Choice Selection Modal
// Shows when a preset with choice blocks is
// assigned to a chat for the first time.
// ──────────────────────────────────────────────
import { useState, useMemo, useEffect, useCallback } from "react";
import { Modal } from "../ui/Modal";
import { usePresetFull } from "../../hooks/use-presets";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

interface ChoiceSelectionModalProps {
  open: boolean;
  onClose: () => void;
  presetId: string;
  chatId: string;
  /** Existing selections to pre-populate */
  existingChoices?: Record<string, string>;
}

interface ChoiceOption {
  id: string;
  label: string;
  content: string;
}

interface ChoiceBlockData {
  id: string;
  sectionId: string;
  label: string;
  options: ChoiceOption[];
}

export function ChoiceSelectionModal({
  open,
  onClose,
  presetId,
  chatId,
  existingChoices = {},
}: ChoiceSelectionModalProps) {
  const { data } = usePresetFull(presetId);
  const updateMetadata = useUpdateChatMetadata();

  // Local selections: sectionId → optionId
  const [selections, setSelections] = useState<Record<string, string>>({});

  // Parse choice blocks from preset data
  const choiceBlocks = useMemo<ChoiceBlockData[]>(() => {
    if (!data?.choiceBlocks) return [];
    return (data.choiceBlocks as any[]).map((cb: any) => {
      let opts: ChoiceOption[] = [];
      try {
        opts = typeof cb.options === "string" ? JSON.parse(cb.options) : cb.options ?? [];
      } catch {
        /* empty */
      }
      return {
        id: cb.id,
        sectionId: cb.sectionId,
        label: cb.label ?? "Choose an option",
        options: opts,
      };
    });
  }, [data?.choiceBlocks]);

  // Pre-populate from existing choices
  useEffect(() => {
    if (!choiceBlocks.length) return;
    const initial: Record<string, string> = {};
    for (const cb of choiceBlocks) {
      if (existingChoices[cb.sectionId]) {
        initial[cb.sectionId] = existingChoices[cb.sectionId];
      } else if (cb.options.length > 0) {
        // Default to first option
        initial[cb.sectionId] = cb.options[0].id;
      }
    }
    setSelections(initial);
  }, [choiceBlocks, existingChoices]);

  const allSelected = choiceBlocks.every((cb) => selections[cb.sectionId]);

  const handleConfirm = useCallback(() => {
    updateMetadata.mutate(
      { id: chatId, presetChoices: selections },
      { onSuccess: () => onClose() },
    );
  }, [chatId, selections, updateMetadata, onClose]);

  if (!choiceBlocks.length) return null;

  return (
    <Modal open={open} onClose={onClose} title="Configure Preset Choices" width="max-w-lg">
      <div className="space-y-4 p-4">
        <p className="text-xs text-[var(--muted-foreground)]">
          This preset has configurable choice blocks. Select an option for each to customize your experience.
        </p>

        {choiceBlocks.map((cb) => (
          <div key={cb.id} className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
            <h4 className="mb-2 text-xs font-semibold text-[var(--foreground)]">
              {cb.label}
            </h4>
            <div className="space-y-1.5">
              {cb.options.map((opt) => {
                const isSelected = selections[cb.sectionId] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setSelections((prev) => ({ ...prev, [cb.sectionId]: opt.id }))
                    }
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all",
                      isSelected
                        ? "bg-purple-400/10 ring-1 ring-purple-400/30"
                        : "hover:bg-[var(--accent)]",
                    )}
                  >
                    {isSelected ? (
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-purple-400" />
                    ) : (
                      <Circle size={14} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className={cn("text-xs font-medium", isSelected && "text-purple-400")}>
                        {opt.label}
                      </span>
                      {opt.content && (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--muted-foreground)]">
                          {opt.content.slice(0, 150)}
                          {opt.content.length > 150 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
          >
            Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allSelected || updateMetadata.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-400 to-violet-500 px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            <Sparkles size={13} />
            {updateMetadata.isPending ? "Saving…" : "Confirm Choices"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
