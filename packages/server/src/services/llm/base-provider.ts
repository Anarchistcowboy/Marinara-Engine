// ──────────────────────────────────────────────
// LLM Provider — Abstract Base
// ──────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** For tool result messages */
  tool_call_id?: string;
  /** For assistant messages with tool calls */
  tool_calls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  stop?: string[];
  /** Tool/function definitions for function calling */
  tools?: LLMToolDefinition[];
}

/** Result from a non-streaming chat call that may include tool calls */
export interface ChatCompletionResult {
  content: string | null;
  toolCalls: LLMToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | string;
}

/**
 * Abstract base for all LLM providers.
 * Every provider must implement the `chat` method as an async generator.
 */
export abstract class BaseLLMProvider {
  constructor(
    protected baseUrl: string,
    protected apiKey: string,
  ) {}

  /**
   * Stream a chat completion. Yields text chunks.
   */
  abstract chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<string, void, unknown>;

  /**
   * Non-streaming chat completion with tool-use support.
   * Default implementation collects from the streaming generator.
   */
  async chatComplete(
    messages: ChatMessage[],
    options: ChatOptions,
  ): Promise<ChatCompletionResult> {
    let content = "";
    for await (const chunk of this.chat(messages, { ...options, stream: false })) {
      content += chunk;
    }
    return { content, toolCalls: [], finishReason: "stop" };
  }
}
