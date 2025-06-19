import { relations } from "drizzle-orm";
import { user } from "../../schema-identity";
import { aiAssistants } from "../ai/assistants";
import { aiModels } from "../ai/models";
import { chatConversations } from "./conversations";
import { chatMessages } from "./messages";

/**
 * Chat assistants relations with other entities
 */
export const chatAssistantsRelations = relations(aiAssistants, ({ one, many }) => ({
  model: one(aiModels, {
    fields: [aiAssistants.modelId],
    references: [aiModels.id],
  }),
  creator: one(user, {
    fields: [aiAssistants.createdBy],
    references: [user.id],
  }),
  modifier: one(user, {
    fields: [aiAssistants.updatedBy],
    references: [user.id],
  }),
  deleter: one(user, {
    fields: [aiAssistants.deletedBy],
    references: [user.id],
  }),
  conversations: many(chatConversations),
}));

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  assistant: one(aiAssistants, {
    fields: [chatConversations.assistantId],
    references: [aiAssistants.id],
  }),
  user: one(user, {
    fields: [chatConversations.userId],
    references: [user.id],
  }),
  model: one(aiModels, {
    fields: [chatConversations.modelId],
    references: [aiModels.id],
  }),
  creator: one(user, {
    fields: [chatConversations.createdBy],
    references: [user.id],
  }),
  modifier: one(user, {
    fields: [chatConversations.updatedBy],
    references: [user.id],
  }),
  deleter: one(user, {
    fields: [chatConversations.deletedBy],
    references: [user.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
  user: one(user, {
    fields: [chatMessages.userId],
    references: [user.id],
  }),
  creator: one(user, {
    fields: [chatMessages.createdBy],
    references: [user.id],
  }),
  modifier: one(user, {
    fields: [chatMessages.updatedBy],
    references: [user.id],
  }),
  deleter: one(user, {
    fields: [chatMessages.deletedBy],
    references: [user.id],
  }),
  deletedByUser: one(user, {
    fields: [chatMessages.deletedBy],
    references: [user.id],
    relationName: "deleted_by_user_messages",
  }),
}));
