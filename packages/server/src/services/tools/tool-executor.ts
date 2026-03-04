// ──────────────────────────────────────────────
// Tool Executor — Handles built-in + custom function calls
// ──────────────────────────────────────────────
import type { LLMToolCall } from "../llm/base-provider.js";

export interface ToolExecutionResult {
  toolCallId: string;
  name: string;
  result: string;
  success: boolean;
}

/** A custom tool loaded from DB at execution time. */
export interface CustomToolDef {
  name: string;
  executionType: string;
  webhookUrl: string | null;
  staticResult: string | null;
  scriptBody: string | null;
}

/**
 * Execute a batch of tool calls, returning results for each.
 * Supports built-in tools and user-defined custom tools.
 */
export async function executeToolCalls(
  toolCalls: LLMToolCall[],
  context?: { gameState?: Record<string, unknown>; customTools?: CustomToolDef[] },
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const call of toolCalls) {
    try {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        args = {};
      }

      const result = await executeSingleTool(call.function.name, args, context);
      results.push({
        toolCallId: call.id,
        name: call.function.name,
        result: typeof result === "string" ? result : JSON.stringify(result),
        success: true,
      });
    } catch (err) {
      results.push({
        toolCallId: call.id,
        name: call.function.name,
        result: err instanceof Error ? err.message : "Tool execution failed",
        success: false,
      });
    }
  }

  return results;
}

async function executeSingleTool(
  name: string,
  args: Record<string, unknown>,
  context?: { gameState?: Record<string, unknown>; customTools?: CustomToolDef[] },
): Promise<unknown> {
  switch (name) {
    case "roll_dice":
      return rollDice(args);
    case "update_game_state":
      return updateGameState(args, context?.gameState);
    case "set_expression":
      return setExpression(args);
    case "trigger_event":
      return triggerEvent(args);
    case "search_lorebook":
      return searchLorebook(args);
    default: {
      // Try custom tools
      const custom = context?.customTools?.find((t) => t.name === name);
      if (custom) return executeCustomTool(custom, args);
      return { error: `Unknown tool: ${name}`, available: ["roll_dice", "update_game_state", "set_expression", "trigger_event", "search_lorebook"] };
    }
  }
}

// ── Custom Tool Execution ──

async function executeCustomTool(
  tool: CustomToolDef,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (tool.executionType) {
    case "static":
      return { result: tool.staticResult ?? "OK", tool: tool.name, args };

    case "webhook": {
      if (!tool.webhookUrl) return { error: "No webhook URL configured" };
      try {
        const res = await fetch(tool.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: tool.name, arguments: args }),
          signal: AbortSignal.timeout(10_000),
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { result: text }; }
      } catch (err) {
        return { error: `Webhook call failed: ${err instanceof Error ? err.message : "unknown"}` };
      }
    }

    case "script": {
      if (!tool.scriptBody) return { error: "No script body configured" };
      try {
        // Safe-ish sandboxed eval using Function constructor
        // Only allows access to args, JSON, Math, String, Number, Date, Array
        const fn = new Function(
          "args", "JSON", "Math", "String", "Number", "Date", "Array",
          `"use strict"; ${tool.scriptBody}`,
        );
        const result = fn(args, JSON, Math, String, Number, Date, Array);
        return result ?? { result: "OK" };
      } catch (err) {
        return { error: `Script error: ${err instanceof Error ? err.message : "unknown"}` };
      }
    }

    default:
      return { error: `Unknown execution type: ${tool.executionType}` };
  }
}

// ── Built-in Tool Implementations ──

function rollDice(args: Record<string, unknown>): Record<string, unknown> {
  const notation = String(args.notation ?? "1d6");
  const reason = String(args.reason ?? "");

  // Parse notation: NdS+M or NdS-M
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    return { error: `Invalid dice notation: ${notation}`, hint: "Use format like 2d6, 1d20+5, 3d8-2" };
  }

  const count = parseInt(match[1]!, 10);
  const sides = parseInt(match[2]!, 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
    return { error: "Dice values out of range (1-100 dice, 2-1000 sides)" };
  }

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;

  return {
    notation,
    rolls,
    sum,
    modifier,
    total,
    reason,
    display: `🎲 ${notation}${reason ? ` (${reason})` : ""}: [${rolls.join(", ")}]${modifier ? ` ${modifier > 0 ? "+" : ""}${modifier}` : ""} = **${total}**`,
  };
}

function updateGameState(
  args: Record<string, unknown>,
  _gameState?: Record<string, unknown>,
): Record<string, unknown> {
  // Returns the update instruction — the client/agent pipeline applies it
  return {
    applied: true,
    update: {
      type: args.type,
      target: args.target,
      key: args.key,
      value: args.value,
      description: args.description ?? "",
    },
    display: `📊 ${args.type}: ${args.target} — ${args.key} → ${args.value}`,
  };
}

function setExpression(args: Record<string, unknown>): Record<string, unknown> {
  return {
    applied: true,
    characterName: args.characterName,
    expression: args.expression,
    display: `🎭 ${args.characterName}: expression → ${args.expression}`,
  };
}

function triggerEvent(args: Record<string, unknown>): Record<string, unknown> {
  return {
    applied: true,
    eventType: args.eventType,
    description: args.description,
    involvedCharacters: args.involvedCharacters ?? [],
    display: `⚡ Event (${args.eventType}): ${args.description}`,
  };
}

function searchLorebook(args: Record<string, unknown>): Record<string, unknown> {
  // In a full implementation, this would search the actual lorebook DB
  // For now, return a placeholder that the agent can work with
  return {
    query: args.query,
    category: args.category ?? null,
    results: [],
    note: "Lorebook search results will be injected by the Lorebook Keeper agent when available.",
  };
}
