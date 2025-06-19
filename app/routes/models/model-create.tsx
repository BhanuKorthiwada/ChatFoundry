import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { AlertCircle, ArrowLeft, Save } from "lucide-react";
import { Form, Link, data, redirect } from "react-router";
import { z } from "zod/v4";
import { Logger } from "~/.server/log-service";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/model-create";

const modelSchema = z.object({
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
    throw new Response("Unauthorized", { status: 401 });
  }

  const providers = await db.query.aiProviders.findMany({
    where: (provider, { eq }) => eq(provider.isDeleted, false),
    orderBy: (provider, { asc }) => asc(provider.name),
  });

  return { providers };
}

export async function action({ request, context }: Route.ActionArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: modelSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  try {
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

    // Check if slug already exists
    const existingModel = await db.query.aiModels.findFirst({
      where: (model, { eq, and }) => and(eq(model.slug, slug), eq(model.isDeleted, false)),
    });

    if (existingModel) {
      return data(
        {
          result: submission.reply({
            fieldErrors: { slug: ["A model with this slug already exists"] },
          }),
        },
        { status: 400 },
      );
    }

    // Parse and validate JSON fields
    let parsedAliases = null;
    let parsedDetails = null;

    if (aliases?.trim()) {
      try {
        parsedAliases = JSON.parse(aliases);
      } catch (_e) {
        return data(
          {
            result: submission.reply({
              fieldErrors: { aliases: ["Invalid JSON format"] },
            }),
          },
          { status: 400 },
        );
      }
    }

    if (details?.trim()) {
      try {
        parsedDetails = JSON.parse(details);
      } catch (_e) {
        return data(
          {
            result: submission.reply({
              fieldErrors: { details: ["Invalid JSON format"] },
            }),
          },
          { status: 400 },
        );
      }
    }

    await db.insert(schema.aiModels).values({
      slug,
      name,
      description: description || null,
      version: version || null,
      providerId,
      aliases: parsedAliases,
      inputModalities: inputModalities || [],
      outputModalities: outputModalities || [],
      isPreviewModel: isPreviewModel || false,
      isPremiumModel: isPremiumModel || false,
      maxInputTokens: maxInputTokens || null,
      maxOutputTokens: maxOutputTokens || null,
      documentationLink: documentationLink || null,
      status,
      details: parsedDetails,
      createdBy: authSession.user.id,
      updatedBy: authSession.user.id,
    });

    Logger.info("Model created", { slug, name, providerId, createdBy: authSession.user.id });

    return redirect("/models");
  } catch (error) {
    Logger.error("Error creating model", { error });
    return data(
      {
        result: submission.reply({
          formErrors: ["Failed to create model. Please try again."],
        }),
      },
      { status: 500 },
    );
  }
}

export default function ModelCreateRoute(_: Route.ComponentProps) {
  const { providers } = _.loaderData;
  const actionData = _.actionData;
  const [form, fields] = useForm({
    onValidate(context) {
      return parseWithZod(context.formData, { schema: modelSchema });
    },
    lastResult: actionData?.result,
    constraint: getZodConstraint(modelSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/models">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Models
            </Link>
          </Button>
          <div>
            <h1 className="font-bold text-2xl">Create New Model</h1>
            <p className="text-muted-foreground">Add a new AI model to your system</p>
          </div>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Model Details</CardTitle>
          <CardDescription>Configure the basic information and settings for the new AI model.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fields.slug?.id}>Slug *</Label>
                <Input {...getInputProps(fields.slug, { type: "text" })} placeholder="e.g., gpt-4o, claude-3-sonnet" />
                {fields.slug?.errors && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {fields.slug.errors[0]}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.name?.id}>Name *</Label>
                <Input {...getInputProps(fields.name, { type: "text" })} placeholder="e.g., GPT-4o, Claude 3 Sonnet" />
                {fields.name?.errors && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {fields.name.errors[0]}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.description?.id}>Description</Label>
              <Textarea
                {...getInputProps(fields.description, { type: "text" })}
                placeholder="Brief description of the model..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={fields.providerId?.id}>Provider *</Label>
                <Select name={fields.providerId?.name}>
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
                {fields.providerId?.errors && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {fields.providerId.errors[0]}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.version?.id}>Version</Label>
                <Input {...getInputProps(fields.version, { type: "text" })} placeholder="1.0, 2024-01-01" />
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.status?.id}>Status *</Label>
                <Select name={fields.status?.name} defaultValue="active">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label>Input Modalities</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["text", "image", "audio", "video"].map((modality) => (
                    <div key={modality} className="flex items-center space-x-2">
                      <Checkbox id={`input-${modality}`} name="inputModalities" value={modality} />
                      <Label htmlFor={`input-${modality}`} className="capitalize">
                        {modality}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Output Modalities</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["text", "json", "image", "audio"].map((modality) => (
                    <div key={modality} className="flex items-center space-x-2">
                      <Checkbox id={`output-${modality}`} name="outputModalities" value={modality} />
                      <Label htmlFor={`output-${modality}`} className="capitalize">
                        {modality}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="isPreviewModel" name="isPreviewModel" value="true" />
                <Label htmlFor="isPreviewModel">Preview Model</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="isPremiumModel" name="isPremiumModel" value="true" />
                <Label htmlFor="isPremiumModel">Premium Model</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.maxInputTokens?.id}>Max Input Tokens</Label>
                <Input {...getInputProps(fields.maxInputTokens, { type: "number" })} placeholder="128000" />
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.maxOutputTokens?.id}>Max Output Tokens</Label>
                <Input {...getInputProps(fields.maxOutputTokens, { type: "number" })} placeholder="4096" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.documentationLink?.id}>Documentation Link</Label>
              <Input
                {...getInputProps(fields.documentationLink, { type: "url" })}
                placeholder="https://docs.provider.com/models/model-name"
              />
              {fields.documentationLink?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.documentationLink.errors[0]}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.aliases?.id}>Aliases (JSON)</Label>
              <Textarea
                {...getInputProps(fields.aliases, { type: "text" })}
                placeholder='["alternative-name", "legacy-name"]'
                rows={2}
              />
              {fields.aliases?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.aliases.errors[0]}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.details?.id}>Additional Details (JSON)</Label>
              <Textarea
                {...getInputProps(fields.details, { type: "text" })}
                placeholder='{"context_length": 128000, "training_data": "2024-04"}'
                rows={3}
              />
              {fields.details?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.details.errors[0]}
                </div>
              )}
            </div>

            {form.errors && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {form.errors[0]}
              </div>
            )}

            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Create Model
              </Button>
              <Button variant="outline" asChild>
                <Link to="/models">Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
