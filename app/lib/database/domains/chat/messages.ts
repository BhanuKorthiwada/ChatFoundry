import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAuditFields, generateUUID, softDeleteAuditFields, updatedAuditFields } from "../../db-helpers.server";
import { user } from "../../schema-identity";
import { chatConversations } from "./conversations";

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text().primaryKey().$defaultFn(generateUUID),
    conversationId: text()
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    role: text({ enum: ["user", "assistant", "system", "data", "tool"] }).notNull(),
    parts: text({ mode: "json" }).$type<any>(), // { text: string; type: "text" | "image" }[]
    attachments: text({ mode: "json" }).$type<any>(),
    status: text({ enum: ["received", "draft", "sent", "delivered", "failed"] })
      .notNull()
      .default("received"),
    referenceId: text(),
    details: text({ mode: "json" }).$type<{
      tokens?: {
        prompt?: number;
        completion?: number;
        total?: number;
      };
      model?: string;
      rating?: "helpful" | "unhelpful";
      feedback?: string;
      citations?: Array<{
        sourceId: string;
        start: number;
        end: number;
        text: string;
      }>;
      usage?: any;
    }>(),

    userId: text().references(() => user.id),
    version: integer().notNull().default(0),
    ...createdAuditFields,
    ...updatedAuditFields,
    ...softDeleteAuditFields,
  },
  (table) => [
    index("chat_messages__conversation_id__idx").on(table.conversationId),
    index("chat_messages__role__idx").on(table.role),
    index("chat_messages__reference_id__idx").on(table.referenceId),
  ],
);

export type SelectChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
