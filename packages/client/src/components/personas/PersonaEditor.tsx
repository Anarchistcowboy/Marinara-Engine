// ──────────────────────────────────────────────
// Persona Editor — Full-page detail view
// Replaces the chat area when editing a persona.
// Sections: Description, Personality, Backstory,
//           Appearance, Scenario
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import {
  usePersonas,
  useUpdatePersona,
  useUploadPersonaAvatar,
  useDeletePersona,
} from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import {
  ArrowLeft,
  Save,
  User,
  FileText,
  Heart,
  BookOpen,
  Eye,
  MapPin,
  Camera,
  Trash2,
  AlertTriangle,
  Palette,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { ColorPicker } from "../ui/ColorPicker";

// ── Tabs ──
const TABS = [
  { id: "description", label: "Description", icon: FileText },
  { id: "personality", label: "Personality", icon: Heart },
  { id: "backstory", label: "Backstory", icon: BookOpen },
  { id: "appearance", label: "Appearance", icon: Eye },
  { id: "scenario", label: "Scenario", icon: MapPin },
  { id: "colors", label: "Colors", icon: Palette },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface PersonaFormData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  nameColor: string;
  dialogueColor: string;
  boxColor: string;
}

interface PersonaRow {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  avatarPath: string | null;
  isActive: string | boolean;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
}

export function PersonaEditor() {
  const personaId = useUIStore((s) => s.personaDetailId);
  const closeDetail = useUIStore((s) => s.closePersonaDetail);
  const { data: allPersonas, isLoading } = usePersonas();
  const updatePersona = useUpdatePersona();
  const uploadAvatar = useUploadPersonaAvatar();
  const deletePersona = useDeletePersona();

  const [activeTab, setActiveTab] = useState<TabId>("description");
  const [formData, setFormData] = useState<PersonaFormData | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find the persona from the list
  const rawPersona = (allPersonas as PersonaRow[] | undefined)?.find(
    (p) => p.id === personaId,
  );

  // Parse persona into form data when it loads
  useEffect(() => {
    if (!rawPersona) return;
    setFormData({
      name: rawPersona.name,
      description: rawPersona.description,
      personality: rawPersona.personality ?? "",
      scenario: rawPersona.scenario ?? "",
      backstory: rawPersona.backstory ?? "",
      appearance: rawPersona.appearance ?? "",
      nameColor: rawPersona.nameColor ?? "",
      dialogueColor: rawPersona.dialogueColor ?? "",
      boxColor: rawPersona.boxColor ?? "",
    });
    setAvatarPreview(rawPersona.avatarPath);
  }, [rawPersona]);

  const updateField = useCallback(
    <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => {
      setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
      setDirty(true);
    },
    [],
  );

  const handleSave = async () => {
    if (!personaId || !formData) return;
    setSaving(true);
    try {
      await updatePersona.mutateAsync({ id: personaId, ...formData });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !personaId) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setAvatarPreview(dataUrl);
      try {
        await uploadAvatar.mutateAsync({
          id: personaId,
          avatar: dataUrl,
          filename: `persona-${personaId}-${Date.now()}.${file.name.split(".").pop()}`,
        });
      } catch {
        // revert on failure
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    if (!personaId) return;
    if (!confirm("Are you sure you want to delete this persona?")) return;
    await deletePersona.mutateAsync(personaId);
    closeDetail();
  };

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeDetail();
  }, [dirty, closeDetail]);

  const forceClose = useCallback(() => {
    setShowUnsavedWarning(false);
    setDirty(false);
    closeDetail();
  }, [closeDetail]);

  if (isLoading || !formData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="shimmer h-16 w-16 rounded-2xl" />
          <div className="shimmer h-3 w-32 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <button
          onClick={handleClose}
          className="rounded-xl p-2 transition-all hover:bg-[var(--accent)] active:scale-95"
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Avatar */}
        <div
          className="group relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-500/20"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt={formData.name} className="h-full w-full object-cover" />
          ) : (
            <User size={22} className="text-white" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={16} className="text-white" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full bg-transparent text-lg font-bold outline-none"
            placeholder="Persona name"
          />
          <p className="flex items-center gap-1 truncate text-xs text-[var(--muted-foreground)]">
            Your persona
            <HelpTooltip text="This is how the AI sees you. Fill in description, personality, backstory, and appearance — just like a character card. The active persona is injected into every prompt." />
          </p>
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="rounded-xl p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
          title="Delete persona"
        >
          <Trash2 size={18} />
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-all",
            dirty
              ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg active:scale-[0.98]"
              : "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed",
          )}
        >
          <Save size={13} />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* ── Unsaved changes warning ── */}
      {showUnsavedWarning && (
        <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <AlertTriangle size={15} className="shrink-0 text-amber-500" />
          <p className="flex-1 text-xs font-medium text-amber-500">
            You have unsaved changes. Close without saving?
          </p>
          <button
            onClick={() => setShowUnsavedWarning(false)}
            className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            Keep editing
          </button>
          <button
            onClick={forceClose}
            className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-500 transition-all hover:bg-amber-500/25"
          >
            Discard & close
          </button>
          <button
            onClick={async () => { await handleSave(); closeDetail(); }}
            className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:shadow-md"
          >
            Save & close
          </button>
        </div>
      )}

      {/* ── Body: Tabs + Content ── */}
      <div className="flex flex-1 overflow-hidden max-md:flex-col">
        {/* Tab Rail */}
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-2 max-md:w-full max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left max-md:whitespace-nowrap max-md:px-2.5 max-md:py-1.5",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-emerald-400/15 to-teal-500/15 text-emerald-400 ring-1 ring-emerald-400/20"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 max-md:p-4">
          <div className="mx-auto max-w-2xl">
            {activeTab === "description" && (
              <TextareaTab
                title="Description"
                subtitle="Your general description. This is sent in every prompt so the AI knows who you are."
                value={formData.description}
                onChange={(v) => updateField("description", v)}
                placeholder="Describe who you are, your role in the story, and your key traits…"
                rows={12}
              />
            )}
            {activeTab === "personality" && (
              <TextareaTab
                title="Personality"
                subtitle="Your personality traits, temperament, and behavioral patterns."
                value={formData.personality}
                onChange={(v) => updateField("personality", v)}
                placeholder="Calm and analytical, but quick to act when someone's in danger. Has a dry sense of humor…"
                rows={8}
              />
            )}
            {activeTab === "backstory" && (
              <TextareaTab
                title="Backstory"
                subtitle="Your character's history, origin story, and formative life events."
                value={formData.backstory}
                onChange={(v) => updateField("backstory", v)}
                placeholder="Grew up in a frontier town, apprenticed under a traveling scholar…"
                rows={12}
              />
            )}
            {activeTab === "appearance" && (
              <TextareaTab
                title="Appearance"
                subtitle="Physical description — height, build, hair, eyes, clothing, distinguishing features."
                value={formData.appearance}
                onChange={(v) => updateField("appearance", v)}
                placeholder="Average height, dark hair worn loose. Prefers practical clothing — boots, a worn jacket…"
                rows={8}
              />
            )}
            {activeTab === "scenario" && (
              <TextareaTab
                title="Scenario"
                subtitle="Your default situation or context within roleplays."
                value={formData.scenario}
                onChange={(v) => updateField("scenario", v)}
                placeholder="A wandering adventurer seeking answers about a mysterious artifact…"
                rows={8}
              />
            )}
            {activeTab === "colors" && (
              <PersonaColorsTab formData={formData} updateField={updateField} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Persona Colors Tab ──

function PersonaColorsTab({
  formData,
  updateField,
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Persona Colors"
        subtitle="Customize how your persona appears in chats. Colors are applied to your name, dialogue, and message bubble."
      />

      {/* Preview card */}
      <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4 space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">Preview</p>
        <div className="flex gap-3 flex-row-reverse">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 ring-2 ring-blue-400/20">
            <User size={16} className="text-white" />
          </div>
          <div className="flex-1 space-y-1 items-end flex flex-col">
            <span
              className="text-[12px] font-bold tracking-tight"
              style={
                formData.nameColor
                  ? formData.nameColor.startsWith("linear-gradient")
                    ? { background: formData.nameColor, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }
                    : { color: formData.nameColor }
                  : { color: "rgb(147, 197, 253)" }
              }
            >
              {formData.name || "You"}
            </span>
            <div
              className="rounded-2xl rounded-tr-sm px-4 py-3 text-[13px] leading-[1.8] backdrop-blur-md ring-1 ring-blue-400/15"
              style={
                formData.boxColor
                  ? { backgroundColor: formData.boxColor }
                  : { backgroundColor: "rgba(37, 99, 235, 0.3)" }
              }
            >
              <span className="text-blue-50">*You step forward confidently.* </span>
              <strong
                style={formData.dialogueColor ? { color: formData.dialogueColor } : { color: "rgb(255, 255, 255)" }}
              >
                &ldquo;I&apos;m ready for this.&rdquo;
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Name Color */}
      <ColorPicker
        value={formData.nameColor}
        onChange={(v) => updateField("nameColor", v)}
        gradient
        label="Name Display Color"
        helpText="The color (or gradient) used for your persona's name in chat messages. Supports gradients!"
      />

      {/* Dialogue Color */}
      <ColorPicker
        value={formData.dialogueColor}
        onChange={(v) => updateField("dialogueColor", v)}
        label="Dialogue Highlight Color"
        helpText={'Text inside quotation marks ("", \u201c\u201d, \u00ab\u00bb) will be automatically bold and colored with this.'}
      />

      {/* Box Color */}
      <ColorPicker
        value={formData.boxColor}
        onChange={(v) => updateField("boxColor", v)}
        label="Message Box Color"
        helpText="Background color for your persona's chat message bubbles."
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && (
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{subtitle}</p>
      )}
    </div>
  );
}

function TextareaTab({
  title,
  subtitle,
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div>
      <SectionHeader title={title} subtitle={subtitle} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
      />
      <p className="mt-1.5 text-right text-[10px] text-[var(--muted-foreground)]">
        {value.length} characters
      </p>
    </div>
  );
}
