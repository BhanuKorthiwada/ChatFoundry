import { Outlet } from "react-router";

import { AiLayout } from "~/components/ai/ai-layout";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import type { Route } from "./+types/layout";

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    return { conversations: [], conversationTitle: undefined, breadcrumbs: [] };
  }

  const conversations = await db.query.chatConversations.findMany({
    where: (conversation, { eq, and }) =>
      and(eq(conversation.userId, authSession.user.id), eq(conversation.status, "active")),
    with: {
      assistant: true,
    },
    orderBy: (conversation, { desc }) => desc(conversation.updatedAt),
    limit: 20,
  });

  // Get current conversation title if we're viewing a specific conversation
  let conversationTitle: string | undefined = undefined;
  if (params.conversationId) {
    const currentConversation = await db.query.chatConversations.findFirst({
      where: (conversation, { eq, and }) =>
        and(
          eq(conversation.id, params.conversationId!),
          eq(conversation.userId, authSession.user.id),
          eq(conversation.status, "active"),
        ),
      columns: {
        title: true,
      },
    });
    conversationTitle = currentConversation?.title;
  }

  // Generate breadcrumbs based on current path
  // TODO: Refactor this to useMatches
  const url = new URL(request.url);
  const pathname = url.pathname;

  let breadcrumbs = [];

  if (pathname.startsWith("/model")) {
    breadcrumbs = [
      { label: "AI", href: "/chat" },
      { label: "Models", isCurrentPage: true },
    ];
  } else if (pathname.startsWith("/provider")) {
    breadcrumbs = [
      { label: "AI", href: "/chat" },
      { label: "Providers", isCurrentPage: true },
    ];
  } else if (pathname.startsWith("/thread")) {
    breadcrumbs = [
      { label: "Chat", href: "/chat" },
      { label: "All Conversations", isCurrentPage: true },
    ];
  } else {
    // Default to chat breadcrumbs
    breadcrumbs = [
      { label: "Chat", href: "/chat" },
      { label: conversationTitle || "", isCurrentPage: true },
    ];
  }

  return { conversations, conversationTitle, breadcrumbs };
}

export default function Layout(_: Route.ComponentProps) {
  return (
    <AiLayout
      conversations={_.loaderData.conversations}
      conversationTitle={_.loaderData.conversationTitle}
      breadcrumbs={_.loaderData.breadcrumbs}
    >
      <Outlet />
    </AiLayout>
  );
}
