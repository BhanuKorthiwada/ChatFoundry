import { env as cfEnv } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { EmailService } from "~/.server/email-service";
import { db } from "~/lib/database/db.server";

let _auth: ReturnType<typeof betterAuth>;

export async function deleteUserImageFromR2(imageUrl: string | null) {
  if (!imageUrl) return;

  const isExternalUrl = imageUrl.startsWith("http://") || imageUrl.startsWith("https://");

  if (!isExternalUrl) {
    let r2ObjectKey = imageUrl;
    const queryParamIndex = r2ObjectKey.indexOf("?"); // remove query params
    if (queryParamIndex !== -1) {
      r2ObjectKey = r2ObjectKey.substring(0, queryParamIndex);
    }
    if (r2ObjectKey) {
      await cfEnv.CF_R2.delete(r2ObjectKey);
    }
  }
}

export function serverAuth() {
  if (!_auth) {
    _auth = betterAuth({
      appName: "ChatFoundry",
      baseUrl: cfEnv.BETTER_AUTH_URL,
      trustedOrigins: [cfEnv.BETTER_AUTH_URL],
      database: drizzleAdapter(db, {
        provider: "sqlite",
      }),
      secondaryStorage: {
        get: async (key) => await cfEnv.CF_KV.get(`_auth:${key}`, "json"),
        set: async (key, value, ttl) =>
          await cfEnv.CF_KV.put(`_auth:${key}`, JSON.stringify(value), {
            expirationTtl: ttl,
          }),
        delete: async (key) => await cfEnv.CF_KV.delete(`_auth:${key}`),
      },
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url, token }) => {
          if (cfEnv.ENVIRONMENT === "development") {
            console.log("Send email to reset password");
            console.log("User", user);
            console.log("URL", url);
            console.log("Token", token);
          }
          const emailService = new EmailService();
          await emailService.sendPasswordResetEmail({
            to: user.email,
            token,
          });
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url, token }) => {
          if (cfEnv.ENVIRONMENT === "development") {
            console.log("Send email to verify email address");
            console.log(user, url, token);
          }
          const emailService = new EmailService();
          await emailService.sendVerificationEmail({
            to: user.email,
            token,
          });
        },
      },
      socialProviders: {
        github: {
          clientId: cfEnv.GITHUB_CLIENT_ID || "",
          clientSecret: cfEnv.GITHUB_CLIENT_SECRET || "",
        },
        // google: {
        //   clientId: cfEnv.GOOGLE_CLIENT_ID || "",
        //   clientSecret: cfEnv.GOOGLE_CLIENT_SECRET || "",
        // },
      },
      account: {
        accountLinking: {
          enabled: true,
          allowDifferentEmails: true,
          trustedProviders: ["google", "github"],
        },
      },
      user: {
        deleteUser: {
          enabled: true,
          afterDelete: async (user) => {
            if (user.image) {
              await deleteUserImageFromR2(user.image);
            }
          },
        },
      },
      rateLimit: {
        enabled: true,
        storage: "secondary-storage",
        window: 60, // time window in seconds
        max: 10, // max requests in the window
      },
      advanced: {
        ipAddress: {
          ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"],
        },
        database: {
          generateId: () => {
            return crypto.randomUUID();
          },
        },
        cookiePrefix: "cf",
      },
    });
  }

  return _auth;
}
