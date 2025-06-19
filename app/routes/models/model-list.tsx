import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { eq } from "drizzle-orm";
import { AlertCircle, Edit2, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Form, Link, data, redirect } from "react-router";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/model-list";

const modelSchema = z.object({
  intent: z.enum(["update", "delete"]),
  id: z.string().optional(),
  slug: z.string().min(1, "Slug is required").max(100),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  version: z.string().optional(),
  providerId: z.string().min(1, "Provider is required"),
  aliases: z.string().optional(), // JSON string
  inputModalities: z.array(z.enum(["text", "image", "audio", "video"])).optional(),
  outputModalities: z.array(z.enum(["text", "json", "image", "audio"])).optional(),
  isPreviewModel: z.boolean().optional(),
  isPremiumModel: z.boolean().optional(),
  maxInputTokens: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  documentationLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "deprecated"]),
  details: z.string().optional(), // JSON string
});

export async function loader({ context }: Route.LoaderArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw redirect("/auth/signin?returnUrl=/models");
  }

  const [models, providers] = await Promise.all([
    db.query.aiModels.findMany({
      where: (model, { eq }) => eq(model.isDeleted, false),
      with: {
        provider: true,
      },
      orderBy: (model, { asc }) => asc(model.name),
    }),
    db.query.aiProviders.findMany({
      where: (provider, { eq }) => eq(provider.isDeleted, false),
      orderBy: (provider, { asc }) => asc(provider.name),
    }),
  ]);

  return { models, providers };
}

export async function action({ request, context }: Route.ActionArgs) {
  const authSession = context.get(authSessionContext);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: modelSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const {
    intent,
    id,
    slug,
    name,
    description,
    version,
    providerId,
    aliases,
    inputModalities,
    outputModalities,
    isPreviewModel,
    isPremiumModel,
    maxInputTokens,
    maxOutputTokens,
    documentationLink,
    status,
    details,
  } = submission.value;
  try {
    switch (intent) {
      case "update": {
        if (!id) {
          return data(
            { result: submission.reply({ formErrors: ["Model ID is required for update"] }) },
            { status: 400 },
          );
        }

        // Parse JSON fields
        let parsedAliases: string[] = [];
        let parsedDetails: Record<string, unknown> = {};

        if (aliases) {
          try {
            parsedAliases = JSON.parse(aliases);
          } catch {
            return data(
              { result: submission.reply({ fieldErrors: { aliases: ["Invalid JSON format"] } }) },
              { status: 400 },
            );
          }
        }

        if (details) {
          try {
            parsedDetails = JSON.parse(details);
          } catch {
            return data(
              { result: submission.reply({ fieldErrors: { details: ["Invalid JSON format"] } }) },
              { status: 400 },
            );
          }
        }

        await db
          .update(schema.aiModels)
          .set({
            slug,
            name,
            description,
            version,
            providerId,
            aliases: parsedAliases,
            inputModalities: inputModalities || [],
            outputModalities: outputModalities || [],
            isPreviewModel: isPreviewModel || false,
            isPremiumModel: isPremiumModel || false,
            maxInputTokens,
            maxOutputTokens,
            documentationLink,
            status,
            details: parsedDetails,
            updatedBy: authSession.user.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.aiModels.id, id));

        Logger.info("AI Model updated", { id, slug, name, updatedBy: authSession.user.id });
        break;
      }

      case "delete": {
        if (!id) {
          return data(
            { result: submission.reply({ formErrors: ["Model ID is required for delete"] }) },
            { status: 400 },
          );
        }

        await db
          .update(schema.aiModels)
          .set({
            isDeleted: true,
            deletedBy: authSession.user.id,
            deletedAt: new Date(),
          })
          .where(eq(schema.aiModels.id, id));

        Logger.info("AI Model deleted", { id, deletedBy: authSession.user.id });
        break;
      }
    }

    return data({ result: submission.reply() });
  } catch (error) {
    Logger.error("AI Model operation failed", { intent, error });
    return data({ result: submission.reply({ formErrors: ["Operation failed. Please try again."] }) }, { status: 500 });
  }
}

export default function Models(_: Route.ComponentProps) {
  const { models, providers } = _.loaderData;
  const [editingModel, setEditingModel] = useState<(typeof models)[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>(providers[0]?.id || "");

  useEffect(() => {
    if (_.actionData && "result" in _.actionData && _.actionData.result && editingModel) {
      if (_.actionData.result.status === "success") {
        setEditingModel(null);
      }
    }
  }, [_.actionData, editingModel]);

  const filteredModels = useMemo(() => {
    let filtered = models;

    if (searchQuery) {
      filtered = filtered.filter(
        (model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    filtered = filtered.filter((model) => model.providerId === selectedProvider);

    return filtered;
  }, [models, searchQuery, selectedProvider]);
  const [form, fields] = useForm({
    id: editingModel ? `edit-${editingModel.id}` : undefined,
    constraint: getZodConstraint(modelSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: modelSchema });
    },
    defaultValue: editingModel
      ? {
          intent: "update",
          id: editingModel.id,
          slug: editingModel.slug,
          name: editingModel.name,
          description: editingModel.description || "",
          version: editingModel.version || "",
          providerId: editingModel.providerId,
          aliases: editingModel.aliases ? JSON.stringify(editingModel.aliases, null, 2) : "",
          inputModalities: editingModel.inputModalities || [],
          outputModalities: editingModel.outputModalities || [],
          isPreviewModel: editingModel.isPreviewModel,
          isPremiumModel: editingModel.isPremiumModel,
          maxInputTokens: editingModel.maxInputTokens,
          maxOutputTokens: editingModel.maxOutputTokens,
          documentationLink: editingModel.documentationLink || "",
          status: editingModel.status,
          details: editingModel.details ? JSON.stringify(editingModel.details, null, 2) : "",
        }
      : undefined,
  });

  const handleEdit = (model: (typeof models)[0]) => {
    setEditingModel(model);
  };
  const handleCloseDialog = () => {
    setEditingModel(null);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-bold text-2xl">AI Models</h1>
        <Button asChild>
          <Link to="/model-new">
            <Plus className="mr-2 h-4 w-4" />
            New Model
          </Link>
        </Button>
      </div>

      <Dialog open={!!editingModel} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>Update the model configuration</DialogDescription>
          </DialogHeader>
          {editingModel && (
            <Form method="post" {...getFormProps(form)} key={editingModel.id}>
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={editingModel.id} />

              <div className="grid gap-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={fields.slug.id}>Slug *</Label>
                    <Input {...getInputProps(fields.slug, { type: "text" })} placeholder="gpt-4-turbo" />
                    {fields.slug.errors && <p className="mt-1 text-destructive text-sm">{fields.slug.errors[0]}</p>}
                  </div>
                  <div>
                    <Label htmlFor={fields.name.id}>Name *</Label>
                    <Input {...getInputProps(fields.name, { type: "text" })} placeholder="GPT-4 Turbo" />
                    {fields.name.errors && <p className="mt-1 text-destructive text-sm">{fields.name.errors[0]}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor={fields.description.id}>Description</Label>
                  <Textarea
                    {...getInputProps(fields.description, { type: "text" })}
                    placeholder="Model description..."
                  />
                  {fields.description.errors && (
                    <p className="mt-1 text-destructive text-sm">{fields.description.errors[0]}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor={fields.version.id}>Version</Label>
                    <Input {...getInputProps(fields.version, { type: "text" })} placeholder="1.0" />
                    {fields.version.errors && (
                      <p className="mt-1 text-destructive text-sm">{fields.version.errors[0]}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={fields.providerId.id}>Provider *</Label>
                    <Select name={fields.providerId.name} defaultValue={editingModel?.providerId || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fields.providerId.errors && (
                      <p className="mt-1 text-destructive text-sm">{fields.providerId.errors[0]}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={fields.status.id}>Status *</Label>
                    <Select name={fields.status.name} defaultValue={editingModel?.status || "active"}>
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
                </div>

                {/* Capabilities */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox name="isPreviewModel" defaultChecked={editingModel?.isPreviewModel || false} />
                    <Label>Preview Model</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox name="isPremiumModel" defaultChecked={editingModel?.isPremiumModel || false} />
                    <Label>Premium Model</Label>
                  </div>
                </div>

                {/* Token Limits */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={fields.maxInputTokens.id}>Max Input Tokens</Label>
                    <Input {...getInputProps(fields.maxInputTokens, { type: "number" })} placeholder="128000" />
                    {fields.maxInputTokens.errors && (
                      <p className="mt-1 text-destructive text-sm">{fields.maxInputTokens.errors[0]}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={fields.maxOutputTokens.id}>Max Output Tokens</Label>
                    <Input {...getInputProps(fields.maxOutputTokens, { type: "number" })} placeholder="4096" />
                    {fields.maxOutputTokens.errors && (
                      <p className="mt-1 text-destructive text-sm">{fields.maxOutputTokens.errors[0]}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor={fields.documentationLink.id}>Documentation Link</Label>
                  <Input {...getInputProps(fields.documentationLink, { type: "url" })} placeholder="https://..." />
                  {fields.documentationLink.errors && (
                    <p className="mt-1 text-destructive text-sm">{fields.documentationLink.errors[0]}</p>
                  )}
                </div>

                {/* JSON Fields */}
                <div>
                  <Label htmlFor={fields.aliases.id}>Aliases (JSON Array)</Label>
                  <Textarea
                    {...getInputProps(fields.aliases, { type: "text" })}
                    placeholder='["alias1", "alias2"]'
                    rows={2}
                  />
                  {fields.aliases.errors && <p className="mt-1 text-destructive text-sm">{fields.aliases.errors[0]}</p>}
                </div>

                <div>
                  <Label htmlFor={fields.details.id}>Details (JSON)</Label>
                  <Textarea
                    {...getInputProps(fields.details, { type: "text" })}
                    placeholder='{"hasReasoning": true, "supportsStreaming": true}'
                    rows={4}
                  />
                  {fields.details.errors && <p className="mt-1 text-destructive text-sm">{fields.details.errors[0]}</p>}
                </div>

                {form.errors && (
                  <div className="rounded-md bg-destructive/15 p-3">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div className="ml-3">
                        <h3 className="font-medium text-destructive text-sm">Validation Error</h3>
                        <p className="mt-1 text-destructive text-sm">{form.errors[0]}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>{" "}
                  <Button type="submit">Update Model</Button>
                </div>
              </div>
            </Form>
          )}{" "}
        </DialogContent>
      </Dialog>

      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models by name, slug, or description..."
                className="w-80 pl-9"
              />
            </div>
          </div>
        </div>

        <Tabs value={selectedProvider} onValueChange={setSelectedProvider}>
          <TabsList>
            {providers.map((provider) => {
              const providerModelCount = models.filter((m) => m.providerId === provider.id).length;
              return (
                <TabsTrigger key={provider.id} value={provider.id}>
                  {provider.name} ({providerModelCount})
                </TabsTrigger>
              );
            })}
          </TabsList>

          {providers.map((provider) => {
            const providerModels = filteredModels.filter((m) => m.providerId === provider.id);
            return (
              <TabsContent key={provider.id} value={provider.id}>
                <Card className="py-0">
                  <CardContent className="p-0">
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky top-0">Name</TableHead>
                            <TableHead className="sticky top-0">Slug</TableHead>
                            <TableHead className="sticky top-0">Status</TableHead>
                            <TableHead className="sticky top-0">Version</TableHead>
                            <TableHead className="sticky top-0">Max Tokens</TableHead>
                            <TableHead className="sticky top-0">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {providerModels.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                {searchQuery
                                  ? `No ${provider.name} models match your search criteria.`
                                  : `No ${provider.name} models found.`}
                              </TableCell>
                            </TableRow>
                          ) : (
                            providerModels.map((model) => (
                              <TableRow key={model.id}>
                                <TableCell className="font-medium">
                                  <div>
                                    <div>{model.name}</div>
                                    {model.description && (
                                      <div className="text-muted-foreground text-sm">{model.description}</div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{model.slug}</TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${
                                      model.status === "active"
                                        ? "bg-green-50 text-green-700"
                                        : model.status === "inactive"
                                          ? "bg-yellow-50 text-yellow-700"
                                          : "bg-red-50 text-red-700"
                                    }`}
                                  >
                                    {model.status}
                                  </span>
                                </TableCell>
                                <TableCell>{model.version || "-"}</TableCell>
                                <TableCell>
                                  {model.maxInputTokens ? `${model.maxInputTokens.toLocaleString()}` : "-"}
                                </TableCell>{" "}
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(model)}>
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Model</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete "{model.name}"? This action cannot be undone
                                            and will remove the model from your system.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => {
                                              const formData = new FormData();
                                              formData.set("intent", "delete");
                                              formData.set("id", model.id);

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
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
