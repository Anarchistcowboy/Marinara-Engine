// ──────────────────────────────────────────────
// Prompt Assembler — Orchestrator
// Builds the final ChatML message array from a
// preset, character info, chat history, lorebooks,
// persona, and per-chat choice selections.
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import type {
  ChatMLMessage,
  PromptPreset,
  PromptSection,
  PromptGroup,
  ChoiceBlock,
  MarkerConfig,
  WrapFormat,
  GenerationParameters,
} from "@rpg-engine/shared";
import { resolveMacros } from "@rpg-engine/shared";
import type { MacroContext } from "@rpg-engine/shared";
import { wrapContent, wrapGroup } from "./format-engine.js";
import { expandMarker, type MarkerContext } from "./marker-expander.js";
import { mergeAdjacentMessages, squashLeadingSystemMessages } from "./merger.js";
import { injectAtDepth } from "../lorebook/prompt-injector.js";

// ═══════════════════════════════════════════════
//  Public Interface
// ═══════════════════════════════════════════════

/** Everything the assembler needs to produce a prompt. */
export interface AssemblerInput {
  db: DB;
  /** The prompt preset to use */
  preset: {
    id: string;
    name: string;
    sectionOrder: string;  // JSON string of string[]
    groupOrder: string;    // JSON string of string[]
    wrapFormat: string;    // "xml" | "markdown"
    parameters: string;    // JSON string of GenerationParameters
    variableGroups: string;
    variableValues: string;
  };
  /** All sections belonging to this preset (raw DB rows) */
  sections: Array<{
    id: string;
    presetId: string;
    identifier: string;
    name: string;
    content: string;
    role: string;
    enabled: string;       // "true" / "false"
    isMarker: string;      // "true" / "false"
    groupId: string | null;
    markerConfig: string | null; // JSON string
    injectionPosition: string;
    injectionDepth: number;
    injectionOrder: number;
    forbidOverrides: string;
  }>;
  /** All groups for this preset */
  groups: Array<{
    id: string;
    presetId: string;
    name: string;
    parentGroupId: string | null;
    order: number;
    enabled: string;
    createdAt: string;
  }>;
  /** Choice blocks with their options */
  choiceBlocks: Array<{
    id: string;
    sectionId: string;
    label: string;
    options: string; // JSON string of ChoiceOption[]
    createdAt: string;
  }>;
  /** Per-chat choice selections: { [sectionId]: selectedOptionId } */
  chatChoices: Record<string, string>;
  /** Chat context */
  chatId: string;
  characterIds: string[];
  personaName: string;
  personaDescription: string;
  personaFields?: {
    personality?: string;
    scenario?: string;
    backstory?: string;
    appearance?: string;
  };
  /** Chat messages from the DB (user + assistant + narrator etc.) */
  chatMessages: ChatMLMessage[];
}

/** Output of the assembler. */
export interface AssemblerOutput {
  /** Final ChatML messages ready for the LLM */
  messages: ChatMLMessage[];
  /** Parsed generation parameters */
  parameters: GenerationParameters;
  /** Any lorebook depth entries that were queued (already injected into messages) */
  lorebookDepthEntriesCount: number;
}

// ═══════════════════════════════════════════════
//  Main Assembler
// ═══════════════════════════════════════════════

export async function assemblePrompt(input: AssemblerInput): Promise<AssemblerOutput> {
  const wrapFormat = (input.preset.wrapFormat || "xml") as WrapFormat;
  const parameters = JSON.parse(input.preset.parameters) as GenerationParameters;
  const sectionOrder = JSON.parse(input.preset.sectionOrder) as string[];
  const groupOrder = JSON.parse(input.preset.groupOrder) as string[];
  const variableValues = JSON.parse(input.preset.variableValues) as Record<string, string>;

  // Build lookup maps
  const sectionMap = new Map(input.sections.map((s) => [s.id, s]));
  const groupMap = new Map(input.groups.map((g) => [g.id, g]));
  const choiceMap = new Map(input.choiceBlocks.map((c) => [c.sectionId, c]));

  // Build macro context (character names resolved from IDs)
  const charNames = await resolveCharacterNames(input.db, input.characterIds);
  const macroCtx: MacroContext = {
    user: input.personaName || "User",
    char: charNames[0] || "Character",
    characters: charNames,
    variables: variableValues,
  };

  // Build marker context
  const markerCtx: MarkerContext = {
    db: input.db,
    chatId: input.chatId,
    characterIds: input.characterIds,
    personaName: input.personaName,
    personaDescription: input.personaDescription,
    personaFields: input.personaFields,
    chatMessages: input.chatMessages,
    wrapFormat,
  };

  // ── Phase 1: Resolve sections in preset order ──
  // Separate ordered sections from depth-injected ones
  const orderedSections: ResolvedSection[] = [];
  const depthSections: ResolvedSection[] = [];
  let lorebookDepthEntriesCount = 0;

  for (const sectionId of sectionOrder) {
    const section = sectionMap.get(sectionId);
    if (!section) continue;
    if (section.enabled !== "true") continue;

    // Check if group is enabled
    if (section.groupId) {
      const group = groupMap.get(section.groupId);
      if (group && group.enabled !== "true") continue;
    }

    const resolved = await resolveSection(section, {
      macroCtx,
      markerCtx,
      choiceMap,
      chatChoices: input.chatChoices,
      wrapFormat,
    });

    if (!resolved) continue;

    if (section.injectionPosition === "depth" && section.injectionDepth > 0) {
      depthSections.push(resolved);
    } else {
      orderedSections.push(resolved);
    }
  }

  // ── Phase 2: Group wrapping ──
  // Build ordered messages, wrapping grouped sections
  const messages: ChatMLMessage[] = [];
  const processedSections = new Set<string>();

  // Process in section order, grouping adjacent sections in the same group
  for (let i = 0; i < orderedSections.length; i++) {
    const section = orderedSections[i]!;
    if (processedSections.has(section.id)) continue;

    if (section.groupId) {
      // Collect all consecutive sections in the same group
      const groupSections: ResolvedSection[] = [section];
      processedSections.add(section.id);

      for (let j = i + 1; j < orderedSections.length; j++) {
        const next = orderedSections[j]!;
        if (next.groupId === section.groupId) {
          groupSections.push(next);
          processedSections.add(next.id);
        }
      }

      // Get group info for wrapping
      const group = groupMap.get(section.groupId);
      if (group) {
        const groupMessages = buildGroupMessages(groupSections, group, wrapFormat);
        messages.push(...groupMessages);
      } else {
        // Group not found — just add sections directly
        for (const gs of groupSections) {
          messages.push(...gs.messages);
        }
      }
    } else {
      processedSections.add(section.id);
      messages.push(...section.messages);
    }
  }

  // ── Phase 3: Adjacent same-role merging ──
  let finalMessages = mergeAdjacentMessages(messages);

  // ── Phase 4: Squash leading system messages if enabled ──
  if (parameters.squashSystemMessages) {
    finalMessages = squashLeadingSystemMessages(finalMessages);
  }

  // ── Phase 5: Inject depth-based sections ──
  if (depthSections.length > 0) {
    const depthEntries = depthSections.flatMap((s) =>
      s.messages.map((m) => ({
        content: m.content,
        role: m.role as "system" | "user" | "assistant",
        depth: s.depth,
      })),
    );
    finalMessages = injectAtDepth(finalMessages, depthEntries);
    lorebookDepthEntriesCount = depthEntries.length;
  }

  return {
    messages: finalMessages,
    parameters,
    lorebookDepthEntriesCount,
  };
}

// ═══════════════════════════════════════════════
//  Internal Types
// ═══════════════════════════════════════════════

interface ResolvedSection {
  id: string;
  groupId: string | null;
  role: "system" | "user" | "assistant";
  messages: ChatMLMessage[];
  depth: number;
}

interface ResolveSectionCtx {
  macroCtx: MacroContext;
  markerCtx: MarkerContext;
  choiceMap: Map<string, { id: string; sectionId: string; label: string; options: string }>;
  chatChoices: Record<string, string>;
  wrapFormat: WrapFormat;
}

// ═══════════════════════════════════════════════
//  Section Resolution
// ═══════════════════════════════════════════════

async function resolveSection(
  section: AssemblerInput["sections"][number],
  ctx: ResolveSectionCtx,
): Promise<ResolvedSection | null> {
  const role = section.role as "system" | "user" | "assistant";

  // Check for choice block — override content if user has selected an option
  let content = section.content;
  const choiceBlock = ctx.choiceMap.get(section.id);
  if (choiceBlock) {
    const selectedOptionId = ctx.chatChoices[section.id];
    if (selectedOptionId) {
      const options = JSON.parse(choiceBlock.options) as Array<{ id: string; content: string }>;
      const selected = options.find((o) => o.id === selectedOptionId);
      if (selected) {
        content = selected.content;
      }
    }
  }

  // Handle marker sections
  if (section.isMarker === "true" && section.markerConfig) {
    const markerConfig = JSON.parse(section.markerConfig) as MarkerConfig;
    const expanded = await expandMarker(markerConfig, ctx.markerCtx);

    // Chat history marker returns multiple messages
    if (markerConfig.type === "chat_history" && expanded.messages) {
      return {
        id: section.id,
        groupId: section.groupId,
        role,
        messages: expanded.messages,
        depth: section.injectionDepth,
      };
    }

    // Other markers return content to be wrapped
    content = expanded.content;
    if (!content.trim()) return null;
  }

  // Resolve macros
  content = resolveMacros(content, ctx.macroCtx);
  if (!content.trim()) return null;

  // Auto-wrap in the preset's format
  const wrapped = wrapContent(content, section.name, ctx.wrapFormat);

  return {
    id: section.id,
    groupId: section.groupId,
    role,
    messages: [{ role, content: wrapped || content }],
    depth: section.injectionDepth,
  };
}

// ═══════════════════════════════════════════════
//  Group Building
// ═══════════════════════════════════════════════

/**
 * Build messages for a group of sections.
 * If all sections share the same role, wrap them in a group tag.
 * If roles differ, create separate messages per role (no group wrapping across roles).
 */
function buildGroupMessages(
  sections: ResolvedSection[],
  group: { name: string },
  wrapFormat: WrapFormat,
): ChatMLMessage[] {
  // Check if all sections share the same role
  const roles = new Set(sections.map((s) => s.role));

  if (roles.size === 1) {
    // All same role — combine content and wrap in group
    const role = sections[0]!.role;
    const innerContent = sections
      .flatMap((s) => s.messages.map((m) => m.content))
      .join("\n\n");
    const wrapped = wrapGroup(innerContent, group.name, wrapFormat);
    return [{ role, content: wrapped || innerContent }];
  }

  // Mixed roles — group consecutive same-role sections and wrap each group
  const result: ChatMLMessage[] = [];
  let currentRole: string | null = null;
  let currentParts: string[] = [];

  const flush = () => {
    if (currentRole && currentParts.length > 0) {
      const combined = currentParts.join("\n\n");
      // When roles are mixed, don't apply group wrapping (it would lose the role split)
      result.push({
        role: currentRole as "system" | "user" | "assistant",
        content: combined,
      });
    }
    currentParts = [];
  };

  for (const section of sections) {
    if (section.role !== currentRole) {
      flush();
      currentRole = section.role;
    }
    for (const msg of section.messages) {
      currentParts.push(msg.content);
    }
  }
  flush();

  return result;
}

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

async function resolveCharacterNames(db: DB, characterIds: string[]): Promise<string[]> {
  if (characterIds.length === 0) return [];

  const { createCharactersStorage } = await import("../storage/characters.storage.js");
  const chars = createCharactersStorage(db);
  const names: string[] = [];

  for (const id of characterIds) {
    const row = await chars.getById(id);
    if (row) {
      const data = JSON.parse(row.data) as { name: string };
      names.push(data.name);
    }
  }

  return names;
}
