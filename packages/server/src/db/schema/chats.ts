// ──────────────────────────────────────────────
// Schema: Chats & Messages
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode", { enum: ["conversation", "roleplay", "visual_novel"] }).notNull(),
  /** JSON array of character IDs */
  characterIds: text("character_ids").notNull().default("[]"),
  /** Groups related chats together (like ST "chat files" per character) */
  groupId: text("group_id"),
  personaId: text("persona_id"),
  promptPresetId: text("prompt_preset_id"),
  connectionId: text("connection_id"),
  /** JSON object for metadata */
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system", "narrator"] }).notNull(),
  characterId: text("character_id"),
  content: text("content").notNull().default(""),
  activeSwipeIndex: integer("active_swipe_index").notNull().default(0),
  /** JSON object for extra data */
  extra: text("extra").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const messageSwipes = sqliteTable("message_swipes", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  content: text("content").notNull().default(""),
  /** JSON object for extra data */
  extra: text("extra").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});
