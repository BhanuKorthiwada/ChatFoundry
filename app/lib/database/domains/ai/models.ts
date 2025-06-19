import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createdAuditFields, generateUUID, softDeleteAuditFields, updatedAuditFields } from "../../db-helpers.server";
import { aiProviders } from "./providers"; // Import model providers for relation & shared status enum

export const aiModels = sqliteTable(
  "ai_models",
  {
    id: text().primaryKey().$defaultFn(generateUUID),
    slug: text().notNull(), // model slug, e.g., 'gpt-4-0125-preview', 'claude-3-opus'
    name: text().notNull(), // User-friendly display name, e.g., 'GPT-4 Turbo Preview', 'Claude 3 Opus'
    description: text(),
    version: text(), // Model version, if applicable
    aliases: text({ mode: "json" }).$type<Array<string>>().default(sql`'[]'`),
    providerId: text()
      .notNull()
      .references(() => aiProviders.id, { onDelete: "cascade" }),

    inputModalities: text({ mode: "json" })
      .$type<
        Array<"text" | "image" | "audio" | "video"> // Types of input the model can process
      >()
      .default(sql`'[]'`),
    outputModalities: text({ mode: "json" })
      .$type<
        Array<"text" | "json" | "image" | "audio"> // Types of output the model can generate
      >()
      .default(sql`'[]'`),
    isPreviewModel: integer({ mode: "boolean" }).notNull().default(false), // Indicates if the model is a preview version
    isPremiumModel: integer({ mode: "boolean" }).notNull().default(false), // Indicates if the model is a premium/paid tier
    maxInputTokens: integer(), // Max total tokens (input + output) or context length
    maxOutputTokens: integer(), // Max output tokens the model can generate
    documentationLink: text(), // Optional URL to the model's official documentation
    details: text({ mode: "json" }).$type<{
      hasReasoning?: boolean;

      supportsStreaming?: boolean; // Whether the model supports streaming responses
      supportsToolCalling?: boolean; // Whether the model can call external tools
      maxEmbeddingDimensions?: number; // Maximum dimensions for embedding vectors

      pricePerInput1kTokens?: number; // Cost for 1000 input tokens
      pricePerOutput1kTokens?: number; // Cost for 1000 output tokens (typically higher than input)
      pricePerEmbedding1kTokens?: number; // Cost for 1000 tokens when generating embeddings
      pricePerImage?: number; // Cost per generated image (for image generation models)
      pricePerSecondAudio?: number; // Cost per second of audio (for speech/transcription)

      // OpenAI specific capabilities
      openai?: {
        logitBias?: Record<string, number>;
        logprobs?: boolean | number;
        parallelToolCalls?: boolean;
        userIdentifier?: string; // Maps to OpenAI 'user' field
        reasoningEffort?: "low" | "medium" | "high";
      };
      // Anthropic specific capabilities
      anthropic?: {
        topK?: number;
      };
      // Add other provider-specific capabilities as needed
    }>(),
    status: text({ enum: ["active", "inactive", "deprecated"] })
      .notNull()
      .default("active"),

    ...createdAuditFields,
    ...updatedAuditFields,
    ...softDeleteAuditFields,
  },
  (table) => [
    index("ai_models__provider_id__idx").on(table.providerId),
    index("ai_models__status__idx").on(table.status),
    unique("ai_models__slug__unq").on(table.slug),
  ],
);

/**
 * Type exports for model details
 */
export type SelectAiModel = typeof aiModels.$inferSelect;
export type InsertAiModel = typeof aiModels.$inferInsert;
