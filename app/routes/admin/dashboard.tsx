import { env as cfEnv } from "cloudflare:workers";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { EyeIcon, EyeOffIcon, KeyIcon, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Form, useFetcher } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import { Logger } from "~/.server/log-service";
import { SecretService } from "~/.server/secret-service";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { SYSTEM_FLAGS, SYSTEM_SECRETS } from "~/lib/constants";
import type { Route } from "./+types/dashboard";

const flagUpdateSchema = z.object({
  flagKey: z.string(),
  enabled: z.preprocess((value) => {
    if (value === "on" || value === "true") return true;
    if (value === "false" || value === "" || value === undefined) return false;
    return Boolean(value);
  }, z.boolean()),
});

const secretUpdateSchema = z.object({
  action: z.enum(["update", "delete"]),
  secretKey: z.string().min(1, "Secret key is required"),
  secretValue: z.string().optional(),
});

const customSecretSchema = z.object({
  secretKey: z.string().min(1, "Secret key is required"),
  secretValue: z.string().min(1, "Secret value is required"),
});

const smtpConfigSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.coerce.number().int().min(1).max(65535, "Invalid port number"),
  secure: z.preprocess((value) => {
    if (value === "on" || value === "true") return true;
    if (value === "false" || value === "" || value === undefined) return false;
    return Boolean(value);
  }, z.boolean()),
  username: z.string().min(1, "SMTP username is required"),
  password: z.string().min(1, "SMTP password is required"),
  fromEmail: z.email("Invalid from email address"),
  fromName: z.string().optional(),
});

type LoaderData = {
  flags: Record<string, boolean>;
  flagDefinitions: typeof SYSTEM_FLAGS;
  secrets: Record<string, { exists: boolean; value?: string }>;
  secretDefinitions: typeof SYSTEM_SECRETS;
  smtpConfig?: {
    host?: string;
    port?: number;
    secure?: boolean;
    username?: string;
    fromEmail?: string;
    fromName?: string;
  };
  error?: string;
};

export async function loader(_: Route.LoaderArgs): Promise<LoaderData> {
  try {
    const flags: Record<string, boolean> = {};
    const secrets: Record<string, { exists: boolean; value?: string }> = {};
    const secretService = SecretService.getInstance();

    for (const flag of SYSTEM_FLAGS) {
      const value = await cfEnv.CF_KV.get(flag.key);
      flags[flag.key] = value === "true";
    }

    for (const secret of SYSTEM_SECRETS) {
      const value = await secretService.getSecret(secret.key);
      const exists = value !== undefined;

      secrets[secret.key] = {
        exists,
        value: exists && !secret.sensitive ? value : undefined,
      };
    }

    // Load SMTP configuration for display (without sensitive data)
    let smtpConfig: LoaderData["smtpConfig"] = undefined;
    try {
      const smtpConfigJson = await secretService.getSecret("CHATFOUNDRY__EMAIL__SMTP_CONFIG");
      if (smtpConfigJson) {
        const parsedConfig = JSON.parse(smtpConfigJson);
        smtpConfig = {
          host: parsedConfig.host,
          port: parsedConfig.port,
          secure: parsedConfig.secure,
          username: parsedConfig.username,
          fromEmail: parsedConfig.fromEmail,
          fromName: parsedConfig.fromName,
        };
      }
    } catch (error) {
      Logger.warn("Failed to load SMTP configuration:", error);
    }

    return {
      flags,
      flagDefinitions: SYSTEM_FLAGS,
      secrets,
      secretDefinitions: SYSTEM_SECRETS,
      smtpConfig,
    };
  } catch (error) {
    Logger.error("Error loading admin dashboard data:", error);
    return {
      flags: {},
      flagDefinitions: SYSTEM_FLAGS,
      secrets: {},
      secretDefinitions: SYSTEM_SECRETS,
      error: "Failed to load system data",
    };
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  if (actionType === "flag") {
    const submission = parseWithZod(formData, { schema: flagUpdateSchema });

    if (submission.status !== "success") {
      Logger.error("Invalid flag form data:", submission.error, submission.reply());
      return {
        result: submission.reply(),
        success: false,
        error: "Invalid form data",
      };
    }

    const { flagKey, enabled } = submission.value;

    try {
      if (enabled) {
        await cfEnv.CF_KV.put(flagKey, "true");
      } else {
        await cfEnv.CF_KV.delete(flagKey);
      }

      return {
        result: submission.reply(),
        success: true,
        message: `Flag "${flagKey}" ${enabled ? "enabled" : "disabled"} successfully`,
      };
    } catch (error) {
      Logger.error("Error updating flag:", error, submission.reply());
      return {
        result: submission.reply({
          formErrors: ["Failed to update flag. Please try again."],
        }),
        success: false,
        error: "Failed to update flag",
      };
    }
  }

  if (actionType === "secret") {
    const submission = parseWithZod(formData, { schema: secretUpdateSchema });

    if (submission.status !== "success") {
      Logger.error("Invalid secret form data:", submission.error, submission.reply());
      return {
        result: submission.reply(),
        success: false,
        error: "Invalid form data",
      };
    }

    const { action, secretKey, secretValue } = submission.value;
    const secretService = SecretService.getInstance();

    try {
      if (action === "delete") {
        await cfEnv.CF_KV.delete(secretKey);
        return {
          result: submission.reply(),
          success: true,
          message: `Secret "${secretKey}" deleted successfully`,
        };
      }

      if (action === "update") {
        if (!secretValue) {
          return {
            result: submission.reply({
              formErrors: ["Secret value is required for update action"],
            }),
            success: false,
            error: "Secret value is required",
          };
        }

        await secretService.setSecret(secretKey, secretValue);
        return {
          result: submission.reply(),
          success: true,
          message: `Secret "${secretKey}" updated successfully`,
        };
      }

      return {
        result: submission.reply(),
        success: false,
        error: "Invalid action",
      };
    } catch (error) {
      Logger.error("Error managing secret:", error, submission.reply());
      return {
        result: submission.reply({
          formErrors: ["Failed to manage secret. Please try again."],
        }),
        success: false,
        error: "Failed to manage secret",
      };
    }
  }

  if (actionType === "customSecret") {
    const submission = parseWithZod(formData, { schema: customSecretSchema });

    if (submission.status !== "success") {
      Logger.error("Invalid custom secret form data:", submission.error, submission.reply());
      return {
        result: submission.reply(),
        success: false,
        error: "Invalid form data",
      };
    }

    const { secretKey, secretValue } = submission.value;
    const secretService = SecretService.getInstance();

    try {
      await secretService.setSecret(secretKey, secretValue);
      return {
        result: submission.reply(),
        success: true,
        message: `Custom secret "${secretKey}" created/updated successfully`,
      };
    } catch (error) {
      Logger.error("Error creating custom secret:", error, submission.reply());
      return {
        result: submission.reply({
          formErrors: ["Failed to create custom secret. Please try again."],
        }),
        success: false,
        error: "Failed to create custom secret",
      };
    }
  }

  if (actionType === "smtpConfig") {
    const submission = parseWithZod(formData, { schema: smtpConfigSchema });

    if (submission.status !== "success") {
      Logger.error("Invalid SMTP config form data:", submission.error, submission.reply());
      return {
        result: submission.reply(),
        success: false,
        error: "Invalid form data",
      };
    }

    const smtpConfig = submission.value;
    const secretService = SecretService.getInstance();

    try {
      await secretService.setSecret("CHATFOUNDRY__EMAIL__SMTP_CONFIG", JSON.stringify(smtpConfig));
      return {
        result: submission.reply(),
        success: true,
        message: "SMTP configuration updated successfully",
      };
    } catch (error) {
      Logger.error("Error updating SMTP config:", error, submission.reply());
      return {
        result: submission.reply({
          formErrors: ["Failed to update SMTP configuration. Please try again."],
        }),
        success: false,
        error: "Failed to update SMTP configuration",
      };
    }
  }

  return {
    success: false,
    error: "Invalid action type",
  };
}

export default function AdminDashboardRoute(_: Route.ComponentProps) {
  const [form, fields] = useForm({
    constraint: getZodConstraint(flagUpdateSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: flagUpdateSchema });
    },
  });

  const [secretForm, secretFields] = useForm({
    constraint: getZodConstraint(customSecretSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: customSecretSchema });
    },
  });

  const [smtpForm, smtpFields] = useForm({
    constraint: getZodConstraint(smtpConfigSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: smtpConfigSchema });
    },
  });

  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const fetcher = useFetcher();

  const flagsByCategory = _.loaderData.flagDefinitions.reduce(
    (acc, flag) => {
      if (!acc[flag.category]) {
        acc[flag.category] = [];
      }
      acc[flag.category]?.push(flag);
      return acc;
    },
    {} as Record<string, Array<(typeof SYSTEM_FLAGS)[number]>>,
  );

  const secretsByCategory = _.loaderData.secretDefinitions.reduce(
    (acc, secret) => {
      if (!acc[secret.category]) {
        acc[secret.category] = [];
      }
      acc[secret.category]?.push(secret);
      return acc;
    },
    {} as Record<string, Array<(typeof SYSTEM_SECRETS)[number]>>,
  );

  useEffect(() => {
    if (_.loaderData.error) {
      toast.error(_.loaderData.error);
    }
  }, [_.loaderData.error]);

  useEffect(() => {
    if (_.actionData?.success && "message" in _.actionData) {
      toast.success(_.actionData.message);
    } else if (_.actionData && !_.actionData.success && "error" in _.actionData) {
      toast.error(_.actionData.error);
    }
  }, [_.actionData]);

  useEffect(() => {
    if (fetcher.data?.success && "message" in fetcher.data) {
      toast.success(fetcher.data.message);
    } else if (fetcher.data && !fetcher.data.success && "error" in fetcher.data) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.data]);

  const handleFlagToggle = (flagKey: string, enabled: boolean) => {
    fetcher.submit(
      { actionType: "flag", flagKey, enabled: enabled.toString() },
      {
        method: "post",
        action: "/admin/dashboard",
      },
    );
  };

  const handleSecretUpdate = (secretKey: string, value: string) => {
    fetcher.submit(
      { actionType: "secret", action: "update", secretKey, secretValue: value },
      {
        method: "post",
        action: "/admin/dashboard",
      },
    );
  };

  const handleSecretDelete = (secretKey: string) => {
    if (confirm(`Are you sure you want to delete the secret "${secretKey}"?`)) {
      fetcher.submit(
        { actionType: "secret", action: "delete", secretKey },
        {
          method: "post",
          action: "/admin/dashboard",
        },
      );
    }
  };

  const toggleSecretVisibility = (secretKey: string) => {
    setVisibleSecrets((prev) => ({
      ...prev,
      [secretKey]: !prev[secretKey],
    }));
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="font-bold text-3xl">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="flags" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="flags" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            System Flags
          </TabsTrigger>
          <TabsTrigger value="secrets" className="flex items-center gap-2">
            <KeyIcon className="h-4 w-4" />
            Secrets
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Custom
          </TabsTrigger>
        </TabsList>

        {/* System Flags Tab */}
        <TabsContent value="flags" className="space-y-6">
          <div className="grid gap-6">
            {Object.entries(flagsByCategory).map(([category, categoryFlags]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{category} Flags</CardTitle>
                  <CardDescription>Manage {category.toLowerCase()} related system flags</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryFlags.map((flag) => {
                      const isEnabled = Boolean(_.loaderData.flags[flag.key]);
                      return (
                        <div key={flag.key} className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-1">
                            <Label htmlFor={flag.key} className="font-medium text-sm">
                              {flag.name}
                            </Label>
                            <p className="text-muted-foreground text-sm">{flag.description}</p>
                            <p className="font-mono text-muted-foreground text-xs">{flag.key}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">{isEnabled ? "Enabled" : "Disabled"}</span>
                            <Switch
                              id={flag.key}
                              checked={isEnabled}
                              onCheckedChange={(checked: boolean) => handleFlagToggle(flag.key, checked)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Secrets Management Tab */}
        <TabsContent value="secrets" className="space-y-6">
          <div className="grid gap-6">
            {Object.entries(secretsByCategory).map(([category, categorySecrets]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{category} Secrets</CardTitle>
                  <CardDescription>Manage {category.toLowerCase()} secrets and API keys</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categorySecrets.map((secret) => {
                      const secretData = _.loaderData.secrets[secret.key];
                      const isVisible = visibleSecrets[secret.key];

                      return (
                        <div key={secret.key} className="rounded-lg border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <Label className="font-medium text-sm">{secret.name}</Label>
                                <p className="text-muted-foreground text-sm">{secret.description}</p>
                                <p className="font-mono text-muted-foreground text-xs">{secret.key}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-sm ${secretData?.exists ? "text-green-600" : "text-orange-600"}`}
                                >
                                  {secretData?.exists ? "Set" : "Not Set"}
                                </span>
                                {secret.sensitive && secretData?.exists && (
                                  <Button variant="ghost" size="sm" onClick={() => toggleSecretVisibility(secret.key)}>
                                    {isVisible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const formData = new FormData(e.currentTarget);
                                  const value = formData.get("value") as string;
                                  if (value) {
                                    handleSecretUpdate(secret.key, value);
                                    (e.currentTarget as HTMLFormElement).reset();
                                  }
                                }}
                                className="flex gap-2"
                              >
                                <div className="flex-1">
                                  {secret.sensitive ? (
                                    <Input
                                      key={`${secret.key}-${isVisible}`}
                                      name="value"
                                      type={isVisible ? "text" : "password"}
                                      placeholder={
                                        secretData?.exists ? "Enter new value to update..." : "Enter value..."
                                      }
                                      className="font-mono text-sm"
                                    />
                                  ) : (
                                    <Input
                                      name="value"
                                      type="text"
                                      defaultValue={secretData?.value || ""}
                                      placeholder="Enter value..."
                                      className="font-mono text-sm"
                                    />
                                  )}
                                </div>
                                <Button type="submit" size="sm">
                                  {secretData?.exists ? "Update" : "Set"}
                                </Button>
                                {secretData?.exists && (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleSecretDelete(secret.key)}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </Form>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Custom Management Tab */}
        <TabsContent value="custom" className="space-y-6">
          <div className="grid gap-6">
            {/* SMTP Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  SMTP Configuration
                  <span className={`text-sm ${_.loaderData.smtpConfig ? "text-green-600" : "text-orange-600"}`}>
                    {_.loaderData.smtpConfig ? "Configured" : "Not Configured"}
                  </span>
                </CardTitle>
                <CardDescription>
                  Configure email service settings (stored as encrypted JSON). Falls back to legacy configuration if not
                  set.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="POST" {...getFormProps(smtpForm)}>
                  <input type="hidden" name="actionType" value="smtpConfig" />
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="smtpHost">SMTP Host</Label>
                        <Input
                          {...getInputProps(smtpFields.host, { type: "text" })}
                          placeholder="smtp.example.com"
                          defaultValue={_.loaderData.smtpConfig?.host || ""}
                        />
                        {smtpFields.host.errors && <p className="text-destructive text-sm">{smtpFields.host.errors}</p>}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="smtpPort">SMTP Port</Label>
                        <Input
                          {...getInputProps(smtpFields.port, { type: "number" })}
                          placeholder="465"
                          defaultValue={_.loaderData.smtpConfig?.port?.toString() || ""}
                        />
                        {smtpFields.port.errors && <p className="text-destructive text-sm">{smtpFields.port.errors}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="smtpUsername">Username</Label>
                        <Input
                          {...getInputProps(smtpFields.username, { type: "text" })}
                          placeholder="username"
                          defaultValue={_.loaderData.smtpConfig?.username || ""}
                        />
                        {smtpFields.username.errors && (
                          <p className="text-destructive text-sm">{smtpFields.username.errors}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="smtpPassword">Password</Label>
                        <Input {...getInputProps(smtpFields.password, { type: "password" })} placeholder="password" />
                        {smtpFields.password.errors && (
                          <p className="text-destructive text-sm">{smtpFields.password.errors}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="smtpFromEmail">From Email</Label>
                        <Input
                          {...getInputProps(smtpFields.fromEmail, { type: "email" })}
                          placeholder="noreply@example.com"
                          defaultValue={_.loaderData.smtpConfig?.fromEmail || ""}
                        />
                        {smtpFields.fromEmail.errors && (
                          <p className="text-destructive text-sm">{smtpFields.fromEmail.errors}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="smtpFromName">From Name (optional)</Label>
                        <Input
                          {...getInputProps(smtpFields.fromName, { type: "text" })}
                          placeholder="My App"
                          defaultValue={_.loaderData.smtpConfig?.fromName || ""}
                        />
                        {smtpFields.fromName.errors && (
                          <p className="text-destructive text-sm">{smtpFields.fromName.errors}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        {...getInputProps(smtpFields.secure, { type: "checkbox" })}
                        id="smtpSecure"
                        className="h-4 w-4 rounded border border-input"
                        defaultChecked={_.loaderData.smtpConfig?.secure ?? true}
                      />
                      <Label htmlFor="smtpSecure">Use SSL/TLS (secure connection)</Label>
                    </div>
                    <Button type="submit">Update SMTP Configuration</Button>
                  </div>
                </Form>
              </CardContent>
            </Card>

            {/* Custom Secret Management */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Secret Management</CardTitle>
                <CardDescription>Add or update custom secrets not listed above</CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="POST" {...getFormProps(secretForm)}>
                  <input type="hidden" name="actionType" value="customSecret" />
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="customSecretKey">Secret Key</Label>
                      <Input
                        {...getInputProps(secretFields.secretKey, { type: "text" })}
                        placeholder="e.g., CHATFOUNDRY__CUSTOM__API_KEY"
                        className="font-mono"
                      />
                      {secretFields.secretKey.errors && (
                        <p className="text-destructive text-sm">{secretFields.secretKey.errors}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="customSecretValue">Secret Value</Label>
                      <Textarea
                        {...getInputProps(secretFields.secretValue, { type: "text" })}
                        placeholder="Enter the secret value..."
                        className="font-mono"
                        rows={3}
                      />
                      {secretFields.secretValue.errors && (
                        <p className="text-destructive text-sm">{secretFields.secretValue.errors}</p>
                      )}
                    </div>
                    <Button type="submit">Create/Update Secret</Button>
                  </div>
                </Form>
              </CardContent>
            </Card>

            {/* Manual Flag Management */}
            <Card>
              <CardHeader>
                <CardTitle>Manual Flag Management</CardTitle>
                <CardDescription>Add or update custom flags not listed above</CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="POST" {...getFormProps(form)}>
                  <input type="hidden" name="actionType" value="flag" />
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="customFlagKey">Flag Key</Label>
                      <Input
                        {...getInputProps(fields.flagKey, { type: "text" })}
                        placeholder="e.g., global:custom_feature"
                        className="font-mono"
                      />
                      {fields.flagKey.errors && <p className="text-destructive text-sm">{fields.flagKey.errors}</p>}
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        {...getInputProps(fields.enabled, { type: "checkbox" })}
                        id="enabled"
                        className="h-4 w-4 rounded border border-input"
                      />
                      <Label htmlFor="enabled">Enable flag</Label>
                    </div>
                    <Button type="submit">Update Flag</Button>
                  </div>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
