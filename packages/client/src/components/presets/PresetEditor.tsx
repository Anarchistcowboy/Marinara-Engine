// ──────────────────────────────────────────────
// Full-Page Preset Editor
// Tabs: Overview · Sections · Parameters · Review
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo, type FC } from "react";
import { useUIStore } from "../../stores/ui.store";
import {
  usePresetFull,
  useUpdatePreset,
  useDeletePreset,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useCreateChoice,
  useUpdateChoice,
  useDeleteChoice,
} from "../../hooks/use-presets";
import {
  ArrowLeft,
  Save,
  Trash2,
  FileText,
  Settings2,
  Layers,
  Sparkles,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Code2,
  Hash,
  Eye,
  EyeOff,
  FolderOpen,
  MessageSquare,
  User,
  Bot,
  Copy,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import type {
  PromptSection,
  PromptGroup,
  ChoiceBlock,
  WrapFormat,
  MarkerType,
} from "@rpg-engine/shared";

// ── Tab definitions ──

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "sections", label: "Sections", icon: Layers },
  { id: "parameters", label: "Parameters", icon: Settings2 },
  { id: "review", label: "AI Review", icon: Sparkles },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ROLE_COLORS: Record<string, string> = {
  system: "text-blue-400",
  user: "text-green-400",
  assistant: "text-purple-400",
};

const ROLE_ICONS: Record<string, FC<{ size: number; className?: string }>> = {
  system: Settings2,
  user: User,
  assistant: Bot,
};

const MARKER_LABELS: Record<MarkerType, string> = {
  character: "Character Info",
  lorebook: "Lorebook (All)",
  persona: "Persona",
  chat_history: "Chat History",
  world_info_before: "World Info (Before)",
  world_info_after: "World Info (After)",
  dialogue_examples: "Dialogue Examples",
};

// ═══════════════════════════════════════════════
//  Main Editor
// ═══════════════════════════════════════════════

export function PresetEditor() {
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const closePresetDetail = useUIStore((s) => s.closePresetDetail);

  const { data, isLoading } = usePresetFull(presetDetailId);
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const reorderSections = useReorderSections();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const createChoice = useCreateChoice();
  const updateChoice = useUpdateChoice();
  const deleteChoice = useDeleteChoice();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [dirty, setDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Local editable state
  const [localName, setLocalName] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localWrapFormat, setLocalWrapFormat] = useState<WrapFormat>("xml");
  const [localAuthor, setLocalAuthor] = useState("");
  const [localParams, setLocalParams] = useState<Record<string, unknown>>({});

  // Populate local state when data loads
  useEffect(() => {
    if (!data) return;
    const p = data.preset as any;
    setLocalName(p.name ?? "");
    setLocalDescription(p.description ?? "");
    setLocalWrapFormat((p.wrapFormat ?? "xml") as WrapFormat);
    setLocalAuthor(p.author ?? "");
    try {
      setLocalParams(typeof p.parameters === "string" ? JSON.parse(p.parameters) : p.parameters ?? {});
    } catch {
      setLocalParams({});
    }
  }, [data]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closePresetDetail();
  }, [dirty, closePresetDetail]);

  const handleSave = useCallback(() => {
    if (!presetDetailId) return;
    updatePreset.mutate(
      {
        id: presetDetailId,
        name: localName,
        description: localDescription,
        wrapFormat: localWrapFormat,
        author: localAuthor,
        parameters: localParams,
      },
      { onSuccess: () => setDirty(false) },
    );
  }, [presetDetailId, localName, localDescription, localWrapFormat, localAuthor, localParams, updatePreset]);

  const handleDelete = useCallback(() => {
    if (!presetDetailId) return;
    if (!confirm("Delete this preset?")) return;
    deletePreset.mutate(presetDetailId, { onSuccess: () => closePresetDetail() });
  }, [presetDetailId, deletePreset, closePresetDetail]);

  const markDirty = useCallback(() => setDirty(true), []);

  // Parse sections in order
  const sectionOrder = useMemo(() => {
    if (!data?.preset) return [];
    const p = data.preset as any;
    try {
      return typeof p.sectionOrder === "string" ? JSON.parse(p.sectionOrder) : p.sectionOrder ?? [];
    } catch {
      return [];
    }
  }, [data]);

  const orderedSections = useMemo(() => {
    if (!data?.sections) return [];
    const map = new Map((data.sections as any[]).map((s) => [s.id, s]));
    return sectionOrder.map((id: string) => map.get(id)).filter(Boolean) as any[];
  }, [data?.sections, sectionOrder]);

  const groupMap = useMemo(() => {
    if (!data?.groups) return new Map<string, any>();
    return new Map((data.groups as any[]).map((g) => [g.id, g]));
  }, [data?.groups]);

  const choiceMap = useMemo(() => {
    if (!data?.choiceBlocks) return new Map<string, any>();
    return new Map((data.choiceBlocks as any[]).map((c) => [c.sectionId, c]));
  }, [data?.choiceBlocks]);

  if (!presetDetailId) return null;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="shimmer h-8 w-48 rounded-xl" />
          <div className="shimmer h-4 w-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-[var(--muted-foreground)]">Preset not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <button
          onClick={handleClose}
          className="rounded-xl p-2 transition-all hover:bg-[var(--accent)] active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-violet-500 text-white shadow-sm">
          <FileText size={18} />
        </div>
        <input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            markDirty();
          }}
          className="flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
          placeholder="Preset name…"
        />
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSave}
            disabled={updatePreset.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-400 to-violet-500 px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={13} /> Save
          </button>
          <button
            onClick={handleDelete}
            className="rounded-xl p-2 transition-all hover:bg-[var(--destructive)]/15 active:scale-95"
          >
            <Trash2 size={15} className="text-[var(--destructive)]" />
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
              onClick={() => closePresetDetail()}
              className="rounded-lg px-3 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
            >
              Discard
            </button>
            <button
              onClick={() => {
                handleSave();
                closePresetDetail();
              }}
              className="rounded-lg bg-amber-500/20 px-3 py-1 hover:bg-amber-500/30"
            >
              Save & close
            </button>
          </div>
        </div>
      )}

      {/* ── Body: Tab rail + Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tab rail */}
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-purple-400/15 to-violet-500/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/20"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* ── Overview Tab ── */}
            {activeTab === "overview" && (
              <OverviewTab
                description={localDescription}
                onDescriptionChange={(v) => {
                  setLocalDescription(v);
                  markDirty();
                }}
                wrapFormat={localWrapFormat}
                onWrapFormatChange={(v) => {
                  setLocalWrapFormat(v);
                  markDirty();
                }}
                author={localAuthor}
                onAuthorChange={(v) => {
                  setLocalAuthor(v);
                  markDirty();
                }}
                sectionCount={orderedSections.length}
                groupCount={data.groups?.length ?? 0}
              />
            )}

            {/* ── Sections Tab ── */}
            {activeTab === "sections" && (
              <SectionsTab
                presetId={presetDetailId}
                sections={orderedSections}
                groupMap={groupMap}
                choiceMap={choiceMap}
                wrapFormat={localWrapFormat}
                onCreateSection={createSection}
                onUpdateSection={updateSection}
                onDeleteSection={deleteSection}
                onReorderSections={reorderSections}
                onCreateGroup={createGroup}
                onUpdateGroup={updateGroup}
                onDeleteGroup={deleteGroup}
                onCreateChoice={createChoice}
                onUpdateChoice={updateChoice}
                onDeleteChoice={deleteChoice}
              />
            )}

            {/* ── Parameters Tab ── */}
            {activeTab === "parameters" && (
              <ParametersTab
                params={localParams}
                onChange={(p) => {
                  setLocalParams(p);
                  markDirty();
                }}
              />
            )}

            {/* ── Review Tab ── */}
            {activeTab === "review" && (
              <ReviewTab presetId={presetDetailId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Overview Tab
// ═══════════════════════════════════════════════

function OverviewTab({
  description,
  onDescriptionChange,
  wrapFormat,
  onWrapFormatChange,
  author,
  onAuthorChange,
  sectionCount,
  groupCount,
}: {
  description: string;
  onDescriptionChange: (v: string) => void;
  wrapFormat: WrapFormat;
  onWrapFormatChange: (v: WrapFormat) => void;
  author: string;
  onAuthorChange: (v: string) => void;
  sectionCount: number;
  groupCount: number;
}) {
  return (
    <>
      <FieldGroup label="Description" help="A short summary of what this preset is designed for. Helps you remember its purpose when choosing between presets.">
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What does this preset do?"
          className="min-h-[80px] w-full rounded-xl bg-[var(--secondary)] p-3 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </FieldGroup>

      <FieldGroup label="Wrap Format" help="Controls how prompt sections are formatted when sent to the AI. XML uses <tags>, Markdown uses ## headings. Most models work well with either.">
        <div className="flex gap-2">
          {(["xml", "markdown"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => onWrapFormatChange(fmt)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all",
                wrapFormat === fmt
                  ? "bg-purple-400/15 text-purple-400 ring-1 ring-purple-400/30"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
              )}
            >
              {fmt === "xml" ? <Code2 size={14} /> : <Hash size={14} />}
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
          {wrapFormat === "xml"
            ? "Sections wrapped in <xml_tags>. Groups become parent tags."
            : "Sections wrapped with ## Headings. Groups become # Headings."}
        </p>
      </FieldGroup>

      <FieldGroup label="Author" help="Optional creator name, useful if you share presets with others.">
        <input
          value={author}
          onChange={(e) => onAuthorChange(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full rounded-xl bg-[var(--secondary)] p-2.5 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </FieldGroup>

      <div className="flex gap-4">
        <StatCard label="Sections" value={sectionCount} />
        <StatCard label="Groups" value={groupCount} />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
//  Sections Tab (with drag-reorder, groups management, choice editing)
// ═══════════════════════════════════════════════

function SectionsTab({
  presetId,
  sections,
  groupMap,
  choiceMap,
  wrapFormat,
  onCreateSection,
  onUpdateSection,
  onDeleteSection,
  onReorderSections,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateChoice,
  onUpdateChoice,
  onDeleteChoice,
}: {
  presetId: string;
  sections: any[];
  groupMap: Map<string, any>;
  choiceMap: Map<string, any>;
  wrapFormat: WrapFormat;
  onCreateSection: any;
  onUpdateSection: any;
  onDeleteSection: any;
  onReorderSections: any;
  onCreateGroup: any;
  onUpdateGroup: any;
  onDeleteGroup: any;
  onCreateChoice: any;
  onUpdateChoice: any;
  onDeleteChoice: any;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showGroupsPanel, setShowGroupsPanel] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const toggleExpanded = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSection = (opts?: { isMarker?: boolean; markerType?: MarkerType }) => {
    setShowAddMenu(false);
    onCreateSection.mutate({
      presetId,
      identifier: opts?.isMarker ? opts.markerType : `section_${Date.now()}`,
      name: opts?.isMarker ? MARKER_LABELS[opts.markerType!] : "New Section",
      content: "",
      role: "system",
      isMarker: opts?.isMarker ?? false,
      markerConfig: opts?.isMarker ? { type: opts.markerType! } : null,
    });
  };

  const handleAddGroup = () => {
    onCreateGroup.mutate({ presetId, name: "New Group" });
  };

  // ── Drag & Drop ──
  const handleDragStart = (idx: number, e: React.DragEvent) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  };

  const handleDrop = (targetIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceIdx = draggingIdx;
    setDraggingIdx(null);
    setDragOverIdx(null);
    if (sourceIdx === null || sourceIdx === targetIdx) return;

    const ids = sections.map((s: any) => s.id);
    const [moved] = ids.splice(sourceIdx, 1);
    ids.splice(targetIdx, 0, moved);
    onReorderSections.mutate({ presetId, sectionIds: ids });
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-400 to-violet-500 px-3 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
          >
            <Plus size={13} /> Add Section
          </button>
          {showAddMenu && (
            <>
              {/* Backdrop to close menu */}
              <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
                <button
                  onClick={() => handleAddSection()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  <MessageSquare size={13} /> Prompt Block
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <p className="px-3 py-1 text-[10px] font-medium text-[var(--muted-foreground)]">Markers</p>
                {(Object.keys(MARKER_LABELS) as MarkerType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleAddSection({ isMarker: true, markerType: type })}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--accent)]"
                  >
                    <Layers size={13} className="text-purple-400" /> {MARKER_LABELS[type]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => setShowGroupsPanel(!showGroupsPanel)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ring-1 ring-[var(--border)] transition-all active:scale-[0.98]",
            showGroupsPanel
              ? "bg-sky-400/10 text-sky-400 ring-sky-400/30"
              : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)]",
          )}
        >
          <FolderOpen size={13} /> Groups ({groupMap.size})
        </button>
      </div>

      {/* ── Groups Management Panel ── */}
      {showGroupsPanel && (
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-sky-400">Groups</h4>
            <button
              onClick={handleAddGroup}
              className="flex items-center gap-1 rounded-lg bg-sky-400/15 px-2 py-1 text-[10px] font-medium text-sky-400 hover:bg-sky-400/25 active:scale-95"
            >
              <Plus size={10} /> New Group
            </button>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)]">
            Groups wrap adjacent sections in a single XML/Markdown container. Assign sections to groups below.
          </p>
          {groupMap.size === 0 ? (
            <p className="py-2 text-center text-[10px] text-[var(--muted-foreground)]">
              No groups yet. Create one to organize sections.
            </p>
          ) : (
            <div className="space-y-1">
              {[...groupMap.values()].map((g: any) => (
                <div key={g.id} className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 ring-1 ring-[var(--border)]">
                  {editingGroupId === g.id ? (
                    <input
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onBlur={() => {
                        if (editingGroupName.trim()) {
                          onUpdateGroup.mutate({ presetId, groupId: g.id, name: editingGroupName.trim() });
                        }
                        setEditingGroupId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingGroupId(null);
                      }}
                      className="flex-1 rounded bg-[var(--background)] px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 cursor-pointer truncate text-xs font-medium"
                      onClick={() => {
                        setEditingGroupId(g.id);
                        setEditingGroupName(g.name);
                      }}
                      title="Click to rename"
                    >
                      {g.name}
                    </span>
                  )}
                  <span className="text-[9px] text-[var(--muted-foreground)]">
                    {sections.filter((s: any) => s.groupId === g.id).length} sections
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete group "${g.name}"? Sections will be ungrouped.`)) {
                        onDeleteGroup.mutate({ presetId, groupId: g.id });
                      }
                    }}
                    className="rounded p-0.5 hover:bg-[var(--destructive)]/15"
                  >
                    <Trash2 size={10} className="text-[var(--destructive)]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Section list with drag & drop ── */}
      <div className="space-y-1">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Layers size={24} className="text-[var(--muted-foreground)]" />
            <p className="text-xs text-[var(--muted-foreground)]">No sections yet. Add one to get started.</p>
          </div>
        ) : (
          sections.map((section: any, idx: number) => {
            const isExpanded = expandedSections.has(section.id);
            const isEnabled = section.enabled === "true" || section.enabled === true;
            const isMarker = section.isMarker === "true" || section.isMarker === true;
            const role = (section.role ?? "system") as string;
            const group = section.groupId ? groupMap.get(section.groupId) : null;
            const choice = choiceMap.get(section.id);
            const RoleIcon = ROLE_ICONS[role] ?? Settings2;
            const isDragTarget = dragOverIdx === idx && draggingIdx !== idx;

            return (
              <div
                key={section.id}
                draggable
                onDragStart={(e) => handleDragStart(idx, e)}
                onDragOver={(e) => handleDragOver(idx, e)}
                onDrop={(e) => handleDrop(idx, e)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "rounded-xl border transition-all",
                  isEnabled ? "border-[var(--border)]" : "border-[var(--border)]/50 opacity-50",
                  draggingIdx === idx && "opacity-40",
                  isDragTarget && "ring-2 ring-purple-400/50 border-purple-400/30",
                )}
              >
                {/* Section header */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div
                    className="cursor-grab shrink-0 rounded p-0.5 hover:bg-[var(--accent)] active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    <GripVertical size={14} className="text-[var(--muted-foreground)]" />
                  </div>
                  <button
                    onClick={() => toggleExpanded(section.id)}
                    className="shrink-0 rounded p-0.5 hover:bg-[var(--accent)]"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
                    )}
                  </button>
                  <RoleIcon size={14} className={cn("shrink-0", ROLE_COLORS[role])} />
                  <span
                    className="min-w-0 flex-1 cursor-pointer truncate text-sm font-medium"
                    onClick={() => toggleExpanded(section.id)}
                  >
                    {section.name}
                  </span>

                  {isMarker && (
                    <span className="shrink-0 rounded bg-violet-400/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
                      MARKER
                    </span>
                  )}
                  {choice && (
                    <span className="shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                      CHOICE
                    </span>
                  )}
                  {group && (
                    <span className="shrink-0 rounded bg-sky-400/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-400">
                      {group.name}
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">
                    {role}
                  </span>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() =>
                        onUpdateSection.mutate({
                          presetId,
                          sectionId: section.id,
                          enabled: !isEnabled,
                        })
                      }
                      className="rounded-lg p-1 hover:bg-[var(--accent)]"
                      title={isEnabled ? "Disable" : "Enable"}
                    >
                      {isEnabled ? (
                        <Eye size={12} className="text-green-400" />
                      ) : (
                        <EyeOff size={12} className="text-[var(--muted-foreground)]" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        onDeleteSection.mutate({ presetId, sectionId: section.id })
                      }
                      className="rounded-lg p-1 hover:bg-[var(--destructive)]/15"
                      title="Delete"
                    >
                      <Trash2 size={12} className="text-[var(--destructive)]" />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-[var(--border)] px-3 py-3">
                    {/* Name & Role */}
                    <div className="flex gap-2">
                      <input
                        value={section.name}
                        onChange={(e) =>
                          onUpdateSection.mutate({
                            presetId,
                            sectionId: section.id,
                            name: e.target.value,
                          })
                        }
                        className="flex-1 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        placeholder="Section name"
                      />
                      <select
                        value={role}
                        onChange={(e) =>
                          onUpdateSection.mutate({
                            presetId,
                            sectionId: section.id,
                            role: e.target.value,
                          })
                        }
                        className="rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none"
                      >
                        <option value="system">System</option>
                        <option value="user">User</option>
                        <option value="assistant">Assistant</option>
                      </select>
                    </div>

                    {/* Content (not for markers) */}
                    {!isMarker && (
                      <textarea
                        value={section.content}
                        onChange={(e) =>
                          onUpdateSection.mutate({
                            presetId,
                            sectionId: section.id,
                            content: e.target.value,
                          })
                        }
                        className="min-h-[120px] w-full rounded-lg bg-[var(--secondary)] p-2.5 font-mono text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        placeholder="Prompt content… (supports {{user}}, {{char}}, {{getvar::name}} macros)"
                      />
                    )}

                    {/* Marker config */}
                    {isMarker && section.markerConfig && (
                      <div className="rounded-lg bg-violet-400/5 p-3 text-xs text-violet-300">
                        Marker type:{" "}
                        <strong>
                          {MARKER_LABELS[
                            (typeof section.markerConfig === "string"
                              ? JSON.parse(section.markerConfig)
                              : section.markerConfig
                            ).type as MarkerType
                          ] ?? "Unknown"}
                        </strong>
                        <p className="mt-1 text-[var(--muted-foreground)]">
                          Content is auto-generated at assembly time from your characters, lorebook, etc.
                        </p>
                      </div>
                    )}

                    {/* Position & Depth */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <label className="text-[var(--muted-foreground)]">Position:</label>
                      <select
                        value={section.injectionPosition ?? "ordered"}
                        onChange={(e) =>
                          onUpdateSection.mutate({
                            presetId,
                            sectionId: section.id,
                            injectionPosition: e.target.value,
                          })
                        }
                        className="rounded-lg bg-[var(--secondary)] px-2 py-1 text-xs ring-1 ring-[var(--border)]"
                      >
                        <option value="ordered">Ordered (in sequence)</option>
                        <option value="depth">Depth (from end of chat)</option>
                      </select>
                      {section.injectionPosition === "depth" && (
                        <>
                          <label className="text-[var(--muted-foreground)]">Depth:</label>
                          <input
                            type="number"
                            value={section.injectionDepth ?? 0}
                            onChange={(e) =>
                              onUpdateSection.mutate({
                                presetId,
                                sectionId: section.id,
                                injectionDepth: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-16 rounded-lg bg-[var(--secondary)] px-2 py-1 text-xs ring-1 ring-[var(--border)]"
                          />
                          <span className="text-[var(--muted-foreground)]">(0 = after last message)</span>
                        </>
                      )}
                    </div>

                    {/* Group assignment */}
                    <div className="flex items-center gap-3 text-xs">
                      <label className="text-[var(--muted-foreground)]">Group:</label>
                      <select
                        value={section.groupId ?? ""}
                        onChange={(e) =>
                          onUpdateSection.mutate({
                            presetId,
                            sectionId: section.id,
                            groupId: e.target.value || null,
                          })
                        }
                        className="rounded-lg bg-[var(--secondary)] px-2 py-1 text-xs ring-1 ring-[var(--border)]"
                      >
                        <option value="">No group</option>
                        {[...groupMap.values()].map((g: any) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      {groupMap.size === 0 && (
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          (open Groups panel to create one)
                        </span>
                      )}
                    </div>

                    {/* ── Choice Block ── */}
                    {!isMarker && (
                      <ChoiceBlockEditor
                        presetId={presetId}
                        sectionId={section.id}
                        choice={choice}
                        onCreateChoice={onCreateChoice}
                        onUpdateChoice={onUpdateChoice}
                        onDeleteChoice={onDeleteChoice}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {sections.length > 0 && (
        <p className="text-center text-[10px] text-[var(--muted-foreground)]">
          Drag sections to reorder · Click to expand · Sections are assembled top-to-bottom
        </p>
      )}
    </>
  );
}

// ── Choice Block Editor (inline, fully editable) ──

function ChoiceBlockEditor({
  presetId,
  sectionId,
  choice,
  onCreateChoice,
  onUpdateChoice,
  onDeleteChoice,
}: {
  presetId: string;
  sectionId: string;
  choice: any | undefined;
  onCreateChoice: any;
  onUpdateChoice: any;
  onDeleteChoice: any;
}) {
  const [editingOption, setEditingOption] = useState<number | null>(null);

  if (!choice) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-2.5">
        <p className="mb-2 text-[10px] text-[var(--muted-foreground)]">
          <strong>Choice Block</strong> — let users pick between alternative prompts per chat.
          The selected option replaces this section&apos;s content at generation time.
        </p>
        <button
          onClick={() =>
            onCreateChoice.mutate({
              presetId,
              sectionId,
              label: "Choose a variant",
              options: [
                { id: `opt_${Date.now()}_a`, label: "Option A", content: "First variant content" },
                { id: `opt_${Date.now()}_b`, label: "Option B", content: "Second variant content" },
              ],
            })
          }
          className="flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400 hover:bg-amber-400/20 active:scale-[0.98]"
        >
          <Plus size={11} /> Add Choice Block
        </button>
      </div>
    );
  }

  // Parse options
  let opts: Array<{ id: string; label: string; content: string }> = [];
  try {
    opts = typeof choice.options === "string" ? JSON.parse(choice.options) : choice.options ?? [];
  } catch {
    /* empty */
  }

  const updateOpts = (newOpts: typeof opts) => {
    onUpdateChoice.mutate({
      presetId,
      sectionId,
      choiceId: choice.id,
      options: newOpts,
    });
  };

  return (
    <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-400">Choice Block</span>
          <input
            value={choice.label ?? ""}
            onChange={(e) =>
              onUpdateChoice.mutate({
                presetId,
                sectionId,
                choiceId: choice.id,
                label: e.target.value,
              })
            }
            className="rounded bg-[var(--background)] px-2 py-0.5 text-[11px] ring-1 ring-[var(--border)] focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            placeholder="Block label…"
          />
        </div>
        <button
          onClick={() => {
            if (confirm("Remove this choice block?")) {
              onDeleteChoice.mutate({ presetId, sectionId, choiceId: choice.id });
            }
          }}
          className="rounded p-1 hover:bg-[var(--destructive)]/15"
          title="Remove choice block"
        >
          <X size={11} className="text-[var(--destructive)]" />
        </button>
      </div>

      <p className="text-[10px] text-[var(--muted-foreground)]">
        When this preset is assigned to a chat, users pick one option. The chosen option&apos;s content replaces the section at generation time.
      </p>

      {/* Options list */}
      <div className="space-y-1.5">
        {opts.map((opt, oi) => (
          <div key={opt.id} className="rounded-lg bg-[var(--secondary)] ring-1 ring-[var(--border)]">
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="shrink-0 text-[10px] font-medium text-amber-400">{oi + 1}.</span>
              {editingOption === oi ? (
                <input
                  value={opt.label}
                  onChange={(e) => {
                    const next = [...opts];
                    next[oi] = { ...next[oi], label: e.target.value };
                    updateOpts(next);
                  }}
                  onBlur={() => setEditingOption(null)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingOption(null)}
                  className="flex-1 rounded bg-[var(--background)] px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 cursor-pointer truncate text-xs font-medium hover:text-amber-400"
                  onClick={() => setEditingOption(oi)}
                  title="Click to rename"
                >
                  {opt.label}
                </span>
              )}
              <button
                onClick={() => {
                  if (opts.length <= 2) return alert("A choice block needs at least 2 options.");
                  updateOpts(opts.filter((_, i) => i !== oi));
                }}
                className="shrink-0 rounded p-0.5 hover:bg-[var(--destructive)]/15"
                title="Remove option"
              >
                <X size={10} className="text-[var(--destructive)]" />
              </button>
            </div>
            {editingOption === oi && (
              <div className="border-t border-[var(--border)] px-2.5 py-1.5">
                <textarea
                  value={opt.content}
                  onChange={(e) => {
                    const next = [...opts];
                    next[oi] = { ...next[oi], content: e.target.value };
                    updateOpts(next);
                  }}
                  className="min-h-[60px] w-full rounded bg-[var(--background)] p-2 font-mono text-[11px] ring-1 ring-[var(--border)] focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                  placeholder="Option content (replaces section content when selected)…"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new option */}
      <button
        onClick={() => {
          const newOpt = {
            id: `opt_${Date.now()}`,
            label: `Option ${String.fromCharCode(65 + opts.length)}`,
            content: "",
          };
          updateOpts([...opts, newOpt]);
          setEditingOption(opts.length);
        }}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-400/10 active:scale-[0.98]"
      >
        <Plus size={10} /> Add Option
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Parameters Tab
// ═══════════════════════════════════════════════

function ParametersTab({
  params,
  onChange,
}: {
  params: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <>
      <FieldGroup label="Generation" help="Core parameters that control how the AI generates text. Higher temperature = more creative, lower = more focused.">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Temperature" help="Controls randomness. Low (0.1–0.5) = focused and deterministic. High (0.8–1.5) = creative and varied. Default 1.0." value={params.temperature as number ?? 1} onChange={(v) => set("temperature", v)} min={0} max={2} step={0.05} />
          <NumberField label="Max Tokens" help="Maximum number of tokens (roughly words) the AI can generate in a single response. Higher = longer replies." value={params.maxTokens as number ?? 4096} onChange={(v) => set("maxTokens", v)} min={1} max={32768} step={256} />
          <NumberField label="Top P" help="Nucleus sampling: only considers tokens whose cumulative probability is within this value. Lower = more focused. 1.0 = consider all tokens." value={params.topP as number ?? 1} onChange={(v) => set("topP", v)} min={0} max={1} step={0.05} />
          <NumberField label="Top K" help="Only sample from the top K most likely tokens. 0 = disabled (use Top P instead). Lower values = more predictable output." value={params.topK as number ?? 0} onChange={(v) => set("topK", v)} min={0} max={500} step={1} />
          <NumberField label="Min P" help="Minimum probability threshold. Tokens below this probability relative to the most likely token are filtered out. Helps avoid very unlikely words." value={params.minP as number ?? 0} onChange={(v) => set("minP", v)} min={0} max={1} step={0.01} />
          <NumberField label="Max Context" help="Maximum number of tokens the model can see (your messages + its reply). Larger context = more chat history sent, but costs more." value={params.maxContext as number ?? 128000} onChange={(v) => set("maxContext", v)} min={1024} max={2097152} step={1024} />
        </div>
      </FieldGroup>

      <FieldGroup label="Penalties" help="Penalties discourage the AI from repeating itself. Positive values reduce repetition, negative values encourage it.">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Frequency" help="Penalizes tokens based on how often they've appeared so far. Higher values make the AI avoid repeating the same words." value={params.frequencyPenalty as number ?? 0} onChange={(v) => set("frequencyPenalty", v)} min={-2} max={2} step={0.05} />
          <NumberField label="Presence" help="Penalizes tokens that have appeared at all. Encourages the AI to talk about new topics rather than revisiting old ones." value={params.presencePenalty as number ?? 0} onChange={(v) => set("presencePenalty", v)} min={-2} max={2} step={0.05} />
        </div>
      </FieldGroup>

      <FieldGroup label="Reasoning" help="For models that support chain-of-thought reasoning (like o1, o3). Controls how much the model 'thinks' before responding.">
        <div className="flex gap-2">
          {(["low", "medium", "high", null] as const).map((level) => (
            <button
              key={level ?? "off"}
              onClick={() => set("reasoningEffort", level)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                params.reasoningEffort === level
                  ? "bg-purple-400/15 text-purple-400 ring-1 ring-purple-400/30"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
              )}
            >
              {level ?? "Off"}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="Options" help="Additional flags that affect how messages are processed and displayed.">
        <div className="space-y-2">
          <ToggleOption
            label="Squash System Messages"
            description="Merge consecutive system messages into one"
            value={params.squashSystemMessages as boolean ?? true}
            onChange={(v) => set("squashSystemMessages", v)}
          />
          <ToggleOption
            label="Show Thoughts"
            description="Display model reasoning/thinking"
            value={params.showThoughts as boolean ?? true}
            onChange={(v) => set("showThoughts", v)}
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Stop Sequences" help="Text patterns that make the AI stop generating when encountered. Useful for preventing the AI from speaking as your character.">
        <StopSequencesEditor
          sequences={(params.stopSequences as string[]) ?? []}
          onChange={(v) => set("stopSequences", v)}
        />
      </FieldGroup>
    </>
  );
}

// ═══════════════════════════════════════════════
//  Review Tab (placeholder — wires to prompt reviewer)
// ═══════════════════════════════════════════════

function ReviewTab({ presetId }: { presetId: string }) {
  const [reviewing, setReviewing] = useState(false);
  const [reviewOutput, setReviewOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startReview = async (connectionId: string) => {
    setReviewing(true);
    setReviewOutput("");
    setError(null);

    try {
      const res = await fetch("/api/prompt-reviewer/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId,
          connectionId,
          focusAreas: ["clarity", "consistency", "coverage", "token_efficiency"],
        }),
      });

      if (!res.ok) throw new Error("Failed to start review");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "token") {
              setReviewOutput((prev) => prev + event.data);
            } else if (event.type === "error") {
              setError(event.data);
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <>
      <FieldGroup label="AI Prompt Review">
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          Have an AI analyze your prompt preset for clarity, consistency, coverage, and efficiency.
          This requires an active API connection.
        </p>
        <ConnectionSelector
          onSelect={(connId) => startReview(connId)}
          disabled={reviewing}
          label={reviewing ? "Reviewing…" : "Start Review"}
        />
      </FieldGroup>

      {error && (
        <div className="rounded-xl bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
          {error}
        </div>
      )}

      {reviewOutput && (
        <div className="rounded-xl bg-[var(--secondary)] p-4 ring-1 ring-[var(--border)]">
          <pre className="whitespace-pre-wrap text-xs text-[var(--foreground)]">{reviewOutput}</pre>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
//  Shared UI Components
// ═══════════════════════════════════════════════

function FieldGroup({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
        {label}
        {help && <HelpTooltip text={help} />}
      </label>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl bg-[var(--secondary)] p-3 ring-1 ring-[var(--border)]">
      <span className="text-xl font-bold text-[var(--foreground)]">{value}</span>
      <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

function NumberField({
  label,
  help,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  help?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
        {label}
        {help && <HelpTooltip text={help} size={10} />}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
    </div>
  );
}

function ToggleOption({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-all hover:bg-[var(--accent)]"
    >
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-[var(--muted-foreground)]">{description}</div>
      </div>
      <div
        className={cn(
          "flex h-5 w-9 items-center rounded-full px-0.5 transition-colors",
          value ? "bg-purple-400" : "bg-[var(--border)]",
        )}
      >
        <div
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform",
            value && "translate-x-4",
          )}
        />
      </div>
    </button>
  );
}

function StopSequencesEditor({
  sequences,
  onChange,
}: {
  sequences: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (val && !sequences.includes(val)) {
      onChange([...sequences, val]);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add stop sequence…"
          className="flex-1 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button onClick={add} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs">
          Add
        </button>
      </div>
      {sequences.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {sequences.map((seq, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-2 py-1 text-[10px] ring-1 ring-[var(--border)]"
            >
              <code>{JSON.stringify(seq)}</code>
              <button
                onClick={() => onChange(sequences.filter((_, j) => j !== i))}
                className="hover:text-[var(--destructive)]"
              >
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Simple connection selector — queries the connections API */
function ConnectionSelector({
  onSelect,
  disabled,
  label,
}: {
  onSelect: (connectionId: string) => void;
  disabled: boolean;
  label: string;
}) {
  const [connId, setConnId] = useState("");

  // Quick inline fetch of connections
  const [connections, setConnections] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((data) => setConnections(data))
      .catch(() => {});
  }, []);

  return (
    <div className="flex gap-2">
      <select
        value={connId}
        onChange={(e) => setConnId(e.target.value)}
        className="flex-1 rounded-xl bg-[var(--secondary)] px-2.5 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none"
      >
        <option value="">Select connection…</option>
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        disabled={disabled || !connId}
        onClick={() => onSelect(connId)}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-400 to-violet-500 px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
      >
        <Sparkles size={13} /> {label}
      </button>
    </div>
  );
}
