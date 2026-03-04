// ──────────────────────────────────────────────
// Routes: Chats
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createChatSchema, createMessageSchema } from "@rpg-engine/shared";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { characters } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

export async function chatsRoutes(app: FastifyInstance) {
  const storage = createChatsStorage(app.db);

  // List all chats
  app.get("/", async () => {
    return storage.list();
  });

  // List chats by group
  app.get<{ Params: { groupId: string } }>("/group/:groupId", async (req) => {
    return storage.listByGroup(req.params.groupId);
  });

  // Get single chat
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    return chat;
  });

  // Create chat
  app.post("/", async (req) => {
    const input = createChatSchema.parse(req.body);
    return storage.create(input);
  });

  // Update chat
  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const data = createChatSchema.partial().parse(req.body);
    return storage.update(req.params.id, data);
  });

  // Update chat metadata (partial merge)
  app.patch<{ Params: { id: string } }>("/:id/metadata", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const existing = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata ?? {};
    const incoming = req.body as Record<string, unknown>;
    const merged = { ...existing, ...incoming };
    return storage.updateMetadata(req.params.id, merged);
  });

  // Delete chat
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // ── Messages ──

  // List messages for a chat
  app.get<{ Params: { id: string } }>("/:id/messages", async (req) => {
    return storage.listMessages(req.params.id);
  });

  // Create message
  app.post<{ Params: { id: string } }>("/:id/messages", async (req) => {
    const input = createMessageSchema.parse({ ...(req.body as Record<string, unknown>), chatId: req.params.id });
    return storage.createMessage(input);
  });

  // Delete message
  app.delete<{ Params: { chatId: string; messageId: string } }>(
    "/:chatId/messages/:messageId",
    async (req, reply) => {
      await storage.removeMessage(req.params.messageId);
      return reply.status(204).send();
    },
  );

  // ── Swipes ──

  // List swipes for a message
  app.get<{ Params: { chatId: string; messageId: string } }>(
    "/:chatId/messages/:messageId/swipes",
    async (req) => {
      return storage.getSwipes(req.params.messageId);
    },
  );

  // Add a swipe
  app.post<{ Params: { chatId: string; messageId: string } }>(
    "/:chatId/messages/:messageId/swipes",
    async (req) => {
      const { content } = req.body as { content: string };
      return storage.addSwipe(req.params.messageId, content);
    },
  );

  // Set active swipe
  app.put<{ Params: { chatId: string; messageId: string } }>(
    "/:chatId/messages/:messageId/active-swipe",
    async (req) => {
      const { index } = req.body as { index: number };
      return storage.setActiveSwipe(req.params.messageId, index);
    },
  );

  // ── Export ──

  // Export chat as JSONL (SillyTavern-compatible format)
  app.get<{ Params: { id: string } }>("/:id/export", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const msgs = await storage.listMessages(req.params.id);

    // Parse characterIds to resolve character names
    const charIds: string[] = (() => {
      try { return JSON.parse(chat.characterIds as string); } catch { return []; }
    })();

    // Resolve primary character name
    let characterName = chat.name;
    if (charIds.length > 0) {
      try {
        const rows = await app.db.select().from(characters).where(eq(characters.id, charIds[0]!));
        if (rows[0]) {
          const data = JSON.parse(rows[0].data);
          characterName = data?.name ?? chat.name;
        }
      } catch {
        // use chat name
      }
    }

    // Build JSONL lines
    const lines: string[] = [];

    // Header line
    lines.push(JSON.stringify({
      user_name: "User",
      character_name: characterName,
      create_date: chat.createdAt,
      chat_metadata: {},
    }));

    // Message lines
    for (const msg of msgs) {
      lines.push(JSON.stringify({
        name: msg.role === "user" ? "User" : characterName,
        is_user: msg.role === "user",
        is_system: msg.role === "system" || msg.role === "narrator",
        mes: msg.content,
        send_date: msg.createdAt,
      }));
    }

    const jsonl = lines.join("\n");

    return reply
      .header("Content-Type", "application/jsonl")
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(chat.name)}.jsonl"`)
      .send(jsonl);
  });

  // ── Branch (duplicate) ──

  // Create a branch (copy) of an existing chat
  app.post<{ Params: { id: string } }>("/:id/branch", async (req, reply) => {
    const sourceChat = await storage.getById(req.params.id);
    if (!sourceChat) return reply.status(404).send({ error: "Chat not found" });

    const { upToMessageId } = (req.body ?? {}) as { upToMessageId?: string };

    // Create a new chat as a branch
    const branchName = `${sourceChat.name} (branch)`;
    const newChat = await storage.create({
      name: branchName,
      mode: sourceChat.mode as "conversation" | "roleplay" | "visual_novel",
      characterIds: (() => { try { return JSON.parse(sourceChat.characterIds as string); } catch { return []; } })(),
      groupId: sourceChat.groupId ?? null,
      personaId: sourceChat.personaId,
      promptPresetId: sourceChat.promptPresetId,
      connectionId: sourceChat.connectionId,
    });

    if (!newChat) return reply.status(500).send({ error: "Failed to create branch" });

    // Copy messages from source chat
    const msgs = await storage.listMessages(req.params.id);
    for (const msg of msgs) {
      await storage.createMessage({
        chatId: newChat.id,
        role: msg.role as "user" | "assistant" | "system" | "narrator",
        characterId: msg.characterId,
        content: msg.content,
      });
      // Stop if we hit the specified message
      if (upToMessageId && msg.id === upToMessageId) break;
    }

    return newChat;
  });
}
