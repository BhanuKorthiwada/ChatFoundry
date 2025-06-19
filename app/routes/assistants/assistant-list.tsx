import { parseWithZod } from "@conform-to/zod/v4";
import { eq } from "drizzle-orm";
import { AlertCircle, Edit, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, data, redirect } from "react-router";
import { z } from "zod/v4";
import { Logger } from "~/.server/log-service";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/assistant-list";

const deleteSchema = z.object({
  assistantId: z.string().min(1, "Assistant ID is required"),
});

export async function loader({ context }: Route.LoaderArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Fetch all assistants with their associated models and providers
  const assistants = await db.query.aiAssistants.findMany({
    where: (assistant, { eq }) => eq(assistant.isDeleted, false),
    with: {
      model: {
        columns: {
          name: true,
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

  return { assistants };
}

export async function action({ request, context }: Route.ActionArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: deleteSchema });

  if (submission.status !== "success") {
    return data({ error: "Invalid form data" }, { status: 400 });
  }

  try {
    const { assistantId } = submission.value;

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

    return redirect("/assistants");
  } catch (error) {
    Logger.error("Error deleting assistant", { error });
    return data({ error: "Failed to delete assistant. Please try again." }, { status: 500 });
  }
}

export default function AssistantsRoute(_: Route.ComponentProps) {
  const { assistants } = _.loaderData;
  const actionData = _.actionData;
  const [searchTerm, setSearchTerm] = useState("");

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
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">AI Assistants</h1>
            <p className="text-muted-foreground">Manage your AI assistants and their configurations</p>
          </div>
          <Button asChild>
            <Link to="/assistant-new">
              <Plus className="mr-2 h-4 w-4" />
              New Assistant
            </Link>
          </Button>
        </div>
      </div>

      {actionData?.error && (
        <div className="mb-6">
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {actionData.error}
          </div>
        </div>
      )}

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
            <div className="overflow-hidden">
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
                        <div>
                          <div className="font-medium">{assistant.name}</div>
                          <div className="text-muted-foreground text-sm">{assistant.slug}</div>
                          {assistant.description && (
                            <div className="mt-1 max-w-xs truncate text-muted-foreground text-sm">
                              {assistant.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
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
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/assistants/${assistant.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
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
                                  onClick={() => {
                                    const formData = new FormData();
                                    formData.set("assistantId", assistant.id);

                                    // Submit form programmatically
                                    const form = document.createElement("form");
                                    form.method = "POST";
                                    form.style.display = "none";

                                    // Append all form data entries
                                    for (const [key, value] of formData.entries()) {
                                      const input = document.createElement("input");
                                      input.type = "hidden";
                                      input.name = key;
                                      input.value = value as string;
                                      form.appendChild(input);
                                    }

                                    document.body.appendChild(form);
                                    form.submit();
                                  }}
                                >
                                  Delete
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
