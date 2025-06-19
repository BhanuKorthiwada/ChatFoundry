import {
  getFormProps,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useForm,
  useInputControl,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { AlertCircle, ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod/v4";
import { Logger } from "~/.server/log-service";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { authSessionContext } from "~/lib/contexts";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import { authMiddleware } from "~/lib/middlewares/auth-guard.server";
import type { Route } from "./+types/assistant-create";

export const unstable_middleware = [authMiddleware];

const assistantSchema = z.object({
  intent: z.enum(["create"]),
  slug: z.string().min(1, "Slug is required").max(50),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  tags: z.string().optional(),
  systemPrompt: z.string().optional(),
  modelId: z.string().min(1, "Model is required"),
  mode: z.enum(["instant", "session", "persistent"]).default("instant"),
  visibility: z.enum(["public", "private", "shared"]).default("private"),
  scope: z.enum(["global", "team", "user"]).default("user"),
  supportsRAG: z.boolean().optional(),
  avatar: z.string().optional(),
});

export async function loader(_: Route.LoaderArgs) {
  try {
    const models = await db.query.aiModels.findMany({
      where: (t, { eq, and }) => and(eq(t.isDeleted, false), eq(t.status, "active")),
      orderBy: (t, { asc }) => asc(t.name),
    });

    const assistants = await db.query.aiAssistants.findMany({
      where: (t, { eq }) => eq(t.isDeleted, false),
      columns: {
        details: true,
      },
    });

    const categories = new Set<string>();
    for (const assistant of assistants) {
      if (assistant.details?.category) {
        categories.add(assistant.details.category);
      }
    }

    return {
      models,
      categories: Array.from(categories).sort(),
    };
  } catch (error) {
    console.error("Error loading assistant creation data:", error);
    throw new Response("Failed to load data", { status: 500 });
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw redirect("/auth/signin?returnUrl=/assistants/assistant-create");
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: assistantSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const { intent } = submission.value;

  try {
    switch (intent) {
      case "create": {
        let parsedTags: string[] = [];
        if (submission.value.tags) {
          try {
            parsedTags = JSON.parse(submission.value.tags);
          } catch {
            return data(
              { result: submission.reply({ fieldErrors: { tags: ["Invalid tags format"] } }) },
              { status: 400 },
            );
          }
        }

        await db.insert(schema.aiAssistants).values({
          slug: submission.value.slug,
          name: submission.value.name,
          description: submission.value.description || "",
          mode: submission.value.mode,
          visibility: submission.value.visibility,
          scope: submission.value.scope,
          modelId: submission.value.modelId,
          details: {
            category: submission.value.category,
            tags: parsedTags,
            supportsRAG: submission.value.supportsRAG || false,
            avatar: submission.value.avatar || "",
            systemPrompt: submission.value.systemPrompt || "",
          },
          initMessages: submission.value.systemPrompt
            ? [
                {
                  role: "system" as const,
                  content: submission.value.systemPrompt,
                },
              ]
            : [],
          createdBy: authSession.user.id,
          updatedBy: authSession.user.id,
        });

        Logger.info("AI Assistant created", {
          slug: submission.value.slug,
          name: submission.value.name,
          createdBy: authSession.user.id,
        });
        throw redirect("/assistants");
      }
    }

    return data({ result: submission.reply() });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    Logger.error("AI Assistant creation failed", { intent, error });
    return data({ result: submission.reply({ formErrors: ["Creation failed. Please try again."] }) }, { status: 500 });
  }
}

export default function AssistantCreateRoute(_: Route.ComponentProps) {
  const { models, categories } = _.loaderData;
  const actionData = _.actionData;

  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const [form, fields] = useForm({
    // Sync server validation results
    lastResult: actionData?.result,

    // Validation configuration - best practice
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",

    // Validation constraints from schema
    constraint: getZodConstraint(assistantSchema),

    // Client-side validation
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: assistantSchema });
    },

    // Default values
    defaultValue: {
      intent: "create",
      mode: "instant",
      visibility: "private",
      scope: "user",
    },
  });

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags((prev) => [...prev, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const generateSlug = (name: string) => {
    if (!name) return "";

    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim();
  };

  const slugControl = useInputControl(fields.slug);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!isSlugManuallyEdited) {
      const newSlug = generateSlug(name);
      slugControl.change(newSlug);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSlug = e.target.value;
    slugControl.change(newSlug);
    if (newSlug !== generateSlug(fields.name.value || "")) {
      setIsSlugManuallyEdited(true);
    }
  };

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
            <input type="hidden" name="tags" value={JSON.stringify(tags)} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fields.slug?.id}>Slug *</Label>
                <Input
                  {...getInputProps(fields.slug, { type: "text" })}
                  placeholder="my-ai-assistant"
                  value={slugControl.value}
                  onChange={handleSlugChange}
                  onBlur={slugControl.blur}
                  onFocus={slugControl.focus}
                />
                <div id={fields.slug?.errorId} className="text-destructive text-sm">
                  {fields.slug?.errors}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.name?.id}>Name *</Label>
                <Input
                  {...getInputProps(fields.name, { type: "text" })}
                  placeholder="My AI Assistant"
                  onChange={handleNameChange}
                />
                <div id={fields.name?.errorId} className="text-destructive text-sm">
                  {fields.name?.errors}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.description?.id}>Description</Label>
              <Textarea
                {...getTextareaProps(fields.description)}
                placeholder="Describe what this assistant does..."
                rows={3}
              />
              <div id={fields.description?.errorId} className="text-destructive text-sm">
                {fields.description?.errors}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fields.category?.id}>Category *</Label>
                <Select name={fields.category?.name}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Writing">Writing</SelectItem>
                    <SelectItem value="Programming">Programming</SelectItem>
                    <SelectItem value="Research">Research</SelectItem>
                    <SelectItem value="Analysis">Analysis</SelectItem>
                    <SelectItem value="Creative">Creative</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Tools">Tools</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    {categories
                      .filter(
                        (cat) =>
                          ![
                            "Writing",
                            "Programming",
                            "Research",
                            "Analysis",
                            "Creative",
                            "Support",
                            "Tools",
                            "Other",
                          ].includes(cat),
                      )
                      .map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div id={fields.category?.errorId} className="text-destructive text-sm">
                  {fields.category?.errors}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.modelId?.id}>Model *</Label>
                <Select name={fields.modelId?.name}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div id={fields.modelId?.errorId} className="text-destructive text-sm">
                  {fields.modelId?.errors}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add tag..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" onClick={addTag}>
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-1 text-xs">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={fields.mode?.id}>Mode</Label>
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
                <div id={fields.mode?.errorId} className="text-destructive text-sm">
                  {fields.mode?.errors}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.visibility?.id}>Visibility</Label>
                <Select name={fields.visibility?.name} defaultValue="private">
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="shared">Shared</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
                <div id={fields.visibility?.errorId} className="text-destructive text-sm">
                  {fields.visibility?.errors}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.scope?.id}>Scope</Label>
                <Select name={fields.scope?.name} defaultValue="user">
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Personal</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
                <div id={fields.scope?.errorId} className="text-destructive text-sm">
                  {fields.scope?.errors}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch name="supportsRAG" />
              <Label htmlFor="supportsRAG">Supports RAG (Retrieval-Augmented Generation)</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.systemPrompt?.id}>System Prompt</Label>
              <Textarea
                {...getTextareaProps(fields.systemPrompt)}
                placeholder="You are a helpful assistant that..."
                rows={6}
              />
              <div id={fields.systemPrompt?.errorId} className="text-destructive text-sm">
                {fields.systemPrompt?.errors}
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

            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" name="intent" value="create" className="flex items-center gap-2">
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
