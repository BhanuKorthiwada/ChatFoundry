"use client";

import {
  BotMessageSquareIcon,
  BrainCircuitIcon,
  BrainIcon,
  MessageSquareMoreIcon,
  MessagesSquareIcon,
  Settings2,
} from "lucide-react";
import type * as React from "react";

import { NavConversations } from "~/components/ai/sidebar/nav-conversations";
import { NavMain } from "~/components/ai/sidebar/nav-main";

import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "~/components/ui/sidebar";

type UserConversation = {
  id: string;
  title: string;
  assistant: {
    id: string;
    name: string;
  } | null;
};

const data = {
  navMain: [
    {
      title: "Chat",
      url: "/chat",
      icon: MessagesSquareIcon,
      isActive: true,
      items: [
        {
          title: "Recent Chat",
          url: "/chat",
        },
        {
          title: "Starred",
          url: "/chat-history?view=starred",
        },
        {
          title: "Settings",
          url: "/chat-settings",
        },
      ],
    },

    {
      title: "Providers",
      url: "/providers",
      icon: BrainCircuitIcon,
      items: [
        {
          title: "List",
          url: "/providers",
        },
        {
          title: "New Provider",
          url: "/provider-new",
        },
      ],
    },
    {
      title: "Models",
      url: "/models",
      icon: BrainIcon,
      items: [
        {
          title: "List",
          url: "/models",
        },
        {
          title: "New Model",
          url: "/model-new",
        },
      ],
    },
    {
      title: "Assistants",
      url: "/assistants",
      icon: BotMessageSquareIcon,
      items: [
        {
          title: "Popular",
          url: "/assistants?view=popular",
        },
        {
          title: "New Assistant",
          url: "/assistant-new",
        },
      ],
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "/settings/general",
        },
        {
          title: "Billing",
          url: "/settings/billing",
        },
      ],
    },
  ],
};

export function AppSidebar({
  conversations = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  conversations?: UserConversation[];
}) {
  // Transform dynamic conversations to the format expected by NavConversations
  const formattedConversations = conversations.map((c) => ({
    title: c.title || `Chat with ${c.assistant?.name || "Assistant"}`,
    url: `/chat/${c.id}`,
    icon: MessageSquareMoreIcon,
  }));

  return (
    <Sidebar collapsible="icon" className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarHeader>
        <NavMain items={data.navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavConversations conversations={formattedConversations} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
