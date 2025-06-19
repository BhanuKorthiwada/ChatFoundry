import { env as cfEnv } from "cloudflare:workers";
import { WorkerMailer } from "worker-mailer";
import { z } from "zod/v4";
import { AppInfo } from "~/lib/config";
import { SecretService } from "./secret-service";

// SMTP Configuration schema
const smtpConfigSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().int().min(1).max(65535, "Invalid port number"),
  secure: z.boolean().default(true),
  username: z.string().min(1, "SMTP username is required"),
  password: z.string().min(1, "SMTP password is required"),
  fromEmail: z.email("Invalid from email address").optional(),
  fromName: z.string().optional(),
});

type SMTPConfig = z.infer<typeof smtpConfigSchema>;

// Default SMTP configuration
const DEFAULT_SMTP_CONFIG: SMTPConfig = {
  host: "smtp.zeptomail.eu",
  port: 465,
  secure: true,
  username: "emailapikey",
  password: "",
  fromEmail: "identity@use.chatfoundry.app",
  fromName: "ChatFoundry App",
};

export class EmailService {
  private async getSMTPConfig(): Promise<SMTPConfig> {
    const secretService = SecretService.getInstance();

    try {
      const smtpConfigJson = await secretService.getSecret("CHATFOUNDRY__EMAIL__SMTP_CONFIG");

      if (smtpConfigJson) {
        const parsedConfig = JSON.parse(smtpConfigJson);
        const validatedConfig = smtpConfigSchema.parse(parsedConfig);
        return validatedConfig;
      }
    } catch (error) {
      console.warn("Failed to parse SMTP config from secret storage, falling back to legacy config:", error);
    }

    // Fallback to legacy configuration
    const fallbackSmtpPass = await cfEnv.CF_KV.get("global:config:smtp_pass", "text");
    const fallbackFromEmail = await cfEnv.CF_KV.get("global:config:identity_from_email", "text");

    return {
      ...DEFAULT_SMTP_CONFIG,
      password: fallbackSmtpPass || "",
      fromEmail: fallbackFromEmail || DEFAULT_SMTP_CONFIG.fromEmail,
    };
  }
  generateEmail({
    subject,
    message,
    actionUrl,
    actionText,
  }: {
    subject: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  }): { html: string; text: string } {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto;">
        <div style="margin-bottom: 30px;">
            <h2 style="color: #2563eb; margin: 0;">${subject}</h2>
        </div>

        <div style="margin-bottom: 30px;">
            ${message}
        </div>

        ${
          actionUrl && actionText
            ? `
        <div style="margin: 30px 0;">
            <a href="${actionUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">${actionText}</a>
        </div>
        `
            : ""
        }

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
            <p>Best regards,<br>ChatFoundry Team</p>
        </div>
    </div>
</body>
</html>`;

    const text = `${subject}

${message
  .replace(/<[^>]*>/g, "")
  .replace(/\s+/g, " ")
  .trim()}

${actionUrl && actionText ? `${actionText}: ${actionUrl}` : ""}

Best regards,
ChatFoundry Team`;

    return { html, text };
  }
  async sendEmail({
    from,
    to,
    subject,
    body,
  }: {
    from: string;
    to: string[];
    subject: string;
    body: string;
  }): Promise<void> {
    const smtpConfig = await this.getSMTPConfig();

    if (!from) {
      from = `"${smtpConfig.fromName || "ChatFoundry App"}" <${smtpConfig.fromEmail}>`;
    }

    if (!from || !to.length || !subject || !body) {
      throw new Error("Missing required email parameters");
    }

    if (!z.email().array().min(1).safeParse(to).success || !z.email().safeParse(from).success) {
      throw new Error("Invalid email addresses provided");
    }

    if (!smtpConfig.password) {
      throw new Error("SMTP password not configured");
    }

    const mailer = await WorkerMailer.connect({
      credentials: {
        username: smtpConfig.username,
        password: smtpConfig.password,
      },
      authType: "plain",
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
    });

    await mailer.send({
      from: {
        name: smtpConfig.fromName || "ChatFoundry App",
        email: smtpConfig.fromEmail || "identity@use.chatfoundry.app",
      },
      to: to.join(","),
      subject,
      text: body,
      html: body,
    });
  }
  async sendVerificationEmail({
    to,
    token,
  }: {
    to: string;
    token: string;
  }): Promise<void> {
    const smtpConfig = await this.getSMTPConfig();
    const fromEmail = smtpConfig.fromEmail || AppInfo.defaults.fromEmail;

    const url = cfEnv.BETTER_AUTH_URL;
    const verificationUrl = `${url}/verify-email?token=${token}`;

    const email = this.generateEmail({
      subject: "Verify Your Email",
      message: "<p>Please verify your email address to complete your account setup.</p>",
      actionUrl: verificationUrl,
      actionText: "Verify Email",
    });

    await this.sendEmail({
      from: fromEmail,
      to: [to],
      subject: "Verify Your Email",
      body: email.html,
    });
  }
  async sendPasswordResetEmail({
    to,
    token,
  }: {
    to: string;
    token: string;
  }): Promise<void> {
    const smtpConfig = await this.getSMTPConfig();
    const fromEmail = smtpConfig.fromEmail || AppInfo.defaults.fromEmail;

    const url = cfEnv.BETTER_AUTH_URL;
    const resetUrl = `${url}/reset-password?token=${token}`;

    const email = this.generateEmail({
      subject: "Reset Your Password",
      message:
        "<p>We received a request to reset your password. Click the button below to reset it.</p><p>If you didn't request this, you can safely ignore this email.</p>",
      actionUrl: resetUrl,
      actionText: "Reset Password",
    });

    await this.sendEmail({
      from: fromEmail,
      to: [to],
      subject: "Reset Your Password",
      body: email.html,
    });
  }
}
