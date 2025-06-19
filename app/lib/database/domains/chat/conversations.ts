import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAuditFields, generateUUID, softDeleteAuditFields, updatedAuditFields } from "../../db-helpers.server";
import { user } from "../../schema-identity";
import { aiAssistants } from "../ai/assistants";
import { aiModels } from "../ai/models";

export const chatConversations = sqliteTable(
  "chat_conversations",
  {
    id: text().primaryKey().$defaultFn(generateUUID),
    title: text().notNull(),
    description: text(),
    assistantId: text().references(() => aiAssistants.id, { onDelete: "cascade" }),
    userId: text().references(() => user.id),
    modelId: text().references(() => aiModels.id),

    status: text({
      enum: ["active", "archived", "deleted"],
    })
      .notNull()
      .default("active"),

    history: text({
      enum: ["instant", "session", "persistent"],
    })
      .notNull()
      .default("persistent"),

    visibility: text({
      enum: ["public", "private", "internal", "shared"],
    })
      .notNull()
      .default("private"),

    details: text({ mode: "json" }).$type<{
      tags?: string[];
      pinnedMessageIds?: string[];
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    }>(),

    ...createdAuditFields,
    ...updatedAuditFields,
    ...softDeleteAuditFields,
    lastMessageAt: integer({ mode: "timestamp_ms" }),
  },
  (table) => [
    index("chat_conversations__assistant_id__idx").on(table.assistantId),
    index("chat_conversations__user_id__idx").on(table.userId),
    index("chat_conversations__status__idx").on(table.status),
    index("chat_conversations__visibility__idx").on(table.visibility),
    index("chat_conversations__created_at__idx").on(table.createdAt),
    index("chat_conversations__last_message_at__idx").on(table.lastMessageAt),
  ],
);

export type SelectChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;
