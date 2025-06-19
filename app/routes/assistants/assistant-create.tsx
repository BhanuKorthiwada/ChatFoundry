import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { AlertCircle, ArrowLeft, Save } from "lucide-react";
import { Form, Link, data, redirect } from "react-router";
import { z } from "zod/v4";
import { Logger } from "~/.server/log-service";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/assistant-create";

const assistantSchema = z.object({
  slug: z.string().min(1, "Slug is required").max(100),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  initMessages: z.string().optional(), // JSON string
  status: z.enum(["active", "inactive", "deleted"]),
  mode: z.enum(["instant", "session", "persistent"]),
  visibility: z.enum(["public", "private", "shared"]),
  scope: z.enum(["global", "team", "user"]),
  modelId: z.string().min(1, "Model is required"),
  details: z.string().optional(), // JSON string
});

export async function loader({ context }: Route.LoaderArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Fetch AI models for the dropdown
  const models = await db.query.aiModels.findMany({
    where: (model, { eq, and }) => and(eq(model.isDeleted, false), eq(model.status, "active")),
    with: {
      provider: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: (model, { asc }) => [asc(model.name)],
  });

  return { models };
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

  try {
    const { slug, name, description, initMessages, status, mode, visibility, scope, modelId, details } =
      submission.value;

    // Check if slug already exists
    const existingAssistant = await db.query.aiAssistants.findFirst({
      where: (assistant, { eq, and }) => and(eq(assistant.slug, slug), eq(assistant.isDeleted, false)),
    });

    if (existingAssistant) {
      return data(
        {
          result: submission.reply({
            fieldErrors: { slug: ["An assistant with this slug already exists"] },
          }),
        },
        { status: 400 },
      );
    }

    // Parse and validate JSON fields
    let parsedInitMessages = null;
    let parsedDetails = null;

    if (initMessages?.trim()) {
      try {
        parsedInitMessages = JSON.parse(initMessages);
      } catch (_e) {
        return data(
          {
            result: submission.reply({
              fieldErrors: { initMessages: ["Invalid JSON format"] },
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

    await db.insert(schema.aiAssistants).values({
      slug,
      name,
      description: description || null,
      initMessages: parsedInitMessages,
      status,
      mode,
      visibility,
      scope,
      modelId,
      details: parsedDetails,
      createdBy: authSession.user.id,
      updatedBy: authSession.user.id,
    });

    Logger.info("Assistant created", { slug, name, createdBy: authSession.user.id });

    return redirect("/assistants");
  } catch (error) {
    Logger.error("Error creating assistant", { error });
    return data(
      {
        result: submission.reply({
          formErrors: ["Failed to create assistant. Please try again."],
        }),
      },
      { status: 500 },
    );
  }
}

export default function AssistantCreateRoute(_: Route.ComponentProps) {
  const { models } = _.loaderData;
  const actionData = _.actionData;
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    constraint: getZodConstraint(assistantSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/assistants">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assistants
            </Link>
          </Button>
          <div>
            <h1 className="font-bold text-2xl">Create New Assistant</h1>
            <p className="text-muted-foreground">Add a new AI assistant to your system</p>
          </div>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Assistant Details</CardTitle>
          <CardDescription>Configure the basic information and settings for the new AI assistant.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fields.slug?.id}>Slug *</Label>
                <Input
                  {...(fields.slug ? getInputProps(fields.slug, { type: "text" }) : {})}
                  placeholder="e.g., coding-helper, data-analyst"
                />
                {fields.slug?.errors && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {fields.slug.errors[0]}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.name?.id}>Name *</Label>
                <Input
                  {...(fields.name ? getInputProps(fields.name, { type: "text" }) : {})}
                  placeholder="e.g., Coding Helper, Data Analyst"
                />
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
                {...(fields.description ? getInputProps(fields.description, { type: "text" }) : {})}
                placeholder="Brief description of the assistant's purpose and capabilities..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.modelId?.id}>AI Model *</Label>
              <Select name={fields.modelId?.name}>
                <SelectTrigger>
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} ({model.provider.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fields.modelId?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.modelId.errors[0]}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={fields.status?.id}>Status *</Label>
                <Select name={fields.status?.name} defaultValue="active">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="deleted">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.mode?.id}>Mode *</Label>
                <Select name={fields.mode?.name} defaultValue="instant">
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant</SelectItem>
                    <SelectItem value="session">Session</SelectItem>
                    <SelectItem value="persistent">Persistent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.visibility?.id}>Visibility *</Label>
                <Select name={fields.visibility?.name} defaultValue="private">
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="shared">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.scope?.id}>Scope *</Label>
              <Select name={fields.scope?.name} defaultValue="user">
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.initMessages?.id}>Initial Messages (JSON)</Label>
              <Textarea
                {...(fields.initMessages ? getInputProps(fields.initMessages, { type: "text" }) : {})}
                placeholder='{"system": "You are a helpful assistant", "user": "Hello!"}'
                rows={4}
              />
              {fields.initMessages?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.initMessages.errors[0]}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.details?.id}>Additional Details (JSON)</Label>
              <Textarea
                {...(fields.details ? getInputProps(fields.details, { type: "text" }) : {})}
                placeholder='{"tags": ["coding", "helper"], "supportsRAG": true}'
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
                Create Assistant
              </Button>
              <Button variant="outline" asChild>
                <Link to="/assistants">Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
