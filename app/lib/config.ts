import type { FC, SVGProps } from "react";
import { GithubIcon } from "~/components/icons";

/**
 * App info
 */
export const AppInfo = {
  name: "ChatFoundry",
  description: "ChatFoundry is an open-source, cloudflare self-hosted personal AI platform",
  defaults: {
    fromEmail: "identity@use.chatfoundry.app",
  },
} as const;

/**
 * Social provider configs
 */
// 1. social provider configs (note: this provider configuration should be synchronized with `~/lib/auth/auth.server.ts`)
export const SOCIAL_PROVIDER_CONFIGS = [
  {
    id: "github",
    name: "GitHub",
    icon: GithubIcon,
  },
  // {
  //   id: "google",
  //   name: "Google",
  //   icon: GoogleIcon,
  // },
] as const;

// 2. Derive type from configs
export type AllowedProvider = (typeof SOCIAL_PROVIDER_CONFIGS)[number]["id"];
export type SocialProviderConfig = {
  id: AllowedProvider;
  name: string;
  icon: FC<SVGProps<SVGSVGElement>>;
};

// 3. Use z.enum needed string tuple format
// This approach is closest to the original code's intent and solves the type issue
export const ALLOWED_PROVIDERS = [
  SOCIAL_PROVIDER_CONFIGS[0].id,
  ...SOCIAL_PROVIDER_CONFIGS.slice(1).map((config) => config.id),
] as const;

export const CHAT_CONFIG = {
  maxMessages: 100,
  storeName: "conversations",
  dbName: "chatfoundry",
};
