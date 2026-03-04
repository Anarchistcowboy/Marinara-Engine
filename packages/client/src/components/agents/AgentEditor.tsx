// ──────────────────────────────────────────────
// Full-Page Agent Editor
// Click an agent → opens this editor
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo } from "react";
import { useUIStore } from "../../stores/ui.store";
import {
  useAgentConfigs,
  useUpdateAgent,
  useCreateAgent,
  type AgentConfigRow,
} from "../../hooks/use-agents";
import { useConnections } from "../../hooks/use-connections";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Check,
  AlertCircle,
  X,
  Zap,
  Link2,
  FileText,
  RotateCcw,
  Clock,
  Activity,
  Info,
  Wrench,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { useDeleteAgent } from "../../hooks/use-agents";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import {
  BUILT_IN_AGENTS,
  BUILT_IN_TOOLS,
  getDefaultAgentPrompt,
  type AgentPhase,
  type ToolDefinition,
} from "@rpg-engine/shared";

// ═══════════════════════════════════════════════
//  Phase metadata
// ═══════════════════════════════════════════════
const PHASE_META: Record<AgentPhase, { label: string; color: string; icon: typeof Zap; description: string }> = {
  pre_generation: {
    label: "Pre-Generation",
    color: "text-amber-400",
    icon: Zap,
    description: "Runs before the main AI response. Can inject context or modify the prompt.",
  },
  parallel: {
    label: "Parallel",
    color: "text-sky-400",
    icon: Activity,
    description: "Runs alongside or after the main generation. Independent processing.",
  },
  post_processing: {
    label: "Post-Processing",
    color: "text-emerald-400",
    icon: Clock,
    description: "Runs after the main AI response. Can analyze and extract data from it.",
  },
};

// ═══════════════════════════════════════════════
//  Main Editor
// ═══════════════════════════════════════════════
export function AgentEditor() {
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const closeAgentDetail = useUIStore((s) => s.closeAgentDetail);

  const { data: agentConfigs } = useAgentConfigs();
  const { data: connections } = useConnections();
  const updateAgent = useUpdateAgent();
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();

  // Find built-in meta (null for custom agents)
  const builtIn = useMemo(
    () => BUILT_IN_AGENTS.find((a) => a.id === agentDetailId) ?? null,
    [agentDetailId],
  );

  // Find DB config — for built-ins, match by type; for custom agents, match by id
  const dbConfig = useMemo(() => {
    if (!agentDetailId || !agentConfigs) return null;
    return (agentConfigs as AgentConfigRow[]).find(
      (c) => c.type === agentDetailId || c.id === agentDetailId,
    ) ?? null;
  }, [agentDetailId, agentConfigs]);

  // Custom agent = DB entry with no matching built-in
  const isCustomAgent = !builtIn && !!dbConfig;

  // Default prompt for this agent type
  const defaultPrompt = useMemo(
    () => (agentDetailId ? getDefaultAgentPrompt(agentDetailId) : ""),
    [agentDetailId],
  );

  // ── Local editable state ──
  const [localName, setLocalName] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localPhase, setLocalPhase] = useState<AgentPhase>("post_processing");
  const [localConnectionId, setLocalConnectionId] = useState("");
  const [localPrompt, setLocalPrompt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Populate from DB config or built-in defaults
  useEffect(() => {
    if (!agentDetailId) return;
    if (dbConfig) {
      setLocalName(dbConfig.name);
      setLocalDescription(dbConfig.description);
      setLocalPhase(dbConfig.phase as AgentPhase);
      setLocalConnectionId(dbConfig.connectionId ?? "");
      setLocalPrompt(dbConfig.promptTemplate || "");
    } else if (builtIn) {
      setLocalName(builtIn.name);
      setLocalDescription(builtIn.description);
      setLocalPhase(builtIn.phase);
      setLocalConnectionId("");
      setLocalPrompt("");
    } else {
      // Brand new custom agent — start empty
      setLocalName("New Agent");
      setLocalDescription("");
      setLocalPhase("post_processing");
      setLocalConnectionId("");
      setLocalPrompt("");
    }
    setDirty(false);
    setSaveError(null);
  }, [agentDetailId, dbConfig, builtIn]);

  // Whether the prompt textarea shows the default or a custom override
  const isUsingDefaultPrompt = !localPrompt.trim();
  const displayPrompt = isUsingDefaultPrompt ? defaultPrompt : localPrompt;

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeAgentDetail();
  }, [dirty, closeAgentDetail]);

  const openAgentDetail = useUIStore((s) => s.openAgentDetail);

  const handleSave = useCallback(async () => {
    if (!agentDetailId) return;
    setSaveError(null);

    const payload = {
      name: localName,
      description: localDescription,
      phase: localPhase,
      connectionId: localConnectionId || null,
      promptTemplate: localPrompt,
    };

    try {
      if (dbConfig) {
        await updateAgent.mutateAsync({ id: dbConfig.id, ...payload });
      } else {
        // For built-in agents, use their type; for custom, generate a slug
        const typeId = builtIn
          ? agentDetailId
          : `custom-${localName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
        const created = await createAgent.mutateAsync({
          ...payload,
          type: typeId,
          enabled: builtIn?.enabledByDefault ?? true,
        }) as { id?: string } | undefined;
        // After creating a new custom agent, switch agentDetailId to its DB id
        if (!builtIn && created?.id) {
          openAgentDetail(created.id);
        }
      }
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save agent config");
    }
  }, [agentDetailId, localName, localDescription, localPhase, localConnectionId, localPrompt, dbConfig, builtIn, updateAgent, createAgent]);

  const handleResetPrompt = useCallback(() => {
    setLocalPrompt("");
    setDirty(true);
  }, []);

  const handleLoadDefault = useCallback(() => {
    setLocalPrompt(defaultPrompt);
    setDirty(true);
  }, [defaultPrompt]);

  const markDirty = useCallback(() => setDirty(true), []);

  const phaseMeta = PHASE_META[localPhase];

  // ── Loading / not found ──
  if (!agentDetailId || (!builtIn && !dbConfig && agentDetailId !== "__new__")) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted-foreground)]">
        Agent not found.
      </div>
    );
  }

  const handleDelete = async () => {
    if (!dbConfig) return;
    if (!confirm("Delete this custom agent? This cannot be undone.")) return;
    await deleteAgent.mutateAsync(dbConfig.id);
    closeAgentDetail();
  };

  const isPending = updateAgent.isPending || createAgent.isPending;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <button
          onClick={handleClose}
          className="rounded-xl p-2 transition-all hover:bg-[var(--accent)] active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--y2k-pink)] to-[var(--y2k-purple)] text-white shadow-sm">
          <Sparkles size={18} />
        </div>
        <input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            markDirty();
          }}
          className="flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
          placeholder="Agent name…"
        />
        <div className="flex items-center gap-1.5">
          {saveError && (
            <span className="mr-2 flex items-center gap-1 text-[10px] font-medium text-red-400">
              <AlertCircle size={11} /> Save failed
            </span>
          )}
          {savedFlash && !dirty && (
            <span className="mr-2 flex items-center gap-1 text-[10px] font-medium text-emerald-400">
              <Check size={11} /> Saved
            </span>
          )}
          {dirty && !saveError && (
            <span className="mr-2 text-[10px] font-medium text-amber-400">Unsaved</span>
          )}
          {isCustomAgent && dbConfig && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/15 active:scale-[0.98]"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--y2k-pink)] to-[var(--y2k-purple)] px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={13} /> Save
          </button>
        </div>
      </div>

      {/* Unsaved warning */}
      {showUnsavedWarning && (
        <div className="flex items-center justify-between bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <span>You have unsaved changes.</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="rounded-lg px-3 py-1 hover:bg-[var(--accent)]"
            >
              Keep editing
            </button>
            <button
              onClick={() => closeAgentDetail()}
              className="rounded-lg px-3 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
            >
              Discard
            </button>
            <button
              onClick={async () => {
                await handleSave();
                closeAgentDetail();
              }}
              className="rounded-lg bg-amber-500/20 px-3 py-1 hover:bg-amber-500/30"
            >
              Save & close
            </button>
          </div>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          <AlertCircle size={13} />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="rounded-lg px-2 py-0.5 hover:bg-red-500/20">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">

          {/* ── Description ── */}
          <FieldGroup label="Description" icon={<Info size={14} className="text-[var(--y2k-pink)]" />} help="A short summary of what this agent does. Shown in the agents panel to help you identify each agent.">
            <input
              value={localDescription}
              onChange={(e) => {
                setLocalDescription(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="What does this agent do…"
            />
          </FieldGroup>

          {/* ── Pipeline Phase ── */}
          <FieldGroup label="Pipeline Phase" icon={<Zap size={14} className="text-[var(--y2k-pink)]" />} help="When this agent runs during generation. Pre-Generation runs before the AI replies, Parallel runs alongside, Post-Processing runs after the reply is complete.">
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(PHASE_META) as [AgentPhase, typeof phaseMeta][]).map(([phase, meta]) => {
                const isActive = localPhase === phase;
                const Icon = meta.icon;
                return (
                  <button
                    key={phase}
                    onClick={() => {
                      setLocalPhase(phase);
                      markDirty();
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs ring-1 transition-all",
                      isActive
                        ? "bg-[var(--primary)]/10 ring-[var(--primary)] " + meta.color
                        : "ring-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">
              {phaseMeta.description}
            </p>
          </FieldGroup>

          {/* ── Connection Override ── */}
          <FieldGroup label="Connection Override" icon={<Link2 size={14} className="text-[var(--y2k-pink)]" />} help="Use a different AI connection for this agent. For example, use a faster/cheaper model for background processing tasks.">
            <select
              value={localConnectionId}
              onChange={(e) => {
                setLocalConnectionId(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">Use default connection</option>
              {(connections as Array<{ id: string; name: string; provider: string }> | undefined)?.map(
                (conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.provider})
                  </option>
                ),
              )}
            </select>
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
              Optionally use a different API connection for this agent (e.g. a cheaper model for background tasks).
            </p>
          </FieldGroup>

          {/* ── Prompt Template ── */}
          <FieldGroup label="Prompt Template" icon={<FileText size={14} className="text-[var(--y2k-pink)]" />} help="The system instructions this agent receives. Built-in agents have sensible defaults. You can override to customize behavior.">
            {/* Toolbar — only show default/override status for built-in agents */}
            {builtIn && (
              <div className="flex items-center gap-2 mb-2">
                {isUsingDefaultPrompt ? (
                  <span className="flex items-center gap-1 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                    <Check size={10} /> Using built-in default
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-lg bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium text-amber-400">
                    <FileText size={10} /> Custom override
                  </span>
                )}
                <div className="flex-1" />
                {!isUsingDefaultPrompt && (
                  <button
                    onClick={handleResetPrompt}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <RotateCcw size={10} /> Reset to default
                  </button>
                )}
                {isUsingDefaultPrompt && defaultPrompt && (
                  <button
                    onClick={handleLoadDefault}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <FileText size={10} /> Copy default to edit
                  </button>
                )}
              </div>
            )}

            <textarea
              value={builtIn && isUsingDefaultPrompt ? "" : localPrompt}
              onChange={(e) => {
                setLocalPrompt(e.target.value);
                markDirty();
              }}
              rows={16}
              placeholder={builtIn ? (defaultPrompt || "Custom instructions for this agent…") : "Write the system prompt for this agent…"}
              className="w-full resize-y rounded-xl bg-[var(--secondary)] px-4 py-3 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
              {builtIn
                ? "Leave empty to use the built-in default prompt. Edit to override with your own instructions."
                : "Write the full system prompt for this custom agent."}
            </p>

            {/* Default prompt preview — only for built-in agents */}
            {builtIn && isUsingDefaultPrompt && defaultPrompt && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  View built-in default prompt
                </summary>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--card)] p-4 font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  {defaultPrompt}
                </pre>
              </details>
            )}
          </FieldGroup>

          {/* ── Available Tools (Function Calling) ── */}
          <FieldGroup label="Tools / Function Calling" icon={<Wrench size={14} className="text-[var(--y2k-pink)]" />}>
            <p className="text-[10px] text-[var(--muted-foreground)] mb-3">
              When tools are enabled, the AI can call these functions during generation. Results are fed back into the conversation for multi-step tool use.
            </p>
            <div className="space-y-2">
              {BUILT_IN_TOOLS.map((tool: ToolDefinition) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
              Tools are available to all agents. Enable tool-use per chat via Chat Settings → "Enable Function Calling".
            </p>
          </FieldGroup>

          {/* ── Agent Info Card ── */}
          <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
            <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">About this Agent</h3>
            <div className="space-y-1.5 text-[11px] text-[var(--muted-foreground)]">
              <p><strong className="text-[var(--foreground)]">Type:</strong> {isCustomAgent ? "Custom" : agentDetailId}</p>
              <p><strong className="text-[var(--foreground)]">Phase:</strong> {phaseMeta.label} — {phaseMeta.description}</p>
              <p><strong className="text-[var(--foreground)]">DB Status:</strong> {dbConfig ? `Persisted (ID: ${dbConfig.id})` : "Not yet saved — click Save to persist"}</p>
              {builtIn && (
                <p><strong className="text-[var(--foreground)]">Enabled:</strong> {dbConfig ? (dbConfig.enabled === "true" ? "Yes" : "No") : (builtIn.enabledByDefault ? "Yes (default)" : "No (default)")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Shared Components
// ═══════════════════════════════════════════════

function FieldGroup({
  label,
  icon,
  help,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold text-[var(--foreground)]">{label}</h3>
        {help && <HelpTooltip text={help} />}
      </div>
      {children}
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const [expanded, setExpanded] = useState(false);
  const params = tool.parameters.properties ?? {};
  const required = tool.parameters.required ?? [];

  return (
    <div className="rounded-xl ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--accent)]/50 transition-colors"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--y2k-purple)]/15 text-[var(--y2k-purple)]">
          <Wrench size={12} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold font-mono text-[var(--foreground)]">{tool.name}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] truncate">{tool.description}</p>
        </div>
        <span className="text-[10px] text-[var(--muted-foreground)]">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-2.5 space-y-1.5">
          <p className="text-[10px] font-medium text-[var(--muted-foreground)]">Parameters:</p>
          {Object.entries(params).map(([name, prop]) => {
            const p = prop as { type?: string; description?: string; enum?: string[] };
            const isRequired = required.includes(name);
            return (
              <div key={name} className="flex items-start gap-2 text-[11px]">
                <code className="shrink-0 rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--foreground)]">
                  {name}
                  {isRequired && <span className="text-red-400">*</span>}
                </code>
                <span className="text-[var(--muted-foreground)]">
                  <span className="text-[var(--y2k-pink)]">{p.type}</span>
                  {p.description && ` — ${p.description}`}
                  {p.enum && (
                    <span className="ml-1 text-[10px]">
                      [{p.enum.join(", ")}]
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
