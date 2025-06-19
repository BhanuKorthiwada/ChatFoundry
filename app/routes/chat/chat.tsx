import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { format } from "date-fns";
import { BanIcon, BubblesIcon, ChevronDownIcon, MessageCircleMoreIcon, RefreshCwIcon } from "lucide-react";
import { SendIcon } from "lucide-react";
import { type KeyboardEventHandler, useRef } from "react";
import { useState } from "react";
import { redirect } from "react-router";
import { toast } from "sonner";
import { Spinner } from "~/components/spinner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import {
  AIInput,
  AIInputModelSelect,
  AIInputModelSelectContent,
  AIInputModelSelectItem,
  AIInputModelSelectTrigger,
  AIInputModelSelectValue,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "~/components/ui/kibo-ui/ai/input";
import { AIMessage, AIMessageContent } from "~/components/ui/kibo-ui/ai/message";
import { AIResponse } from "~/components/ui/kibo-ui/ai/response";
import { AISuggestion, AISuggestions } from "~/components/ui/kibo-ui/ai/suggestion";
import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { useIsSubmitting } from "~/hooks/use-is-submitting";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/chat";

export async function loader(_: Route.LoaderArgs) {
  const url = new URL(_.request.url);
  const createNewConversation = url.searchParams.get("new");
  const { conversationId } = _.params;
  const authSession = _.context.get(authSessionContext);

  if (createNewConversation) {
    const newConversation = await db
      .insert(schema.chatConversations)
      .values({
        title: `[Chat] ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`,
        userId: authSession.user.id,
        createdBy: authSession.user.id,
      })
      .returning({
        id: schema.chatConversations.id,
      });

    throw redirect(`/chat/${newConversation[0]?.id}`);
  }

  if (!conversationId) {
    const existingConversations = await db.query.chatConversations.findMany({
      where: (conversation, { eq, and }) =>
        and(eq(conversation.userId, authSession.user.id), eq(conversation.status, "active")),
      orderBy: (conversation, { desc }) => desc(conversation.updatedAt),
      limit: 1,
    });

    if (existingConversations.length > 0) {
      const latestConversation = existingConversations[0];
      if (latestConversation) {
        throw redirect(`/chat/${latestConversation.id}`);
      }
    }

    const newConversation = await db
      .insert(schema.chatConversations)
      .values({
        title: `[Chat] ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`,
        userId: authSession.user.id,
        createdBy: authSession.user.id,
      })
      .returning({
        id: schema.chatConversations.id,
      });

    throw redirect(`/chat/${newConversation[0]?.id}`);
  }

  const conversation = await db.query.chatConversations.findFirst({
    where: (t, { eq }) => {
      return eq(t.id, conversationId);
    },
    columns: {
      id: true,
      title: true,
    },
  });

  if (!conversation) {
    const newConversation = await db
      .insert(schema.chatConversations)
      .values({
        title: `[Chat] ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`,
        userId: authSession.user.id,
        createdBy: authSession.user.id,
      })
      .returning({
        id: schema.chatConversations.id,
      });

    throw redirect(`/chat/${newConversation[0]?.id}`);
  }

  const dbMessages = await db.query.chatMessages.findMany({
    where: (t, { eq, and }) => {
      return and(eq(t.conversationId, conversationId), eq(t.isDeleted, false));
    },
    columns: {
      id: true,
      role: true,
      parts: true,
      createdAt: true,
    },
  });

  const messages: UIMessage[] = dbMessages.map((m) => ({
    id: m.id,
    role: m.role === "tool" ? "assistant" : m.role,
    content: "",
    type: "text",
    parts: m.parts,
    createdAt: m.createdAt || new Date(),
  }));

  const models = await db.query.aiModels.findMany({
    where: (t, { eq }) => {
      return eq(t.isDeleted, false);
    },
    columns: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return {
    conversation,
    messages,
    models,
  };
}

export default function Chat(_: Route.ComponentProps) {
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [submitOnEnter, setSubmitOnEnter] = useState(true);
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [modelId, setModelId] = useState<string | undefined>(_.loaderData.models[0]?.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmitting = useIsSubmitting();
  const [suggestions, setSuggestions] = useState<string[]>(["Motivate me today", "Tell me a joke", "What is AI?"]);

  const handleKeyPress: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey && submitOnEnter) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const { messages, setMessages, input, setInput, handleInputChange, handleSubmit, stop, error, reload, status } =
    useChat({
      id: _.params.conversationId,
      api: `/api/chat/${_.params.conversationId}`,
      headers: {
        "X-Stream": streamEnabled.toString(),
        "X-Reasoning": reasoningEnabled.toString(),
      },
      body: {
        t: new Date().toISOString(),
        modelId: modelId,
      },
      initialMessages: _.loaderData.messages,
      streamProtocol: streamEnabled ? "data" : "text",
      generateId: () => crypto.randomUUID(),
      experimental_prepareRequestBody: ({ messages, id }) => {
        return { message: messages[messages.length - 1], id, modelId: modelId };
      },
      onResponse: (response: Response) => {
        if (!response.ok) {
          console.error("Error from API:", response.statusText);
          toast.error("Connection Error", {
            description: "Failed to connect to the AI service. Please try again later.",
          });
        }
      },
      onFinish: () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

        setTimeout(() => textareaRef.current?.focus(), 100);

        setSuggestions(["What is this?", "What is the source?", "Who are you?", "What is your name?"]);
      },

      onError: (error: any) => {
        console.error("Chat error:", error);
        toast.error("Response Error", {
          description: "Something went wrong. Please try again.",
        });
      },
      credentials: "same-origin",
    });

  return (
    <div className="flex h-full w-full flex-col">
      <title>Chat {_.loaderData.conversation.title}</title>

      {/* Messages Container - Scrollable */}
      <div className="flex-1 overflow-y-auto p-2 sm:px-8">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-8">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-4">
                  <MessageCircleMoreIcon className="h-8 w-8 text-white" />
                </div>
                <h1 className="mb-2 font-bold text-2xl text-gray-900 dark:text-gray-100">
                  What would you like to know?
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Start a conversation with your AI assistant. Ask questions, get creative, or just have a chat!
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: "💡", title: "Get Ideas", description: "Brainstorm creative solutions" },
                  { icon: "📚", title: "Learn Something", description: "Explore new topics and concepts" },
                  { icon: "✍️", title: "Write Content", description: "Create stories, emails, or documents" },
                  { icon: "🔍", title: "Research", description: "Get insights and analysis" },
                  { icon: "💻", title: "Code Help", description: "Debug and write code" },
                  { icon: "🎯", title: "Problem Solve", description: "Work through challenges" },
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setInput(`Help me ${item.title.toLowerCase()}`)}
                    className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <div className="mb-2 text-2xl">{item.icon}</div>
                    <h3 className="mb-1 font-medium text-gray-900 dark:text-gray-100">{item.title}</h3>
                    <p className="text-gray-600 text-sm dark:text-gray-400">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            return (
              <AIMessage key={message.id} from={message.role === "user" ? "user" : "assistant"}>
                <AIMessageContent>
                  {message.parts.map((part, index) => {
                    const { type } = part;
                    const key = `message-${message.id}-part-${index}`;

                    if (type === "reasoning") {
                      return (
                        <div key={key} className="mb-4">
                          <Collapsible defaultOpen={false}>
                            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-left transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                                <Badge
                                  variant="secondary"
                                  className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                >
                                  Reasoning
                                </Badge>
                                <span className="font-medium text-amber-800 dark:text-amber-200">
                                  {status === "streaming" ? (
                                    <span className="animate-pulse">AI is thinking...</span>
                                  ) : (
                                    "AI thoughts..."
                                  )}
                                </span>
                              </div>
                              <ChevronDownIcon className="h-4 w-4 ui-open:rotate-180 transition-transform" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <AIResponse>{part.reasoning}</AIResponse>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      );
                    }

                    if (type === "text") {
                      return <AIResponse key={key}>{part.text}</AIResponse>;
                    }

                    if (type === "tool-invocation") {
                      return (
                        <div key={key} className="mb-2">
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            🔧 Tool: {part.toolInvocation.toolName}
                          </Badge>
                        </div>
                      );
                    }
                  })}
                </AIMessageContent>
              </AIMessage>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-0 w-0" />
      </div>

      {/* Message Actions - Fixed above input */}
      <div>
        {(status === "submitted" || status === "streaming") && (
          <div className="flex justify-center p-1">
            <div className="flex items-center gap-2">
              {status === "submitted" && <Spinner className="h-5 w-5" />}
              <Button variant="outline" size="sm" onClick={() => stop()}>
                <BanIcon /> Stop
              </Button>
            </div>
          </div>
        )}

        {(status === "ready" || status === "error") && messages.length > 0 && (
          <div className="flex justify-center p-1">
            <Button variant="outline" size="sm" onClick={() => reload()}>
              <RefreshCwIcon /> Regenerate
            </Button>
          </div>
        )}
      </div>

      {/* Input Container - Fixed at Bottom */}
      <div className="shrink-0 p-2">
        <div className="grid gap-1">
          <AISuggestions>
            {suggestions.map((suggestion) => (
              <AISuggestion key={suggestion} suggestion={suggestion} onClick={() => setInput(suggestion)} />
            ))}
          </AISuggestions>
          <AIInput
            onSubmit={(e) =>
              handleSubmit(e, {
                body: {
                  c: "test",
                },
              })
            }
            className="w-full"
          >
            <AIInputTextarea
              ref={textareaRef}
              name="messageContent"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              disabled={isSubmitting || status === "streaming"}
              placeholder={
                status === "streaming"
                  ? "AI is responding..."
                  : "Type your message... (Enter to send, Shift+Enter for new line)"
              }
            />
            <AIInputToolbar>
              <AIInputTools>
                <AIInputModelSelect value={modelId} onValueChange={setModelId}>
                  <AIInputModelSelectTrigger>
                    <AIInputModelSelectValue />
                  </AIInputModelSelectTrigger>
                  <AIInputModelSelectContent>
                    {_.loaderData.models.map((model) => (
                      <AIInputModelSelectItem key={model.id} value={model.id}>
                        <BubblesIcon size={16} className="inline-flex size-4" />
                        {model.name}
                      </AIInputModelSelectItem>
                    ))}
                  </AIInputModelSelectContent>
                </AIInputModelSelect>

                <Tooltip>
                  <TooltipTrigger>
                    <Toggle id="stream-toggle" pressed={streamEnabled} onPressedChange={setStreamEnabled}>
                      Stream
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Enable or disable streaming</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <Toggle id="submit-toggle" pressed={submitOnEnter} onPressedChange={setSubmitOnEnter}>
                      Enter
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Submit on Enter key press</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <Toggle id="reasoning-toggle" pressed={reasoningEnabled} onPressedChange={setReasoningEnabled}>
                      Reasoning
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Enable or disable reasoning</TooltipContent>
                </Tooltip>
              </AIInputTools>
              <AIInputSubmit>
                <SendIcon size={16} />
              </AIInputSubmit>
            </AIInputToolbar>
          </AIInput>
        </div>
      </div>
    </div>
  );
}
