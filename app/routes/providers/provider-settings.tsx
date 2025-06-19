import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { AlertCircle, Save } from "lucide-react";
import { Form, data, redirect } from "react-router";
import { z } from "zod/v4";
import { SecretService } from "~/.server/secret-service";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authSessionContext } from "~/lib/contexts";
import type { Route } from "./+types/provider-settings";

const ProviderSettingsSchema = z.object({
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
  openrouterApiKey: z.string().optional(),
});

export async function loader({ context }: Route.LoaderArgs) {
  const authSession = context.get(authSessionContext);
  if (!authSession?.user?.id) {
    throw redirect("/login");
  }

  const secretService = SecretService.getInstance();
  const [hasOpenAIKey, hasAnthropicKey, hasGoogleKey, hasOpenRouterKey] = await Promise.all([
    secretService.hasSecret(`user:${authSession.user.id}:openai_api_key`),
    secretService.hasSecret(`user:${authSession.user.id}:anthropic_api_key`),
    secretService.hasSecret(`user:${authSession.user.id}:google_api_key`),
    secretService.hasSecret(`user:${authSession.user.id}:openrouter_api_key`),
  ]);

  return {
    hasOpenAIKey,
    hasAnthropicKey,
    hasGoogleKey,
    hasOpenRouterKey,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const authSession = context.get(authSessionContext);
  if (!authSession?.user?.id) {
    throw redirect("/login");
  }
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: ProviderSettingsSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const secretService = SecretService.getInstance();
  const { openaiApiKey, anthropicApiKey, googleApiKey, openrouterApiKey } = submission.value;

  if (openaiApiKey) {
    await secretService.setSecret(`user:${authSession.user.id}:openai_api_key`, openaiApiKey);
  }
  if (anthropicApiKey) {
    await secretService.setSecret(`user:${authSession.user.id}:anthropic_api_key`, anthropicApiKey);
  }
  if (googleApiKey) {
    await secretService.setSecret(`user:${authSession.user.id}:google_api_key`, googleApiKey);
  }
  if (openrouterApiKey) {
    await secretService.setSecret(`user:${authSession.user.id}:openrouter_api_key`, openrouterApiKey);
  }

  return redirect("/providers/provider-settings");
}

export default function ProviderSettingsRoute(_: Route.ComponentProps) {
  const { hasOpenAIKey, hasAnthropicKey, hasGoogleKey, hasOpenRouterKey } = _.loaderData;
  const actionData = _.actionData;
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    constraint: getZodConstraint(ProviderSettingsSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const renderKeyStatus = (hasKey: boolean) => {
    return <span className="ml-2 text-muted-foreground text-xs">{hasKey ? "✅ Key is set" : "❌ Key not set"}</span>;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="font-bold text-2xl">Provider API Keys</h1>
        <p className="text-muted-foreground">
          Manage your personal API keys for various AI providers. These keys are stored securely and used for your
          requests.
        </p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Enter your API keys below. They will be stored securely. Leave blank to keep the existing key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form method="post" {...getFormProps(form)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor={fields.openaiApiKey?.id}>OpenAI API Key</Label>
              <Input
                {...(fields.openaiApiKey ? getInputProps(fields.openaiApiKey, { type: "password" }) : {})}
                placeholder="Enter your OpenAI API Key"
              />
              {renderKeyStatus(hasOpenAIKey)}
              {fields.openaiApiKey?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.openaiApiKey.errors[0]}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={fields.anthropicApiKey?.id}>Anthropic API Key</Label>
              <Input
                {...(fields.anthropicApiKey ? getInputProps(fields.anthropicApiKey, { type: "password" }) : {})}
                placeholder="Enter your Anthropic API Key"
              />
              {renderKeyStatus(hasAnthropicKey)}
              {fields.anthropicApiKey?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.anthropicApiKey.errors[0]}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={fields.googleApiKey?.id}>Google API Key</Label>
              <Input
                {...(fields.googleApiKey ? getInputProps(fields.googleApiKey, { type: "password" }) : {})}
                placeholder="Enter your Google API Key"
              />
              {renderKeyStatus(hasGoogleKey)}
              {fields.googleApiKey?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.googleApiKey.errors[0]}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={fields.openrouterApiKey?.id}>OpenRouter API Key</Label>
              <Input
                {...(fields.openrouterApiKey ? getInputProps(fields.openrouterApiKey, { type: "password" }) : {})}
                placeholder="Enter your OpenRouter API Key"
              />
              {renderKeyStatus(hasOpenRouterKey)}
              {fields.openrouterApiKey?.errors && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {fields.openrouterApiKey.errors[0]}
                </div>
              )}
            </div>
            {form.errors && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {form.errors[0]}
              </div>
            )}
            <CardFooter className="p-0 pt-4">
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Keys
              </Button>
            </CardFooter>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
