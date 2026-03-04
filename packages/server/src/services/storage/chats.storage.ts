// ──────────────────────────────────────────────
// Storage: Chats
// ──────────────────────────────────────────────
import { eq, desc } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { chats, messages, messageSwipes } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type { CreateChatInput, CreateMessageInput } from "@rpg-engine/shared";

export function createChatsStorage(db: DB) {
  return {
    async list() {
      return db.select().from(chats).orderBy(desc(chats.updatedAt));
    },

    async getById(id: string) {
      const rows = await db.select().from(chats).where(eq(chats.id, id));
      return rows[0] ?? null;
    },

    async create(input: CreateChatInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(chats).values({
        id,
        name: input.name,
        mode: input.mode,
        characterIds: JSON.stringify(input.characterIds),
        groupId: input.groupId ?? null,
        personaId: input.personaId,
        promptPresetId: input.promptPresetId,
        connectionId: input.connectionId,
        metadata: JSON.stringify({ summary: null, tags: [], agentsEnabled: true, agentOverrides: {} }),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: Partial<CreateChatInput>) {
      await db
        .update(chats)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.mode !== undefined && { mode: data.mode }),
          ...(data.characterIds !== undefined && { characterIds: JSON.stringify(data.characterIds) }),
          ...(data.groupId !== undefined && { groupId: data.groupId }),
          ...(data.personaId !== undefined && { personaId: data.personaId }),
          ...(data.promptPresetId !== undefined && { promptPresetId: data.promptPresetId }),
          ...(data.connectionId !== undefined && { connectionId: data.connectionId }),
          updatedAt: now(),
        })
        .where(eq(chats.id, id));
      return this.getById(id);
    },

    /** List all chats belonging to a group. */
    async listByGroup(groupId: string) {
      return db.select().from(chats).where(eq(chats.groupId, groupId)).orderBy(desc(chats.updatedAt));
    },

    async updateMetadata(id: string, metadata: Record<string, unknown>) {
      await db
        .update(chats)
        .set({ metadata: JSON.stringify(metadata), updatedAt: now() })
        .where(eq(chats.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(chats).where(eq(chats.id, id));
    },

    // ── Messages ──

    async listMessages(chatId: string) {
      return db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt);
    },

    async getMessage(id: string) {
      const rows = await db.select().from(messages).where(eq(messages.id, id));
      return rows[0] ?? null;
    },

    async createMessage(input: CreateMessageInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(messages).values({
        id,
        chatId: input.chatId,
        role: input.role,
        characterId: input.characterId,
        content: input.content,
        activeSwipeIndex: 0,
        extra: JSON.stringify({ displayText: null, isGenerated: input.role !== "user", tokenCount: null, generationInfo: null }),
        createdAt: timestamp,
      });
      // Create the initial swipe (index 0)
      await db.insert(messageSwipes).values({
        id: newId(),
        messageId: id,
        index: 0,
        content: input.content,
        extra: JSON.stringify({}),
        createdAt: timestamp,
      });
      // Update chat's updatedAt
      await db.update(chats).set({ updatedAt: timestamp }).where(eq(chats.id, input.chatId));
      return this.getMessage(id);
    },

    async updateMessageContent(id: string, content: string) {
      await db.update(messages).set({ content }).where(eq(messages.id, id));
      return this.getMessage(id);
    },

    async removeMessage(id: string) {
      await db.delete(messages).where(eq(messages.id, id));
    },

    async getSwipes(messageId: string) {
      return db.select().from(messageSwipes).where(eq(messageSwipes.messageId, messageId)).orderBy(messageSwipes.index);
    },

    async addSwipe(messageId: string, content: string) {
      const existing = await this.getSwipes(messageId);
      const nextIndex = existing.length;
      const id = newId();
      await db.insert(messageSwipes).values({
        id,
        messageId,
        index: nextIndex,
        content,
        extra: JSON.stringify({}),
        createdAt: now(),
      });
      // Set active swipe to the new one
      await db.update(messages).set({ activeSwipeIndex: nextIndex, content }).where(eq(messages.id, messageId));
      return { id, index: nextIndex };
    },

    async setActiveSwipe(messageId: string, index: number) {
      const swipes = await this.getSwipes(messageId);
      const target = swipes.find((s: any) => s.index === index);
      if (!target) return null;
      await db.update(messages).set({ activeSwipeIndex: index, content: target.content }).where(eq(messages.id, messageId));
      return this.getMessage(messageId);
    },
  };
}
