import { index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { generateUUID } from "../../db-helpers.server";
import { createdAuditFields, softDeleteAuditFields, updatedAuditFields } from "../../db-helpers.server";
import { aiModels } from "./models";

export const aiAssistants = sqliteTable(
  "ai_assistants",
  {
    id: text().primaryKey().$defaultFn(generateUUID),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    initMessages: text({ mode: "json" }).$type<Record<string, unknown>>(),

    status: text({
      enum: ["active", "inactive", "deleted"],
    })
      .notNull()
      .default("active"),

    mode: text({
      enum: ["instant", "session", "persistent"],
    })
      .notNull()
      .default("instant"),

    visibility: text({
      enum: ["public", "private", "shared"],
    })
      .notNull()
      .default("private"),

    scope: text({
      enum: ["global", "team", "user"],
    })
      .notNull()
      .default("user"),

    details: text({ mode: "json" }).$type<{
      tags?: string[];
      supportsRAG?: boolean;
    }>(),

    modelId: text()
      .notNull()
      .references(() => aiModels.id),
    ...createdAuditFields,
    ...updatedAuditFields,
    ...softDeleteAuditFields,
  },
  (table) => [
    index("ai_assistants__slug__idx").on(table.slug),
    index("ai_assistants__model_id__idx").on(table.modelId),
    index("ai_assistants__scope__idx").on(table.scope),
    index("ai_assistants__status__idx").on(table.status),
    unique("ai_assistants__slug__unq").on(table.slug),
  ],
);

export type SelectAiAssistant = typeof aiAssistants.$inferSelect;
export type InsertAiAssistant = typeof aiAssistants.$inferInsert;
