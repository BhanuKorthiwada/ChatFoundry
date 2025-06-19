import { AppSidebar } from "~/components/ai/sidebar/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";

type UserConversation = {
  id: string;
  title: string;
  assistant: {
    id: string;
    name: string;
  } | null;
};

type BreadcrumbData = {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
};

export const AiLayout = ({
  children,
  conversations = [],
  conversationTitle,
  breadcrumbs,
}: {
  children: React.ReactNode;
  conversations?: UserConversation[];
  conversationTitle?: string;
  breadcrumbs?: BreadcrumbData[];
}) => {
  const defaultBreadcrumbs: BreadcrumbData[] = [
    { label: "Chat", href: "/chat" },
    { label: conversationTitle || "Assistant", isCurrentPage: true },
  ];

  const activeBreadcrumbs = breadcrumbs || defaultBreadcrumbs;

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="min-h-[calc(100svh-var(--header-height))]">
        <AppSidebar conversations={conversations} />
        <SidebarInset className="flex h-[calc(100svh-var(--header-height))] flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  {activeBreadcrumbs.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex items-center">
                      {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                      <BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
                        {item.isCurrentPage ? (
                          <BreadcrumbPage>{item.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </div>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex-1 overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};
