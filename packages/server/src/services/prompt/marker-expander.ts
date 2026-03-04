// ──────────────────────────────────────────────
// Marker Expander — Resolves special marker
// sections into actual content at assembly time.
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import type { MarkerConfig, ChatMLMessage, CharacterData, WrapFormat } from "@rpg-engine/shared";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { processLorebooks } from "../lorebook/index.js";
import { wrapContent } from "./format-engine.js";

/** Context required for expanding markers. */
export interface MarkerContext {
  db: DB;
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
  chatMessages: ChatMLMessage[];
  wrapFormat: WrapFormat;
}

/** Expanded marker result. */
export interface ExpandedMarker {
  /** Content to be inserted as the section body */
  content: string;
  /** If the marker produces multiple messages (e.g. chat_history), they go here */
  messages?: ChatMLMessage[];
}

/**
 * Expand a marker section into actual content based on its type and config.
 */
export async function expandMarker(
  config: MarkerConfig,
  ctx: MarkerContext,
): Promise<ExpandedMarker> {
  switch (config.type) {
    case "character":
      return expandCharacter(config, ctx);
    case "persona":
      return expandPersona(config, ctx);
    case "lorebook":
    case "world_info_before":
    case "world_info_after":
      return expandLorebook(config, ctx);
    case "chat_history":
      return expandChatHistory(config, ctx);
    case "dialogue_examples":
      return expandDialogueExamples(config, ctx);
    default:
      return { content: "" };
  }
}

// ── Character ──────────────────────────────────

async function expandCharacter(
  config: MarkerConfig,
  ctx: MarkerContext,
): Promise<ExpandedMarker> {
  const charStorage = createCharactersStorage(ctx.db);
  const parts: string[] = [];

  for (const charId of ctx.characterIds) {
    const row = await charStorage.getById(charId);
    if (!row) continue;
    const data = JSON.parse(row.data) as CharacterData;

    const fields = config.characterFields ?? [
      "name",
      "description",
      "personality",
      "scenario",
    ];

    const charParts: string[] = [];
    for (const field of fields) {
      const value = getCharacterField(data, field);
      if (value) {
        charParts.push(wrapContent(value, field, ctx.wrapFormat));
      }
    }

    if (ctx.characterIds.length > 1) {
      // Multi-character: wrap each character's info
      const charBlock = charParts.filter(Boolean).join("\n");
      if (charBlock) {
        parts.push(wrapContent(charBlock, data.name, ctx.wrapFormat));
      }
    } else {
      parts.push(...charParts.filter(Boolean));
    }
  }

  return { content: parts.join("\n") };
}

function getCharacterField(data: CharacterData, field: string): string {
  switch (field) {
    case "name":
      return data.name;
    case "description":
      return data.description;
    case "personality":
      return data.personality;
    case "scenario":
      return data.scenario;
    case "first_mes":
      return data.first_mes;
    case "system_prompt":
      return data.system_prompt;
    case "post_history_instructions":
      return data.post_history_instructions;
    case "creator_notes":
      return data.creator_notes;
    case "backstory":
      return data.extensions?.backstory ?? "";
    case "appearance":
      return data.extensions?.appearance ?? "";
    default:
      return "";
  }
}

// ── Persona ────────────────────────────────────

async function expandPersona(
  _config: MarkerConfig,
  ctx: MarkerContext,
): Promise<ExpandedMarker> {
  const parts: string[] = [];
  const pName = ctx.personaName || "User";

  if (ctx.personaDescription) {
    parts.push(wrapContent(ctx.personaDescription, "description", ctx.wrapFormat));
  }
  if (ctx.personaFields?.personality) {
    parts.push(wrapContent(ctx.personaFields.personality, "personality", ctx.wrapFormat));
  }
  if (ctx.personaFields?.backstory) {
    parts.push(wrapContent(ctx.personaFields.backstory, "backstory", ctx.wrapFormat));
  }
  if (ctx.personaFields?.appearance) {
    parts.push(wrapContent(ctx.personaFields.appearance, "appearance", ctx.wrapFormat));
  }
  if (ctx.personaFields?.scenario) {
    parts.push(wrapContent(ctx.personaFields.scenario, "scenario", ctx.wrapFormat));
  }

  if (parts.length === 0) return { content: "" };

  return {
    content: wrapContent(parts.join("\n"), pName, ctx.wrapFormat),
  };
}

// ── Lorebook / World Info ──────────────────────

async function expandLorebook(
  config: MarkerConfig,
  ctx: MarkerContext,
): Promise<ExpandedMarker> {
  const result = await processLorebooks(ctx.db, ctx.chatMessages, null, {
    chatId: ctx.chatId,
    characterIds: ctx.characterIds,
  });

  switch (config.type) {
    case "world_info_before":
      return { content: result.worldInfoBefore };
    case "world_info_after":
      return { content: result.worldInfoAfter };
    case "lorebook":
    default: {
      // Combined lorebook — all world info
      const combined = [result.worldInfoBefore, result.worldInfoAfter]
        .filter(Boolean)
        .join("\n\n");
      return { content: combined };
    }
  }
}

// ── Chat History ───────────────────────────────

async function expandChatHistory(
  config: MarkerConfig,
  ctx: MarkerContext,
): Promise<ExpandedMarker> {
  const opts = config.chatHistoryOptions ?? {};
  let messages = [...ctx.chatMessages];

  // Filter system messages if configured
  if (opts.includeSystemMessages === false) {
    messages = messages.filter((m) => m.role !== "system");
  }

  // Limit messages if configured
  if (opts.maxMessages && opts.maxMessages > 0) {
    messages = messages.slice(-opts.maxMessages);
  }

  // Chat history is special — it returns multiple messages to be inserted directly,
  // not a single content block. The assembler handles this.
  return { content: "", messages };
}

// ── Dialogue Examples ──────────────────────────

async function expandDialogueExamples(
  _config: MarkerConfig,
  ctx: MarkerContext,
): Promise<ExpandedMarker> {
  const charStorage = createCharactersStorage(ctx.db);
  const parts: string[] = [];

  for (const charId of ctx.characterIds) {
    const row = await charStorage.getById(charId);
    if (!row) continue;
    const data = JSON.parse(row.data) as CharacterData;

    if (data.mes_example) {
      parts.push(data.mes_example);
    }
  }

  return { content: parts.join("\n\n") };
}
