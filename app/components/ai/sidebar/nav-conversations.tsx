"use client";

import { Folder, Forward, type LucideIcon, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";

export function NavConversations({
  conversations,
}: {
  conversations: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteConversation = async (conversationUrl: string) => {
    const conversationId = conversationUrl.split("/").pop();
    if (!conversationId) return;

    // Show confirmation
    if (!window.confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(conversationId);

    try {
      const response = await fetch(`/api/chat/${conversationId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = (await response.json()) as { success: boolean; error?: string; message?: string };

      if (result.success) {
        toast.success("Conversation deleted successfully");
        // Navigate to main chat if we're currently viewing the deleted conversation
        if (window.location.pathname === conversationUrl) {
          navigate("/chat");
        } else {
          // Refresh the page to update the sidebar
          window.location.reload();
        }
      } else {
        toast.error(result.error || "Failed to delete conversation");
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Failed to delete conversation");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Conversations</SidebarGroupLabel>
      <SidebarMenu>
        {conversations.map((item) => {
          const conversationId = item.url.split("/").pop();
          const isCurrentlyDeleting = isDeleting === conversationId;

          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem asChild>
                    <Link to={item.url}>
                      <Folder className="text-muted-foreground" />
                      <span>View Conversation</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`${item.url}?view=share`}>
                      <Forward className="text-muted-foreground" />
                      <span>Share Conversation</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteConversation(item.url)}
                    disabled={isCurrentlyDeleting}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="text-muted-foreground" />
                    <span>{isCurrentlyDeleting ? "Deleting..." : "Delete Conversation"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          );
        })}
        <SidebarMenuItem>
          <SidebarMenuButton className="text-sidebar-foreground/70" asChild>
            <Link to="/chat-history">
              <MoreHorizontal className="text-sidebar-foreground/70" />
              <span>More</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
