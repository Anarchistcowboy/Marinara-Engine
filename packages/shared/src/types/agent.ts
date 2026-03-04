// ──────────────────────────────────────────────
// Agent System Types
// ──────────────────────────────────────────────

/** When in the generation pipeline an agent runs. */
export type AgentPhase =
  /** Before the main generation (can modify prompt context) */
  | "pre_generation"
  /** In parallel with or after the main generation */
  | "parallel"
  /** After the main response is complete (can modify it) */
  | "post_processing";

/** The result type an agent can produce. */
export type AgentResultType =
  | "game_state_update"
  | "text_rewrite"
  | "sprite_change"
  | "echo_message"
  | "quest_update"
  | "image_prompt"
  | "context_injection"
  | "continuity_check"
  | "director_event"
  | "lorebook_update"
  | "prompt_review";

/** Configuration for a single agent. */
export interface AgentConfig {
  id: string;
  /** Agent type identifier (e.g. "world-state", "prose-guardian") */
  type: string;
  /** Display name */
  name: string;
  description: string;
  /** When this agent runs in the pipeline */
  phase: AgentPhase;
  /** Whether globally enabled */
  enabled: boolean;
  /** Override: use a different connection/model for this agent */
  connectionId: string | null;
  /** Agent-specific prompt template */
  promptTemplate: string;
  /** Agent-specific settings */
  settings: Record<string, unknown>;
  /** Function/tool definitions this agent can use */
  tools: ToolDefinition[];
  /** Tool calling configuration */
  toolConfig: AgentToolConfig | null;
  createdAt: string;
  updatedAt: string;
}

/** Result produced by an agent after execution. */
export interface AgentResult {
  agentId: string;
  agentType: string;
  type: AgentResultType;
  /** The result payload (varies by type) */
  data: unknown;
  /** Token usage */
  tokensUsed: number;
  /** How long the agent took */
  durationMs: number;
  /** Whether the agent succeeded */
  success: boolean;
  error: string | null;
}

/** Shared context passed to every agent. */
export interface AgentContext {
  chatId: string;
  chatMode: string;
  /** Recent chat history (last N messages) */
  recentMessages: Array<{ role: string; content: string; characterId?: string }>;
  /** The main response text (available for post-processing agents) */
  mainResponse: string | null;
  /** Current game state (if any) */
  gameState: import("./game-state.js").GameState | null;
  /** Active characters in the chat */
  characters: Array<{ id: string; name: string; description: string }>;
  /** User persona info */
  persona: { name: string; description: string } | null;
  /** The agent's own persistent memory (key-value) */
  memory: Record<string, unknown>;
  /** Lorebook entries activated for this generation (read context) */
  activatedLorebookEntries: Array<{ id: string; name: string; content: string; tag: string }> | null;
  /** All lorebook IDs the agent can write to */
  writableLorebookIds: string[] | null;
}

/** Built-in agent type identifiers. */
export const BUILT_IN_AGENT_IDS = {
  WORLD_STATE: "world-state",
  PROSE_GUARDIAN: "prose-guardian",
  CONTINUITY: "continuity",
  EXPRESSION: "expression",
  ECHO_CHAMBER: "echo-chamber",
  DIRECTOR: "director",
  QUEST: "quest",
  ILLUSTRATOR: "illustrator",
  LOREBOOK_KEEPER: "lorebook-keeper",
  PROMPT_REVIEWER: "prompt-reviewer",
} as const;

export interface BuiltInAgentMeta {
  id: string;
  name: string;
  description: string;
  phase: AgentPhase;
  enabledByDefault: boolean;
}

export const BUILT_IN_AGENTS: BuiltInAgentMeta[] = [
  { id: "world-state", name: "World State", description: "Tracks date/time, weather, location, and present characters automatically.", phase: "post_processing", enabledByDefault: true },
  { id: "prose-guardian", name: "Prose Guardian", description: "Silently reviews output quality and nudges the model toward better prose.", phase: "pre_generation", enabledByDefault: true },
  { id: "continuity", name: "Continuity Checker", description: "Detects contradictions with established lore and facts.", phase: "post_processing", enabledByDefault: true },
  { id: "expression", name: "Expression Engine", description: "Detects character emotions and selects VN sprites/expressions.", phase: "post_processing", enabledByDefault: false },
  { id: "echo-chamber", name: "EchoChamber", description: "Generates brief in-character reactions from inactive group members.", phase: "parallel", enabledByDefault: false },
  { id: "director", name: "Narrative Director", description: "Introduces events, NPCs, and plot beats to keep the story moving.", phase: "pre_generation", enabledByDefault: false },
  { id: "quest", name: "Quest Tracker", description: "Manages quest objectives, completion states, and rewards.", phase: "post_processing", enabledByDefault: false },
  { id: "illustrator", name: "Illustrator", description: "Generates image prompts for key scenes (requires image generation API).", phase: "parallel", enabledByDefault: false },
  { id: "lorebook-keeper", name: "Lorebook Keeper", description: "Automatically creates and updates lorebook entries based on story events, new characters, and world changes.", phase: "post_processing", enabledByDefault: false },
  { id: "prompt-reviewer", name: "Prompt Reviewer", description: "Analyses your prompt preset for clarity, redundancy, and formatting issues, and suggests improvements.", phase: "pre_generation", enabledByDefault: false },
];

/** Data shape for a lorebook_update agent result. */
export interface LorebookUpdateResult {
  /** "create" | "update" | "delete" */
  action: "create" | "update" | "delete";
  /** Target lorebook ID */
  lorebookId: string;
  /** Entry ID (for update/delete) */
  entryId?: string;
  /** Entry data (for create/update) */
  entry?: {
    name: string;
    content: string;
    keys: string[];
    tag?: string;
  };
}

// ──────────────────────────────────────────────
// Function Calling / Tool Use Types
// ──────────────────────────────────────────────

/** JSON Schema subset for tool parameter definitions. */
export interface ToolParameterSchema {
  type: "object" | "string" | "number" | "boolean" | "array";
  description?: string;
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  items?: ToolParameterProperty;
}

export interface ToolParameterProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: ToolParameterProperty;
  default?: unknown;
}

/** Definition of a tool/function that an agent can call. */
export interface ToolDefinition {
  /** Unique tool name (e.g. "get_weather", "roll_dice") */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for the parameters */
  parameters: ToolParameterSchema;
}

/** A tool call made by the model during generation. */
export interface ToolCall {
  /** Server-assigned ID for tracking */
  id: string;
  /** Which tool to call */
  name: string;
  /** Parsed arguments */
  arguments: Record<string, unknown>;
}

/** Result of executing a tool call. */
export interface ToolResult {
  /** Matches the ToolCall id */
  toolCallId: string;
  /** Tool name for display */
  name: string;
  /** Stringified result */
  result: string;
  /** Whether execution succeeded */
  success: boolean;
}

/** A user-created custom function tool persisted in DB. */
export interface CustomTool {
  id: string;
  name: string;
  description: string;
  parametersSchema: ToolParameterSchema;
  executionType: "webhook" | "static" | "script";
  webhookUrl: string | null;
  staticResult: string | null;
  scriptBody: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Extended AgentConfig with tool definitions. */
export interface AgentToolConfig {
  /** Tools this agent can use */
  tools: ToolDefinition[];
  /** How many tool calls are allowed per turn (0 = unlimited) */
  maxCallsPerTurn: number;
  /** Whether to allow parallel tool calls */
  parallelCalls: boolean;
}

/** Built-in tool definitions available to all agents. */
export const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    name: "roll_dice",
    description: "Roll dice using standard notation (e.g. 2d6, 1d20+5). Used for RPG mechanics, skill checks, and random outcomes.",
    parameters: {
      type: "object",
      properties: {
        notation: { type: "string", description: "Dice notation (e.g. '2d6', '1d20+5', '3d8-2')" },
        reason: { type: "string", description: "Why the roll is being made (e.g. 'Perception check')" },
      },
      required: ["notation"],
    },
  },
  {
    name: "update_game_state",
    description: "Update the current game state — character stats, inventory, quest progress, etc.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Type of update",
          enum: ["stat_change", "inventory_add", "inventory_remove", "quest_update", "location_change", "time_advance"],
        },
        target: { type: "string", description: "Who or what is being updated (character name or 'player')" },
        key: { type: "string", description: "The specific stat/item/quest being changed" },
        value: { type: "string", description: "The new value or change amount" },
        description: { type: "string", description: "Human-readable description of the change" },
      },
      required: ["type", "target", "key", "value"],
    },
  },
  {
    name: "set_expression",
    description: "Set a character's sprite expression for visual novel display.",
    parameters: {
      type: "object",
      properties: {
        characterName: { type: "string", description: "Name of the character" },
        expression: { type: "string", description: "Expression name (e.g. happy, sad, angry, neutral)" },
      },
      required: ["characterName", "expression"],
    },
  },
  {
    name: "trigger_event",
    description: "Trigger a narrative event — introduce an NPC, start a quest, change the scene, etc.",
    parameters: {
      type: "object",
      properties: {
        eventType: {
          type: "string",
          description: "Type of event",
          enum: ["npc_entrance", "npc_exit", "quest_start", "quest_complete", "scene_change", "combat_start", "combat_end", "revelation", "custom"],
        },
        description: { type: "string", description: "What happens in this event" },
        involvedCharacters: { type: "array", items: { type: "string" }, description: "Names of characters involved" },
      },
      required: ["eventType", "description"],
    },
  },
  {
    name: "search_lorebook",
    description: "Search the lorebook for relevant world-building information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query — keywords, character names, locations, etc." },
        category: { type: "string", description: "Optional category filter" },
      },
      required: ["query"],
    },
  },
];
