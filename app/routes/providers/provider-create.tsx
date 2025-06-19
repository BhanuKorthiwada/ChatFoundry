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
import type { Route } from "./+types/provider-create";

const providerSchema = z.object({
  slug: z.string().min(1, "Slug is required").max(100),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  baseUrl: z.url("Must be a valid URL").optional().or(z.literal("")),
  apiVersion: z.string().optional(),
  status: z.enum(["active", "inactive", "deprecated"]),
  authType: z.enum(["api_key", "oauth", "none"]).optional(),
  headers: z.string().optional(), // JSON string
  rateLimits: z.string().optional(), // JSON string
});

export async function loader({ context }: Route.LoaderArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return {};
}

export async function action({ request, context }: Route.ActionArgs) {
  const authSession = context.get(authSessionContext);

  if (!authSession?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: providerSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  try {
    const { slug, name, description, baseUrl, apiVersion, status, authType, headers, rateLimits } = submission.value;

    // Check if slug already exists
    const existingProvider = await db.query.aiProviders.findFirst({
      where: (provider, { eq, and }) => and(eq(provider.slug, slug), eq(provider.isDeleted, false)),
    });

    if (existingProvider) {
      return data(
        {
          result: submission.reply({
            fieldErrors: { slug: ["A provider with this slug already exists"] },
          }),
        },
        { status: 400 },
      );
    }

    // Parse and validate JSON fields
    let parsedHeaders = null;
    let parsedRateLimits = null;

    if (headers?.trim()) {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch (_e) {
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

    if (rateLimits?.trim()) {
      try {
        parsedRateLimits = JSON.parse(rateLimits);
      } catch (_e) {
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

    // Build details object
    const details: Record<string, unknown> = {};
    if (authType) details.authType = authType;
    if (parsedHeaders) details.headers = parsedHeaders;
    if (parsedRateLimits) details.rateLimits = parsedRateLimits;

    await db.insert(schema.aiProviders).values({
      slug,
      name,
      description: description || null,
      baseUrl: baseUrl || null,
      apiVersion: apiVersion || null,
      status,
      details: Object.keys(details).length > 0 ? details : null,
      createdBy: authSession.user.id,
      updatedBy: authSession.user.id,
    });

    Logger.info("Provider created", { slug, name, createdBy: authSession.user.id });

    return redirect("/providers");
  } catch (error) {
    Logger.error("Error creating provider", { error });
    return data(
      {
        result: submission.reply({
          formErrors: ["Failed to create provider. Please try again."],
        }),
      },
      { status: 500 },
    );
  }
}

export default function ProviderCreateRoute(_: Route.ComponentProps) {
  const actionData = _.actionData;
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    constraint: getZodConstraint(providerSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/providers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Providers
            </Link>
          </Button>
          <div>
            <h1 className="font-bold text-2xl">Create New Provider</h1>
            <p className="text-muted-foreground">Add a new AI provider to your system</p>
          </div>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Provider Details</CardTitle>
          <CardDescription>Configure the basic information and settings for the new AI provider.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fields.slug?.id}>Slug *</Label>
                <Input
                  {...(fields.slug ? getInputProps(fields.slug, { type: "text" }) : {})}
                  placeholder="e.g., openai, anthropic"
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
                  placeholder="e.g., OpenAI, Anthropic"
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
                placeholder="Brief description of the provider..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fields.baseUrl?.id}>Base URL</Label>
                <Input
                  {...(fields.baseUrl ? getInputProps(fields.baseUrl, { type: "url" }) : {})}
                  placeholder="https://api.provider.com"
                />
                {fields.baseUrl?.errors && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {fields.baseUrl.errors[0]}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.apiVersion?.id}>API Version</Label>
                <Input
                  {...(fields.apiVersion ? getInputProps(fields.apiVersion, { type: "text" }) : {})}
                  placeholder="v1, 2024-01-01"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                {fields.status?.errors && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {fields.status.errors[0]}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.authType?.id}>Authentication Type</Label>
                <Select name={fields.authType?.name}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select auth type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="oauth">OAuth</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.headers?.id}>Headers (JSON)</Label>
              <Textarea
                {...(fields.headers ? getInputProps(fields.headers, { type: "text" }) : {})}
                placeholder='{"Content-Type": "application/json", "User-Agent": "MyApp/1.0"}'
                rows={3}
              />
              {fields.headers?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.headers.errors[0]}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.rateLimits?.id}>Rate Limits (JSON)</Label>
              <Textarea
                {...(fields.rateLimits ? getInputProps(fields.rateLimits, { type: "text" }) : {})}
                placeholder='{"requestsPerMinute": 100, "tokensPerMinute": 60000}'
                rows={3}
              />
              {fields.rateLimits?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.rateLimits.errors[0]}
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
                Create Provider
              </Button>
              <Button variant="outline" asChild>
                <Link to="/providers">Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
