import { formatDistanceToNow } from "date-fns";
import { count, desc, eq } from "drizzle-orm";
import { CalendarIcon, MessageCircleIcon, MoreHorizontalIcon, StarIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Form, Link, data } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { AppInfo } from "~/lib/config";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/chat-history";

// Types
interface ConversationDetails {
  tags?: string[];
  pinnedMessageIds?: string[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

interface ConversationWithDetails {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "archived" | "deleted";
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  details: ConversationDetails | null;
  messageCount: number;
  assistant?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  model?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export const meta = () => {
  return [{ title: `Chat History - ${AppInfo.name}` }];
};

export async function loader(_: Route.LoaderArgs) {
  const authSession = _.context.get(authSessionContext);

  // Load conversations with related data
  const conversations = await db.query.chatConversations.findMany({
    where: eq(schema.chatConversations.userId, authSession.user.id),
    with: {
      assistant: {
        columns: {
          id: true,
          name: true,
          description: true,
        },
      },
      model: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    columns: {
      id: true,
      title: true,
      description: true,
      status: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      details: true,
    },
    orderBy: [desc(schema.chatConversations.lastMessageAt), desc(schema.chatConversations.createdAt)],
    limit: 50, // Limit to recent conversations
  });

  // Get message counts for each conversation
  const conversationIds = conversations.map((conv) => conv.id);
  const messageCounts =
    conversationIds.length > 0
      ? await db
          .select({
            conversationId: schema.chatMessages.conversationId,
            count: count(schema.chatMessages.id),
          })
          .from(schema.chatMessages)
          .where(eq(schema.chatMessages.isDeleted, false))
          .groupBy(schema.chatMessages.conversationId)
      : [];

  // Create a map for quick lookup
  const messageCountMap = messageCounts.reduce(
    (acc, item) => {
      acc[item.conversationId] = item.count;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    conversations: conversations.map((conv) => ({
      ...conv,
      messageCount: messageCountMap[conv.id] || 0,
    })),
  };
}

export async function action(_: Route.ActionArgs) {
  const authSession = _.context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await _.request.formData();
  const intent = formData.get("intent") as string;
  const conversationId = formData.get("conversationId") as string;

  if (!conversationId) {
    return data({ error: "Conversation ID is required" }, { status: 400 });
  }

  try {
    switch (intent) {
      case "delete": {
        // Soft delete the conversation
        await db
          .update(schema.chatConversations)
          .set({
            isDeleted: true,
            updatedAt: new Date(),
            updatedBy: authSession.user.id,
          })
          .where(eq(schema.chatConversations.id, conversationId));

        return data({ success: true, message: "Conversation deleted successfully" });
      }

      case "archive": {
        // Archive the conversation
        await db
          .update(schema.chatConversations)
          .set({
            status: "archived",
            updatedAt: new Date(),
            updatedBy: authSession.user.id,
          })
          .where(eq(schema.chatConversations.id, conversationId));

        return data({ success: true, message: "Conversation archived successfully" });
      }

      default:
        return data({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error performing action:", error);
    return data({ error: "Failed to perform action" }, { status: 500 });
  }
}

function ConversationCard({
  conversation,
}: {
  conversation: ConversationWithDetails;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "archived":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "deleted":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "public":
        return "🌐";
      case "shared":
        return "👥";
      case "internal":
        return "🏢";
      default:
        return "🔒";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "No messages yet";
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <Card className="group transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate font-semibold text-lg">
              <Link to={`/ai/chat/${conversation.id}`} className="transition-colors hover:text-primary">
                {conversation.title || "Untitled Conversation"}
              </Link>
            </CardTitle>
            {conversation.description && (
              <CardDescription className="mt-1 line-clamp-2">{conversation.description}</CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 transition-opacity group-hover:opacity-100">
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/ai/chat/${conversation.id}`}>
                  <MessageCircleIcon className="mr-2 h-4 w-4" />
                  Open Chat
                </Link>
              </DropdownMenuItem>
              <Form method="post">
                <input type="hidden" name="conversationId" value={conversation.id} />
                <input type="hidden" name="intent" value="archive" />
                <DropdownMenuItem asChild>
                  <button type="submit" className="flex w-full items-center">
                    <StarIcon className="mr-2 h-4 w-4" />
                    Archive
                  </button>
                </DropdownMenuItem>
              </Form>
              <Form method="post">
                <input type="hidden" name="conversationId" value={conversation.id} />
                <input type="hidden" name="intent" value="delete" />
                <DropdownMenuItem asChild>
                  <button type="submit" className="flex w-full items-center text-destructive">
                    <TrashIcon className="mr-2 h-4 w-4" />
                    Delete
                  </button>
                </DropdownMenuItem>
              </Form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-muted-foreground text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <MessageCircleIcon className="h-3 w-3" />
              <span>{conversation.messageCount} messages</span>
            </div>

            <div className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              <span>{formatDate(conversation.lastMessageAt || conversation.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span title={`Visibility: ${conversation.visibility}`}>{getVisibilityIcon(conversation.visibility)}</span>

            <Badge variant="outline" className={`text-xs ${getStatusColor(conversation.status)}`}>
              {conversation.status}
            </Badge>
          </div>
        </div>

        {/* Model and Assistant Info */}
        {(conversation.model || conversation.assistant) && (
          <div className="mt-3 flex items-center gap-4 text-muted-foreground text-xs">
            {conversation.model && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Model:</span>
                <span>{conversation.model.name}</span>
              </div>
            )}

            {conversation.assistant && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Assistant:</span>
                <span>{conversation.assistant.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {conversation.details?.tags && conversation.details.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {conversation.details.tags.slice(0, 3).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {conversation.details.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{conversation.details.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HistoryRoute(_: Route.ComponentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter conversations based on search
  const filteredConversations = _.loaderData.conversations.filter(
    (conv: ConversationWithDetails) =>
      conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.assistant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.model?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Group conversations by status
  const activeConversations = filteredConversations.filter((conv: ConversationWithDetails) => conv.status === "active");
  const archivedConversations = filteredConversations.filter(
    (conv: ConversationWithDetails) => conv.status === "archived",
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Chat History</h1>
        <p className="text-muted-foreground">Browse and manage your conversation history with AI assistants.</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>
          <Link to="/chat?new=true">
            <Button>
              <MessageCircleIcon className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="font-bold text-2xl">{activeConversations.length}</div>
            <p className="text-muted-foreground text-sm">Active Conversations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="font-bold text-2xl">{archivedConversations.length}</div>
            <p className="text-muted-foreground text-sm">Archived Conversations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="font-bold text-2xl">
              {_.loaderData.conversations.reduce(
                (sum: number, conv: ConversationWithDetails) => sum + conv.messageCount,
                0,
              )}
            </div>
            <p className="text-muted-foreground text-sm">Total Messages</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <div className="py-12 text-center">
          <MessageCircleIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 font-semibold text-lg">
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </h3>
          <p className="mb-4 text-muted-foreground">
            {searchQuery
              ? "Try adjusting your search terms or clear the search to see all conversations."
              : "Start your first conversation with an AI assistant to see it here."}
          </p>
          {!searchQuery && (
            <Link to="/ai/chat/new">
              <Button>
                <MessageCircleIcon className="mr-2 h-4 w-4" />
                Start First Chat
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Conversations */}
          {activeConversations.length > 0 && (
            <section>
              {" "}
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Active Conversations ({activeConversations.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeConversations.map((conversation: ConversationWithDetails) => (
                  <ConversationCard key={conversation.id} conversation={conversation} />
                ))}
              </div>
            </section>
          )}

          {/* Archived Conversations */}
          {archivedConversations.length > 0 && (
            <section>
              {" "}
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                Archived Conversations ({archivedConversations.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedConversations.map((conversation: ConversationWithDetails) => (
                  <ConversationCard key={conversation.id} conversation={conversation} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
