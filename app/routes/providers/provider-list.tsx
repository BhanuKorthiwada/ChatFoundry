import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { eq } from "drizzle-orm";
import { AlertCircle, Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Form, Link, data } from "react-router";
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
import { Card, CardContent } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/provider-list";

const providerSchema = z.object({
  intent: z.enum(["update", "delete"]),
  id: z.string().min(1, "Provider ID is required"),
  slug: z.string().min(1, "Slug is required").max(50, "Slug must be less than 50 characters"),
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().optional(),
  baseUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  apiVersion: z.string().optional(),
  status: z.enum(["active", "inactive", "deprecated"]),
  authType: z.enum(["api_key", "oauth", "none"]).optional(),
  headers: z.string().optional(), // JSON string
  rateLimits: z.string().optional(), // JSON string
});

export async function loader(_: Route.LoaderArgs) {
  const providers = await db.query.aiProviders.findMany({
    where: (provider, { eq }) => eq(provider.isDeleted, false),
    orderBy: (provider, { asc }) => asc(provider.name),
  });

  return { providers };
}

export async function action({ request, context }: Route.ActionArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    return data({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: providerSchema });

  if (submission.status !== "success") {
    return data(
      {
        result: submission.reply({
          formErrors: ["Invalid form data"],
        }),
      },
      { status: 400 },
    );
  }

  const { intent, id, slug, name, description, baseUrl, apiVersion, status, authType, headers, rateLimits } =
    submission.value;
  try {
    switch (intent) {
      case "update": {
        if (!id) {
          return data({ success: false, error: "Provider ID required for update" }, { status: 400 });
        }

        // Check if slug conflicts with another provider
        const existingProvider = await db.query.aiProviders.findFirst({
          where: (provider, { eq, and, ne }) =>
            and(eq(provider.slug, slug), eq(provider.isDeleted, false), ne(provider.id, id)),
        });

        if (existingProvider) {
          return data(
            {
              result: submission.reply({
                fieldErrors: { slug: ["Slug already exists"] },
              }),
            },
            { status: 400 },
          );
        }

        // Parse JSON fields
        let parsedHeaders = {};
        let parsedRateLimits = {};

        if (headers) {
          try {
            parsedHeaders = JSON.parse(headers);
          } catch {
            return data(
              {
                result: submission.reply({
                  fieldErrors: { headers: ["Invalid JSON format"] },
                }),
              },
              { status: 400 },
            );
          }
        }

        if (rateLimits) {
          try {
            parsedRateLimits = JSON.parse(rateLimits);
          } catch {
            return data(
              {
                result: submission.reply({
                  fieldErrors: { rateLimits: ["Invalid JSON format"] },
                }),
              },
              { status: 400 },
            );
          }
        }

        await db
          .update(schema.aiProviders)
          .set({
            slug,
            name,
            description: description || null,
            baseUrl: baseUrl || null,
            apiVersion: apiVersion || null,
            status,
            details: {
              authType,
              headers: Object.keys(parsedHeaders).length > 0 ? parsedHeaders : undefined,
              rateLimits: Object.keys(parsedRateLimits).length > 0 ? parsedRateLimits : undefined,
            },
            updatedBy: authSession.user.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.aiProviders.id, id));

        Logger.info("AI Provider updated", { id, slug, name, updatedBy: authSession.user.id });
        break;
      }

      case "delete": {
        if (!id) {
          return data({ success: false, error: "Provider ID required for delete" }, { status: 400 });
        }

        await db
          .update(schema.aiProviders)
          .set({
            isDeleted: true,
            deletedBy: authSession.user.id,
            deletedAt: new Date(),
          })
          .where(eq(schema.aiProviders.id, id));

        Logger.info("AI Provider deleted", { id, deletedBy: authSession.user.id });
        break;
      }
    }

    return data({ success: true });
  } catch (error) {
    Logger.error("AI Provider operation failed", error);
    return data(
      {
        result: submission.reply({
          formErrors: ["Operation failed. Please try again."],
        }),
      },
      { status: 500 },
    );
  }
}

export default function Providers(_: Route.ComponentProps) {
  const { providers } = _.loaderData;
  const [editingProvider, setEditingProvider] = useState<(typeof providers)[0] | null>(null);

  useEffect(() => {
    if (_.actionData && "success" in _.actionData && _.actionData.success && editingProvider) {
      setEditingProvider(null);
    }
  }, [_.actionData, editingProvider]);

  const [form, fields] = useForm({
    id: editingProvider ? `edit-${editingProvider.id}` : undefined,
    constraint: getZodConstraint(providerSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: providerSchema });
    },
    defaultValue: editingProvider
      ? {
          intent: "update",
          id: editingProvider.id,
          slug: editingProvider.slug,
          name: editingProvider.name,
          description: editingProvider.description || "",
          baseUrl: editingProvider.baseUrl || "",
          apiVersion: editingProvider.apiVersion || "",
          status: editingProvider.status,
          authType: editingProvider.details?.authType || "none",
          headers: editingProvider.details?.headers ? JSON.stringify(editingProvider.details.headers, null, 2) : "",
          rateLimits: editingProvider.details?.rateLimits
            ? JSON.stringify(editingProvider.details.rateLimits, null, 2)
            : "",
        }
      : undefined,
  });
  const handleEdit = (provider: (typeof providers)[0]) => {
    setEditingProvider(provider);
  };

  const handleCloseDialog = () => {
    setEditingProvider(null);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">AI Providers</h1>
          <p className="text-muted-foreground">Manage AI provider configurations</p>
        </div>
        <Button asChild>
          <Link to="/provider-new">
            <Plus className="mr-2 h-4 w-4" />
            New Provider
          </Link>
        </Button>
      </div>

      <Dialog open={!!editingProvider} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
            <DialogDescription>Update the provider configuration</DialogDescription>
          </DialogHeader>

          {editingProvider && (
            <Form method="post" {...getFormProps(form)} key={editingProvider.id}>
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={editingProvider.id} />

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={fields.slug.id}>Slug *</Label>
                    <Input {...getInputProps(fields.slug, { type: "text" })} placeholder="openai" />
                    {fields.slug.errors && <p className="mt-1 text-destructive text-sm">{fields.slug.errors[0]}</p>}
                  </div>
                  <div>
                    <Label htmlFor={fields.name.id}>Name *</Label>
                    <Input {...getInputProps(fields.name, { type: "text" })} placeholder="OpenAI" />
                    {fields.name.errors && <p className="mt-1 text-destructive text-sm">{fields.name.errors[0]}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor={fields.description.id}>Description</Label>
                  <Textarea
                    {...getInputProps(fields.description, { type: "text" })}
                    placeholder="Provider description..."
                  />
                  {fields.description.errors && (
                    <p className="mt-1 text-destructive text-sm">{fields.description.errors[0]}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={fields.baseUrl.id}>Base URL</Label>
                    <Input {...getInputProps(fields.baseUrl, { type: "url" })} placeholder="https://api.openai.com" />
                    {fields.baseUrl.errors && (
                      <p className="mt-1 text-destructive text-sm">{fields.baseUrl.errors[0]}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={fields.apiVersion.id}>API Version</Label>
                    <Input {...getInputProps(fields.apiVersion, { type: "text" })} placeholder="v1" />
                    {fields.apiVersion.errors && (
                      <p className="mt-1 text-destructive text-sm">{fields.apiVersion.errors[0]}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={fields.status.id}>Status *</Label>
                    <Select name={fields.status.name} defaultValue={editingProvider.status}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="deprecated">Deprecated</SelectItem>
                      </SelectContent>
                    </Select>
                    {fields.status.errors && <p className="mt-1 text-destructive text-sm">{fields.status.errors[0]}</p>}
                  </div>
                  <div>
                    <Label htmlFor={fields.authType.id}>Auth Type</Label>
                    <Select name={fields.authType.name} defaultValue={editingProvider.details?.authType || "none"}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select auth type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="api_key">API Key</SelectItem>
                        <SelectItem value="oauth">OAuth</SelectItem>
                      </SelectContent>
                    </Select>
                    {fields.authType.errors && (
                      <p className="mt-1 text-destructive text-sm">{fields.authType.errors[0]}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor={fields.headers.id}>Headers (JSON)</Label>
                  <Textarea
                    {...getInputProps(fields.headers, { type: "text" })}
                    placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                    rows={3}
                  />
                  {fields.headers.errors && <p className="mt-1 text-destructive text-sm">{fields.headers.errors[0]}</p>}
                </div>

                <div>
                  <Label htmlFor={fields.rateLimits.id}>Rate Limits (JSON)</Label>
                  <Textarea
                    {...getInputProps(fields.rateLimits, { type: "text" })}
                    placeholder='{"requestsPerMinute": 100, "tokensPerMinute": 60000}'
                    rows={3}
                  />
                  {fields.rateLimits.errors && (
                    <p className="mt-1 text-destructive text-sm">{fields.rateLimits.errors[0]}</p>
                  )}
                </div>

                {form.errors && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {form.errors[0]}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit">Update Provider</Button>
                </div>
              </div>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Auth Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No providers found. Add your first provider to get started.
                  </TableCell>
                </TableRow>
              ) : (
                providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{provider.name}</div>
                        {provider.description && (
                          <div className="text-muted-foreground text-sm">{provider.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{provider.slug}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${
                          provider.status === "active"
                            ? "bg-green-100 text-green-800"
                            : provider.status === "inactive"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {provider.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {provider.baseUrl || <span className="text-muted-foreground">Not set</span>}
                    </TableCell>
                    <TableCell className="text-sm capitalize">{provider.details?.authType || "none"}</TableCell>
                    <TableCell className="text-right">
                      {" "}
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(provider)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>{" "}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Provider</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{provider.name}"? This action cannot be undone and will
                                remove the provider from your system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  const formData = new FormData();
                                  formData.set("intent", "delete");
                                  formData.set("id", provider.id);

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
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Provider
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
