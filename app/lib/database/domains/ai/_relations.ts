import { relations } from "drizzle-orm";
import { aiAssistants } from "./assistants";
import { aiModels } from "./models";
import { aiProviders } from "./providers";

export const aiProvidersRelations = relations(aiProviders, ({ many }) => ({
  models: many(aiModels, {
    relationName: "ai_providers__models",
  }),
}));

export const aiModelsRelations = relations(aiModels, ({ one }) => ({
  provider: one(aiProviders, {
    fields: [aiModels.providerId],
    references: [aiProviders.id],
    relationName: "ai_models__provider",
  }),
}));

export const aiAssistantsRelations = relations(aiAssistants, ({ one }) => ({
  model: one(aiModels, {
    fields: [aiAssistants.modelId],
    references: [aiModels.id],
    relationName: "ai_assistants__model",
  }),
}));
