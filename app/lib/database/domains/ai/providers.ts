import { index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createdAuditFields, generateUUID, softDeleteAuditFields, updatedAuditFields } from "../../db-helpers.server";

export const aiProviders = sqliteTable(
  "ai_providers",
  {
    id: text().primaryKey().$defaultFn(generateUUID),
    slug: text().notNull(), // Unique identifier, e.g., 'openai', 'anthropic', 'google-vertex'
    name: text().notNull(), // Human-readable name, e.g., 'OpenAI', 'Anthropic'
    description: text(),
    baseUrl: text(), // Base URL for the provider's API
    apiVersion: text(), // Optional API version string
    status: text({ enum: ["active", "inactive", "deprecated"] })
      .notNull()
      .default("active"),

    details: text({ mode: "json" }).$type<{
      authType?: "api_key" | "oauth" | "none"; // Authentication mechanism used by the provider
      credentialsSchema?: Record<string, unknown>; // JSON schema for required credentials
      headers?: Record<string, string>; // Common headers for all requests to this provider
      rateLimits?: Record<string, number>; // Rate limiting configuration, e.g., { "requestsPerMinute": 100, "tokensPerMinute": 60000 }

      azureOpenAIResourceName?: string; // Resource name for Azure OpenAI
    }>(),

    ...createdAuditFields,
    ...updatedAuditFields,
    ...softDeleteAuditFields,
  },
  (table) => [index("ai_providers__status__idx").on(table.status), unique("ai_providers__slug__unq").on(table.slug)],
);

export type SelectAiProvider = typeof aiProviders.$inferSelect;
export type InsertAiProvider = typeof aiProviders.$inferInsert;
