import { getFormProps, getInputProps, getTextareaProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { eq } from "drizzle-orm";
import { AlertCircle, Edit2, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { data, Form, Link, redirect, useFetcher } from "react-router";
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
import { Checkbox } from "~/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/model-list";

const modelSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("update"),
    id: z.string().min(1, "Model ID is required"),
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
  }),
  z.object({
    intent: z.literal("delete"),
    id: z.string().min(1, "Model ID is required"),
  }),
]);

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

  const { intent, id } = submission.value;
  try {
    switch (intent) {
      case "update": {
        if (!id) {
          return data(
            { result: submission.reply({ formErrors: ["Model ID is required for update"] }) },
            { status: 400 },
          );
        }

        const {
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
  const [lastActionData, setLastActionData] = useState<any>(null);
  const deleteFetcher = useFetcher();

  useEffect(() => {
    // Only close dialog if this is a new successful action (not a cached one)
    if (
      _.actionData &&
      "result" in _.actionData &&
      _.actionData.result &&
      editingModel &&
      _.actionData !== lastActionData
    ) {
      if (_.actionData.result.status === "success") {
        setEditingModel(null);
        setLastActionData(_.actionData);
      }
    }
  }, [_.actionData, editingModel, lastActionData]);

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

    // Sync server validation results
    lastResult: _.actionData?.result,

    // Validation configuration - best practice
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",

    // Validation constraints from schema
    constraint: getZodConstraint(modelSchema),

    // Client-side validation
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
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">AI Models</h1>
          <p className="text-muted-foreground">Manage AI model configurations</p>
        </div>
        <Button asChild>
          <Link to="/model-new">
            <Plus className="mr-2 h-4 w-4" />
            New Model
          </Link>
        </Button>
      </div>

      <Sheet open={!!editingModel} onOpenChange={handleCloseDialog}>
        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Edit Model</SheetTitle>
            <SheetDescription>Update the model configuration. Changes will be saved immediately.</SheetDescription>
          </SheetHeader>
          {editingModel && (
            <Form method="post" {...getFormProps(form)} key={editingModel.id} className="flex flex-1 flex-col">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={editingModel.id} />

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={fields.slug.id}>Slug *</Label>
                      <Input {...getInputProps(fields.slug, { type: "text" })} placeholder="gpt-4-turbo" />
                      <div id={fields.slug.errorId} className="text-destructive text-sm">
                        {fields.slug.errors}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={fields.name.id}>Name *</Label>
                      <Input {...getInputProps(fields.name, { type: "text" })} placeholder="GPT-4 Turbo" />
                      <div id={fields.name.errorId} className="text-destructive text-sm">
                        {fields.name.errors}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={fields.description.id}>Description</Label>
                    <Textarea {...getTextareaProps(fields.description)} placeholder="Model description..." />
                    <div id={fields.description.errorId} className="text-destructive text-sm">
                      {fields.description.errors}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={fields.version.id}>Version</Label>
                      <Input {...getInputProps(fields.version, { type: "text" })} placeholder="1.0" />
                      <div id={fields.version.errorId} className="text-destructive text-sm">
                        {fields.version.errors}
                      </div>
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
                      <div id={fields.providerId.errorId} className="text-destructive text-sm">
                        {fields.providerId.errors}
                      </div>
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
                      <div id={fields.status.errorId} className="text-destructive text-sm">
                        {fields.status.errors}
                      </div>
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
                      <div id={fields.maxInputTokens.errorId} className="text-destructive text-sm">
                        {fields.maxInputTokens.errors}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={fields.maxOutputTokens.id}>Max Output Tokens</Label>
                      <Input {...getInputProps(fields.maxOutputTokens, { type: "number" })} placeholder="4096" />
                      <div id={fields.maxOutputTokens.errorId} className="text-destructive text-sm">
                        {fields.maxOutputTokens.errors}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={fields.documentationLink.id}>Documentation Link</Label>
                    <Input {...getInputProps(fields.documentationLink, { type: "url" })} placeholder="https://..." />
                    <div id={fields.documentationLink.errorId} className="text-destructive text-sm">
                      {fields.documentationLink.errors}
                    </div>
                  </div>

                  {/* JSON Fields */}
                  <div>
                    <Label htmlFor={fields.aliases.id}>Aliases (JSON Array)</Label>
                    <Textarea {...getTextareaProps(fields.aliases)} placeholder='["alias1", "alias2"]' rows={2} />
                    <div id={fields.aliases.errorId} className="text-destructive text-sm">
                      {fields.aliases.errors}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={fields.details.id}>Details (JSON)</Label>
                    <Textarea
                      {...getTextareaProps(fields.details)}
                      placeholder='{"hasReasoning": true, "supportsStreaming": true}'
                      rows={4}
                    />
                    <div id={fields.details.errorId} className="text-destructive text-sm">
                      {fields.details.errors}
                    </div>
                  </div>

                  {form.errors && (
                    <div className="rounded-md bg-destructive/15 p-3" id={form.errorId}>
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <div className="ml-3">
                          <h3 className="font-medium text-destructive text-sm">Validation Error</h3>
                          <div className="mt-1 text-destructive text-sm">{form.errors}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <SheetFooter className="gap-3 border-t p-6">
                <Button type="submit">Update Model</Button>
                <SheetClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </SheetClose>
              </SheetFooter>
            </Form>
          )}
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Models</CardTitle>
              <CardDescription>
                {filteredModels.length} model{filteredModels.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search models by name, slug, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[300px] pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                <TabsContent key={provider.id} value={provider.id} className="mt-6">
                  {providerModels.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="mb-4 text-muted-foreground">
                        {searchQuery
                          ? `No ${provider.name} models match your search.`
                          : `No ${provider.name} models found.`}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Max Tokens</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {providerModels.map((model) => (
                            <TableRow key={model.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">{model.name}</div>
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
                                      ? "bg-green-100 text-green-800"
                                      : model.status === "inactive"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {model.status}
                                </span>
                              </TableCell>
                              <TableCell>{model.version || "-"}</TableCell>
                              <TableCell>
                                {model.maxInputTokens ? `${model.maxInputTokens.toLocaleString()}` : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => handleEdit(model)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <Trash2 className="h-4 w-4 text-destructive" />
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
                                          asChild
                                          onClick={() => {
                                            deleteFetcher.submit(
                                              {
                                                intent: "delete",
                                                id: model.id,
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
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
