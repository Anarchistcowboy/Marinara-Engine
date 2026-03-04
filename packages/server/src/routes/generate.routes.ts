// ──────────────────────────────────────────────
// Routes: Generation (SSE Streaming with Tool Use)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { generateRequestSchema, BUILT_IN_TOOLS } from "@rpg-engine/shared";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { assemblePrompt, type AssemblerInput } from "../services/prompt/index.js";
import type { LLMToolDefinition, ChatMessage } from "../services/llm/base-provider.js";
import { executeToolCalls } from "../services/tools/tool-executor.js";

export async function generateRoutes(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const presets = createPromptsStorage(app.db);
  const chars = createCharactersStorage(app.db);

  /**
   * POST /api/generate
   * Streams AI generation via Server-Sent Events.
   */
  app.post("/", async (req, reply) => {
    const input = generateRequestSchema.parse(req.body);

    // Resolve the chat
    const chat = await chats.getById(input.chatId);
    if (!chat) {
      return reply.status(404).send({ error: "Chat not found" });
    }

    // Save user message (if provided)
    if (input.userMessage) {
      await chats.createMessage({
        chatId: input.chatId,
        role: "user",
        characterId: null,
        content: input.userMessage,
      });
    }

    // Resolve connection
    let connId = input.connectionId ?? chat.connectionId;

    // ── Random connection: pick one from the random pool ──
    if (connId === "random") {
      const pool = await connections.listRandomPool();
      if (!pool.length) {
        return reply.status(400).send({ error: "No connections are marked for the random pool" });
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      connId = picked.id;
    }

    if (!connId) {
      return reply.status(400).send({ error: "No API connection configured for this chat" });
    }
    const conn = await connections.getWithKey(connId);
    if (!conn) {
      return reply.status(400).send({ error: "API connection not found" });
    }

    // Resolve base URL — fall back to provider default if empty
    let baseUrl = conn.baseUrl;
    if (!baseUrl) {
      const { PROVIDERS } = await import("@rpg-engine/shared");
      const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      baseUrl = providerDef?.defaultBaseUrl ?? "";
    }
    if (!baseUrl) {
      return reply.status(400).send({ error: "No base URL configured for this connection" });
    }

    // Set up SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      // Get chat messages
      const chatMessages = await chats.listMessages(input.chatId);
      const mappedMessages = chatMessages.map((m: any) => ({
        role: m.role === "narrator" ? ("system" as const) : (m.role as "user" | "assistant" | "system"),
        content: m.content as string,
      }));

      const characterIds: string[] = JSON.parse(chat.characterIds as string);

      // Resolve persona
      let personaName = "User";
      let personaDescription = "";
      let personaFields: { personality?: string; scenario?: string; backstory?: string; appearance?: string } = {};
      const allPersonas = await chars.listPersonas();
      const activePersona = allPersonas.find((p: any) => p.isActive === "true");
      if (activePersona) {
        personaName = activePersona.name;
        personaDescription = activePersona.description;
        personaFields = {
          personality: activePersona.personality ?? "",
          scenario: activePersona.scenario ?? "",
          backstory: activePersona.backstory ?? "",
          appearance: activePersona.appearance ?? "",
        };
      }

      // ── Assembler path: use preset if the chat has one ──
      const chatMeta = chat.metadata ? JSON.parse(chat.metadata as string) : {};
      const presetId = chatMeta.presetId as string | undefined;
      const chatChoices = (chatMeta.presetChoices ?? {}) as Record<string, string>;

      let finalMessages = mappedMessages;
      let temperature = 1;
      let maxTokens = 4096;

      if (presetId) {
        const preset = await presets.getById(presetId);
        if (preset) {
          const [sections, groups, choiceBlocks] = await Promise.all([
            presets.listSections(presetId),
            presets.listGroups(presetId),
            presets.listChoiceBlocksForPreset(presetId),
          ]);

          const assemblerInput: AssemblerInput = {
            db: app.db,
            preset: preset as any,
            sections: sections as any,
            groups: groups as any,
            choiceBlocks: choiceBlocks as any,
            chatChoices,
            chatId: input.chatId,
            characterIds,
            personaName,
            personaDescription,
            personaFields,
            chatMessages: mappedMessages,
          };

          const assembled = await assemblePrompt(assemblerInput);
          finalMessages = assembled.messages;
          temperature = assembled.parameters.temperature;
          maxTokens = assembled.parameters.maxTokens;
        }
      }

      // Create provider
      const provider = createLLMProvider(conn.provider, baseUrl, conn.apiKey);

      // Check if tool-use is requested (from chat metadata or input)
      const inputBody = req.body as Record<string, unknown>;
      const enableTools = inputBody.enableTools === true || chatMeta.enableTools === true;

      // Build OpenAI-compatible tool definitions from built-in tools
      const toolDefs: LLMToolDefinition[] | undefined = enableTools
        ? BUILT_IN_TOOLS.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters as unknown as Record<string, unknown>,
            },
          }))
        : undefined;

      let fullResponse = "";

      if (enableTools && provider.chatComplete) {
        // ── Tool-use loop: non-streaming with iterative tool calls ──
        const MAX_TOOL_ROUNDS = 5;
        let loopMessages: ChatMessage[] = finalMessages.map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        }));

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const result = await provider.chatComplete(loopMessages, {
            model: conn.model,
            temperature,
            maxTokens,
            tools: toolDefs,
          });

          // If the model returned text content, stream it
          if (result.content) {
            fullResponse += result.content;
            reply.raw.write(`data: ${JSON.stringify({ type: "token", data: result.content })}\n\n`);
          }

          // If no tool calls, we're done
          if (!result.toolCalls.length) break;

          // Add assistant message with tool calls to conversation
          loopMessages.push({
            role: "assistant",
            content: result.content ?? "",
            tool_calls: result.toolCalls,
          });

          // Execute all tool calls
          const toolResults = await executeToolCalls(result.toolCalls);

          // Send tool call info to client for display
          for (const tr of toolResults) {
            reply.raw.write(`data: ${JSON.stringify({
              type: "tool_result",
              data: { name: tr.name, result: tr.result, success: tr.success },
            })}\n\n`);
          }

          // Add tool results to conversation
          for (const tr of toolResults) {
            loopMessages.push({
              role: "tool",
              content: tr.result,
              tool_call_id: tr.toolCallId,
            });
          }

          // If this was the last round, force a final response without tools
          if (round === MAX_TOOL_ROUNDS - 1) {
            const finalResult = await provider.chatComplete(loopMessages, {
              model: conn.model,
              temperature,
              maxTokens,
            });
            if (finalResult.content) {
              fullResponse += finalResult.content;
              reply.raw.write(`data: ${JSON.stringify({ type: "token", data: finalResult.content })}\n\n`);
            }
          }
        }
      } else {
        // ── Standard streaming (no tools) ──
        for await (const chunk of provider.chat(finalMessages, {
          model: conn.model,
          temperature,
          maxTokens,
          stream: true,
        })) {
          fullResponse += chunk;
          reply.raw.write(`data: ${JSON.stringify({ type: "token", data: chunk })}\n\n`);
        }
      }

      // Save assistant message
      await chats.createMessage({
        chatId: input.chatId,
        role: "assistant",
        characterId: characterIds[0] ?? null,
        content: fullResponse,
      });

      // Signal completion
      reply.raw.write(`data: ${JSON.stringify({ type: "done", data: "" })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      reply.raw.write(`data: ${JSON.stringify({ type: "error", data: message })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });
}
