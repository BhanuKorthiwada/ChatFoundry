import { env as cfEnv } from "cloudflare:workers";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1, LanguageModelV1StreamPart, UIMessage } from "ai";
import {
  appendClientMessage,
  extractReasoningMiddleware,
  generateObject,
  generateText,
  streamText,
  wrapLanguageModel,
} from "ai";
import { eq } from "drizzle-orm";
import { type ActionFunctionArgs, data } from "react-router";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { Logger } from "~/.server/log-service";
import { ModelsService } from "~/.server/models-service";
import { SecretService } from "~/.server/secret-service";
import { AI_PROVIDER_CODES } from "~/lib/constants";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import { authApiMiddleware } from "~/lib/middlewares/api-auth-guard.server";

type message = {
  role: "system" | "user" | "assistant" | "data";
  content: string;
};

export interface RequestProps {
  message: UIMessage;
  id: string;
  modelId: string;
}

export const unstable_middleware = [authApiMiddleware];

export async function action(_: ActionFunctionArgs) {
  if (_.request.method === "DELETE") {
    // Handle DELETE requests for soft delete functionality
    if (!_.params.conversationId) {
      return data(
        {
          success: false,
          error: "Invalid conversation ID",
        },
        400,
      );
    }

    try {
      const authSession = _.context.get(authSessionContext);

      // Verify the conversation belongs to the user
      const conversation = await db.query.chatConversations.findFirst({
        where: (t, { and, eq }) => {
          return and(eq(t.id, _.params.conversationId!), eq(t.userId, authSession.user.id));
        },
        columns: {
          id: true,
        },
      });

      if (!conversation) {
        return data(
          {
            success: false,
            error: "Conversation not found",
          },
          404,
        );
      }

      // Soft delete the conversation
      await db
        .update(schema.chatConversations)
        .set({
          isDeleted: true,
          status: "deleted",
          updatedAt: new Date(),
        })
        .where(eq(schema.chatConversations.id, _.params.conversationId!));

      // Also soft delete all messages in the conversation
      await db
        .update(schema.chatMessages)
        .set({
          isDeleted: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.chatMessages.conversationId, _.params.conversationId!));

      return {
        success: true,
        message: "Conversation deleted successfully",
      };
    } catch (error) {
      Logger.error("[API] Error occurred while deleting conversation:", error);
      return {
        success: false,
        error: "Failed to delete conversation",
      };
    }
  }
  if (_.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!_.params.conversationId) {
    return data(
      {
        success: false,
        error: "Invalid conversation ID",
      },
      400,
    );
  }

  try {
    const authSession = _.context.get(authSessionContext);

    const conversation = await db.query.chatConversations.findFirst({
      where: (t, { and, eq }) => {
        return and(eq(t.id, _.params.conversationId!), eq(t.isDeleted, false), eq(t.userId, authSession.user.id));
      },
      columns: {
        id: true,
        title: true,
      },
    });

    if (!conversation) {
      return data(
        {
          success: false,
          error: "Invalid conversation ID",
        },
        404,
      );
    }

    const { message, id, modelId: selectedModelId } = await _.request.json<RequestProps>();
    const workersai = createWorkersAI({ binding: cfEnv.AI });

    const modelConfig = await db.query.aiModels.findFirst({
      where: (t, { and, eq }) => {
        return and(eq(t.id, selectedModelId), eq(t.isDeleted, false));
      },
      with: {
        provider: true,
      },
    });

    if (!modelConfig) {
      return data(
        {
          success: false,
          error: "Invalid model configuration",
        },
        400,
      );
    }

    Logger.info("Using model configuration:", {
      modelName: modelConfig.name,
      slug: modelConfig.slug,
      providerName: modelConfig.provider.name,
      providerSlug: modelConfig.provider.slug,
    });

    const previousMessages = await db.query.chatMessages.findMany({
      where: (t, { eq, and, ne }) => {
        return and(eq(t.conversationId, _.params.conversationId!), eq(t.isDeleted, false), ne(t.role, "tool"));
      },
      columns: {
        id: true,
        role: true,
        parts: true,
        createdAt: true,
        version: true,
      },
    });

    const messages = appendClientMessage({
      messages: previousMessages.map((m) => ({
        id: m.id,
        role: m.role === "tool" ? "assistant" : m.role,
        content: "",
        parts: m.parts,
        createdAt: m.createdAt || new Date(),
        annotations: [{ version: m.version }],
      })),
      message,
    });

    if (messages.length === 1 || conversation.title.startsWith("[Chat]")) {
      try {
        const systemPrompt =
          "You are a helpful assistant that can generate a title for the conversation based on the user's message(s).";

        const modelService = ModelsService.getInstance();
        const defaultModel = await modelService.getOpenAIModel({});

        const result = await generateObject({
          model: defaultModel,
          system: systemPrompt,
          messages: messages.slice(0, 4).map((m) => ({ role: m.role, content: m.content })),
          schema: z.object({
            title: z.string().min(5).max(50),
          }),
          maxTokens: 2048,
          maxRetries: 3,
        });

        await db
          .update(schema.chatConversations)
          .set({
            title: result.object.title,
            updatedAt: new Date(),
          })
          .where(eq(schema.chatConversations.id, conversation.id));
      } catch (error) {
        console.log("[ERROR] Error occurred while generating title:", error);
      }
    }

    await db.insert(schema.chatMessages).values({
      conversationId: conversation.id,
      role: "user",
      parts: message.parts,
      referenceId: message.id,
      status: "received",
    });

    const secretService = SecretService.getInstance();

    let modelSelected: LanguageModelV1 | undefined = undefined;

    if (modelConfig.provider.slug === AI_PROVIDER_CODES.openai) {
      const openaiKey = await secretService.getSecret("CHATFOUNDRY__PROVIDERS__OPENAI_API_KEY");
      const openai = createOpenAI({
        apiKey: openaiKey,
      });
      const openaiModel = openai.chat(modelConfig.slug);
      modelSelected = openaiModel;
      Logger.info("Using OpenAI model:", openaiModel.modelId);
    }

    if (modelConfig.provider.slug === AI_PROVIDER_CODES.azureOpenAI) {
      const azureKey = await secretService.getSecret("CHATFOUNDRY__PROVIDERS__AZURE_API_KEY");
      const azure = createAzure({
        resourceName: modelConfig.provider.details?.azureOpenAIResourceName || "chatfoundry",
        apiKey: azureKey,
        baseURL: `https://${modelConfig.provider.details?.azureOpenAIResourceName}.openai.azure.com/`,
      });
      const azureModel = azure.chat(modelConfig.slug);
      modelSelected = azureModel;
      Logger.info("Using Azure OpenAI model:", azureModel.modelId);
    }

    if (modelConfig.provider.slug === AI_PROVIDER_CODES.anthropic) {
      const anthropicKey = await secretService.getSecret("CHATFOUNDRY__PROVIDERS__ANTHROPIC_API_KEY");
      const anthropic = createAnthropic({
        apiKey: anthropicKey,
      });
      const anthropicModel = anthropic.languageModel(modelConfig.slug);
      modelSelected = anthropicModel;
      Logger.info("Using Anthropic model:", anthropicModel.modelId);
    }

    if (modelConfig.provider.slug === AI_PROVIDER_CODES.cloudflare) {
      const workersModel = workersai(modelConfig.slug as any);
      modelSelected = workersModel;
    }

    if (!modelSelected) {
      const workersModel = workersai("@cf/deepseek-ai/deepseek-r1-distill-qwen-32b");
      modelSelected = workersModel;
    }

    const userReasoning = _.request.headers.get("X-Reasoning") === "true";
    const modelReasoning = modelConfig.details?.hasReasoning || false;
    const handleReasoning = userReasoning && modelReasoning;
    const handleStream = _.request.headers.get("X-Stream") === "true";

    const aiModel = handleReasoning
      ? wrapLanguageModel({
        model: modelSelected,
        middleware: [
          extractReasoningMiddleware({ tagName: "think" }),
          //custom middleware to inject <think> tag at the beginning of a reasoning if it is missing
          {
            wrapGenerate: async ({ doGenerate }) => {
              const result = await doGenerate();

              if (!result.text?.includes("<think>")) {
                result.text = `<think>${result.text}`;
              }

              return result;
            },
            wrapStream: async ({ doStream }) => {
              const { stream, ...rest } = await doStream();

              let generatedText = "";
              const transformStream = new TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart>({
                transform(chunk, controller) {
                  //we are manually adding the <think> tag because some times, distills of reasoning models omit it
                  if (chunk.type === "text-delta") {
                    if (!generatedText.includes("<think>")) {
                      generatedText += "<think>";
                      controller.enqueue({
                        type: "text-delta",
                        textDelta: "<think>",
                      });
                    }
                    generatedText += chunk.textDelta;
                  }

                  controller.enqueue(chunk);
                },
              });

              return {
                stream: stream.pipeThrough(transformStream),
                ...rest,
              };
            },
          },
        ],
      })
      : modelSelected;

    const systemPrompt: message = {
      role: "system",
      content: `- Do not wrap your responses in html tags.
- Do not apply any formatting to your responses.
- You are an expert conversational chatbot. Your objective is to be as helpful as possible.
- You must keep your responses relevant to the user's prompt.
- You must respond with a maximum of 512 tokens (300 words).
- You must respond clearly and concisely, and explain your logic if required.
- You must not provide any personal information.
- Do not respond with your own personal opinions, and avoid topics unrelated to the user's prompt.

User info:
- Country: ${_.request.cf?.country}
- City: ${_.request.cf?.city}
- Timezone: ${_.request.cf?.timezone}
- UTC Time: ${new Date().toUTCString()}`,
    };

    if (handleStream) {
      const result = streamText({
        model: aiModel,
        messages: [systemPrompt, ...messages],
        maxTokens: 2048,
        maxRetries: 3,
        maxSteps: 2,
        onFinish: async (finishData) => {
          for (const message of finishData.response.messages) {
            await db.insert(schema.chatMessages).values({
              conversationId: conversation.id,
              role: message.role === "assistant" ? "assistant" : "tool",
              parts: message.content,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeleted: false,
              version: 1,
              status: "sent",
              referenceId: message.id,
              details: {
                usage: finishData.usage,
              },
            });
          }
        },
      });

      result.consumeStream();

      return result.toDataStreamResponse({
        sendReasoning: true,
      });
    }

    const { text } = await generateText({
      model: aiModel,
      messages: [systemPrompt, ...messages],
      maxTokens: 2048,
      maxRetries: 3,
    });

    return {
      success: true,
      text: text,
    };
  } catch (error) {
    Logger.error("[API] Error occurred while generating text:", error);
    return {
      success: false,
      error: "Failed to generate text",
    };
  }
}
