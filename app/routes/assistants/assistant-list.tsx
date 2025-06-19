import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { eq } from "drizzle-orm";
import { Edit, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { data, Link, useFetcher } from "react-router";
import { z } from "zod/v4";
import { Logger } from "~/.server/log-service";
import { LoadingButton } from "~/components/forms";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/assistant-list";

const assistantSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("edit"),
    assistantId: z.string().min(1, "Assistant ID is required"),
    name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
    description: z.string().optional(),
    scope: z.enum(["global", "team", "user"]),
    visibility: z.enum(["public", "private", "shared"]),
    status: z.enum(["active", "inactive", "deleted"]),
  }),
  z.object({
    intent: z.literal("delete"),
    assistantId: z.string().min(1, "Assistant ID is required"),
  }),
]);

export async function loader({ context, request }: Route.LoaderArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");
  const categoryFilter = url.searchParams.get("category");
  const scopeFilter = url.searchParams.get("scope");

  // Fetch all assistants with their associated models and providers
  const assistants = await db.query.aiAssistants.findMany({
    where: (assistant, { eq }) => eq(assistant.isDeleted, false),
    with: {
      model: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
        with: {
          provider: {
            columns: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: (assistant, { desc }) => [desc(assistant.createdAt)],
  });

  // Apply filters
  let filteredAssistants = assistants;

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredAssistants = filteredAssistants.filter(
      (assistant) =>
        assistant.name.toLowerCase().includes(query) ||
        assistant.slug.toLowerCase().includes(query) ||
        assistant.description?.toLowerCase().includes(query) ||
        assistant.model.name.toLowerCase().includes(query),
    );
  }

  if (categoryFilter && categoryFilter !== "all") {
    filteredAssistants = filteredAssistants.filter((assistant) => assistant.details?.category === categoryFilter);
  }

  if (scopeFilter && scopeFilter !== "all") {
    filteredAssistants = filteredAssistants.filter((assistant) => assistant.scope === scopeFilter);
  }

  // Transform to the format expected by assistant selector
  const transformedAssistants = filteredAssistants.map((assistant) => ({
    id: assistant.id,
    slug: assistant.slug,
    name: assistant.name,
    description: assistant.description,
    details: assistant.details,
    scope: assistant.scope,
    visibility: assistant.visibility,
    model: {
      name: assistant.model.name,
      slug: assistant.model.slug,
    },
  }));

  // Get unique categories for the filter dropdown
  const categories = [
    ...new Set(
      assistants
        .map((assistant) => assistant.details?.category)
        .filter((category): category is string => Boolean(category))
        .sort(),
    ),
  ];

  return {
    assistants: transformedAssistants,
    categories,
    // For the full page view
    allAssistants: assistants,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: assistantSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const { intent, assistantId } = submission.value;
  try {
    switch (intent) {
      case "edit": {
        if (!assistantId) {
          return data(
            { result: submission.reply({ formErrors: ["Assistant ID is required for edit"] }) },
            { status: 400 },
          );
        }

        const { name, description, scope, visibility, status } = submission.value;

        // Update the assistant
        await db
          .update(schema.aiAssistants)
          .set({
            name,
            description: description || null,
            scope,
            visibility,
            status,
            updatedBy: authSession.user.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.aiAssistants.id, assistantId));

        Logger.info("Assistant updated", { assistantId, updatedBy: authSession.user.id });
        break;
      }

      case "delete": {
        if (!assistantId) {
          return data(
            { result: submission.reply({ formErrors: ["Assistant ID is required for delete"] }) },
            { status: 400 },
          );
        }

        // Soft delete the assistant
        await db
          .update(schema.aiAssistants)
          .set({
            isDeleted: true,
            updatedBy: authSession.user.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.aiAssistants.id, assistantId));

        Logger.info("Assistant deleted", { assistantId, deletedBy: authSession.user.id });
        break;
      }
    }

    return data({ result: submission.reply() });
  } catch (error) {
    Logger.error("AI Assistant operation failed", { intent, error });
    return data({ result: submission.reply({ formErrors: ["Operation failed. Please try again."] }) }, { status: 500 });
  }
}

interface EditAssistantDialogProps {
  assistant: {
    id: string;
    name: string;
    description: string | null;
    scope: string;
    visibility: string;
    status: string;
  };
}

function EditAssistantDialog({ assistant }: EditAssistantDialogProps) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state === "submitting";

  const [form, fields] = useForm({
    id: `edit-assistant-${assistant.id}-form`,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: assistantSchema });
    },
    constraint: getZodConstraint(assistantSchema),
    defaultValue: {
      intent: "edit",
      assistantId: assistant.id,
      name: assistant.name,
      description: assistant.description || "",
      scope: assistant.scope,
      visibility: assistant.visibility,
      status: assistant.status,
    },
    shouldRevalidate: "onInput",
  });

  useEffect(() => {
    if (open) {
      const timeoutId = setTimeout(() => {
        const formElement = document.getElementById(form.id);
        if (formElement) {
          const nameInput = formElement.querySelector('input[name="name"]') as HTMLInputElement;
          const descInput = formElement.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
          const scopeInput = formElement.querySelector('input[name="scope"]') as HTMLInputElement;
          const visibilityInput = formElement.querySelector('input[name="visibility"]') as HTMLInputElement;
          const statusInput = formElement.querySelector('input[name="status"]') as HTMLInputElement;

          if (nameInput) nameInput.value = assistant.name;
          if (descInput) descInput.value = assistant.description || "";
          if (scopeInput) scopeInput.value = assistant.scope;
          if (visibilityInput) visibilityInput.value = assistant.visibility;
          if (statusInput) statusInput.value = assistant.status;
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [open, assistant, form.id]);

  // Close dialog on successful submission
  useEffect(() => {
    if (fetcher.data && "result" in fetcher.data && fetcher.data.result?.status === "success") {
      setOpen(false);
    }
  }, [fetcher.data]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit Assistant</SheetTitle>
          <SheetDescription>Update the assistant configuration. Changes will be saved immediately.</SheetDescription>
        </SheetHeader>

        <fetcher.Form method="POST" {...getFormProps(form)} className="flex flex-1 flex-col">
          <input type="hidden" name="intent" value="edit" />
          <input type="hidden" name="assistantId" value={assistant.id} />

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor={fields.name.id} className="font-medium text-sm">
                  Name
                </Label>
                <Input {...getInputProps(fields.name, { type: "text" })} placeholder="Assistant name" />
                <div id={fields.name.errorId} className="text-destructive text-sm">
                  {fields.name.errors}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.description.id} className="font-medium text-sm">
                  Description
                </Label>
                <Textarea
                  {...getInputProps(fields.description, { type: "text" })}
                  placeholder="Describe what this assistant does..."
                  rows={3}
                  className="resize-none"
                />
                <div id={fields.description.errorId} className="text-destructive text-sm">
                  {fields.description.errors}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-medium text-sm">Scope</Label>
                  <Select name="scope" defaultValue={assistant.scope} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="global">Global</SelectItem>
                    </SelectContent>
                  </Select>
                  <div id={fields.scope.errorId} className="text-destructive text-sm">
                    {fields.scope.errors}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium text-sm">Visibility</Label>
                  <Select name="visibility" defaultValue={assistant.visibility} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="shared">Shared</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                  <div id={fields.visibility.errorId} className="text-destructive text-sm">
                    {fields.visibility.errors}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium text-sm">Status</Label>
                <Select name="status" defaultValue={assistant.status} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="deleted">Deleted</SelectItem>
                  </SelectContent>
                </Select>
                <div id={fields.status.errorId} className="text-destructive text-sm">
                  {fields.status.errors}
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="gap-3 border-t p-6">
            <LoadingButton buttonText="Save Changes" loadingText="Saving..." isPending={isSubmitting} />
            <SheetClose asChild disabled={isSubmitting}>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </fetcher.Form>
      </SheetContent>
    </Sheet>
  );
}

export default function AssistantsRoute(_: Route.ComponentProps) {
  const { allAssistants: assistants } = _.loaderData;
  const actionData = _.actionData;
  const [searchTerm, setSearchTerm] = useState("");
  const [lastActionData, setLastActionData] = useState<any>(null);
  const deleteFetcher = useFetcher();

  // Track action data changes for proper dialog closing
  useEffect(() => {
    // Only process new successful action data (not cached ones)
    if (_.actionData && "result" in _.actionData && _.actionData.result && _.actionData !== lastActionData) {
      if (_.actionData.result.status === "success") {
        setLastActionData(_.actionData);
      }
    }
  }, [_.actionData, lastActionData]);

  // Filter assistants based on search term
  const filteredAssistants = assistants.filter(
    (assistant) =>
      assistant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assistant.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assistant.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assistant.model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assistant.model.provider.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-yellow-100 text-yellow-800";
      case "deleted":
      case "deprecated":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getModeBadgeColor = (mode: string) => {
    switch (mode) {
      case "instant":
        return "bg-blue-100 text-blue-800";
      case "session":
        return "bg-purple-100 text-purple-800";
      case "persistent":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">AI Assistants</h1>
          <p className="text-muted-foreground">Manage AI assistant configurations</p>
        </div>
        <Button asChild>
          <Link to="/assistant-new">
            <Plus className="mr-2 h-4 w-4" />
            New Assistant
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Assistants</CardTitle>
              <CardDescription>
                {filteredAssistants.length} assistant{filteredAssistants.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assistants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-[300px] pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssistants.length === 0 ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-muted-foreground">
                {searchTerm ? "No assistants match your search." : "No assistants found."}
              </p>
              {!searchTerm && (
                <Button asChild>
                  <Link to="/assistant-new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Assistant
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssistants.map((assistant) => (
                    <TableRow key={assistant.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{assistant.name}</div>
                          <div className="text-muted-foreground text-sm">{assistant.slug}</div>
                          {assistant.description && (
                            <div className="max-w-xs truncate text-muted-foreground text-sm">
                              {assistant.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{assistant.model.name}</div>
                          <div className="text-muted-foreground text-sm">{assistant.model.provider.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${getStatusBadgeColor(
                            assistant.status,
                          )}`}
                        >
                          {assistant.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${getModeBadgeColor(
                            assistant.mode,
                          )}`}
                        >
                          {assistant.mode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{assistant.visibility}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{assistant.scope}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(assistant.createdAt?.toISOString() || null)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <EditAssistantDialog assistant={assistant} />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Assistant</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{assistant.name}"? This action cannot be undone and
                                  will remove the assistant from your system.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  asChild
                                  onClick={() => {
                                    deleteFetcher.submit(
                                      {
                                        intent: "delete",
                                        assistantId: assistant.id,
                                      },
                                      { method: "post" },
                                    );
                                  }}
                                >
                                  <Button variant="destructive" disabled={deleteFetcher.state === "submitting"}>
                                    {deleteFetcher.state === "submitting" ? "Deleting..." : "Delete"}
                                  </Button>
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
