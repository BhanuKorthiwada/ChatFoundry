export const AI_PROVIDER_CODES = {
  openai: "openai",
  azureOpenAI: "azure_openai",
  google: "google",
  anthropic: "anthropic",
  cloudflare: "cloudflare",
  openai_api_compatible: "openai_api_compatible",
} as const;

const AI_PROVIDERS = [
  {
    slug: AI_PROVIDER_CODES.openai,
    name: "OpenAI",
    details: {
      authType: "api_key",
      credentialsSchema: {
        apiKey: {
          type: "string",
          description: "API key for authentication",
        },
      },
    },
  },
  {
    slug: AI_PROVIDER_CODES.azureOpenAI,
    name: "Azure OpenAI",
    details: {
      authType: "api_key",
      credentialsSchema: {
        apiKey: {
          type: "string",
          description: "API key for authentication",
        },
      },
    },
  },
  {
    slug: AI_PROVIDER_CODES.google,
    name: "Google",
    details: {
      authType: "api_key",
      credentialsSchema: {
        apiKey: {
          type: "string",
          description: "API key for authentication",
        },
      },
    },
  },
  {
    slug: AI_PROVIDER_CODES.anthropic,
    name: "Anthropic",
    details: {
      authType: "api_key",
      credentialsSchema: {
        apiKey: {
          type: "string",
          description: "API key for authentication",
        },
      },
    },
  },
  {
    slug: AI_PROVIDER_CODES.openai_api_compatible,
    name: "OpenAI API Compatible",
    details: {
      authType: "api_key",
      credentialsSchema: {
        apiKey: {
          type: "string",
          description: "API key for authentication",
        },
      },
    },
  },
] as const;

const AI_MODELS = [
  {
    modelSlug: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    providerSlug: AI_PROVIDER_CODES.openai,
    aliases: ["gpt-4.1-nano"],
    isPreview: true,
    isPremium: false,
  },
  {
    modelSlug: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    providerSlug: AI_PROVIDER_CODES.openai,
    aliases: ["gpt-4.1-mini"],
    isPreview: true,
    isPremium: false,
  },
  {
    modelSlug: "gpt-4.1",
    name: "GPT-4.1",
    providerSlug: AI_PROVIDER_CODES.openai,
    aliases: ["gpt-4.1"],
    isPreview: false,
    isPremium: false,
  },
  {
    modelSlug: "gpt-4o",
    name: "GPT-4o",
    providerSlug: AI_PROVIDER_CODES.openai,
    aliases: ["gpt-4o", "gpt-4o-2024-11-20"],
    isPreview: false,
    isPremium: false,
  },
  {
    modelSlug: "gpt-4o-mini",
    name: "GPT-4o Mini",
    providerSlug: AI_PROVIDER_CODES.openai,
    aliases: ["gpt-4o-mini", "gpt-4o-mini-2024-07-18"],
    isPreview: false,
    isPremium: false,
  },
  {
    modelSlug: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    providerSlug: AI_PROVIDER_CODES.google,
    aliases: ["gemini-2.0-flash", "gemini-2.0-flash-001"],
    isPreview: false,
    isPremium: false,
  },
  {
    modelSlug: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    providerSlug: AI_PROVIDER_CODES.google,
    aliases: ["gemini-2.0-flash-lite", "gemini-2.0-flash-lite-001"],
    isPreview: false,
    isPremium: false,
  },
  {
    modelSlug: "gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro",
    providerSlug: AI_PROVIDER_CODES.google,
    aliases: ["gemini-2.5-pro-preview", "gemini-2.5-pro-preview-06-05"],
    isPreview: true,
    isPremium: false,
  },
  {
    modelSlug: "gemini-2.5-flash-preview-05-20",
    name: "Gemini 2.5 Flash",
    providerSlug: AI_PROVIDER_CODES.google,
    aliases: ["gemini-2.5-flash-preview-05-20"],
    isPreview: true,
    isPremium: false,
  },
  {
    modelSlug: "claude-opus-4-20250514",
    name: "Claude Opus 4",
    providerSlug: AI_PROVIDER_CODES.anthropic,
    aliases: ["claude-opus-4-0", "claude-opus-4-20250514"],
    isPreview: false,
    isPremium: false,
  },
  {
    modelSlug: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    providerSlug: AI_PROVIDER_CODES.anthropic,
    aliases: ["claude-sonnet-4-0", "claude-sonnet-4-20250514"],
    isPreview: false,
    isPremium: false,
  },
  {
    modelSlug: "claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    providerSlug: AI_PROVIDER_CODES.anthropic,
    aliases: ["claude-3-7-sonnet-latest", "claude-3-7-sonnet-20250219"],
    isPreview: false,
    isPremium: false,
  },
  {
    modelSlug: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    providerSlug: AI_PROVIDER_CODES.anthropic,
    aliases: ["claude-3-5-haiku-latest", "claude-3-5-haiku-20241022"],
    isPreview: false,
    isPremium: false,
  },
] as const;

const AI_ASSISTANTS = [
  {
    slug: "general",
    name: "General",
    description: "General assistant",
    modelSlug: "gpt-4.1",
  },
] as const;

export const DATA_SEED = {
  providers: AI_PROVIDERS,
  models: AI_MODELS,
  assistants: AI_ASSISTANTS,
};

export const SYSTEM_FLAGS = [
  {
    slug: "d1_allow_seeding",
    key: "global:d1__allow_seeding",
    name: "Database Seeding",
    description: "Allow database seeding operations",
    category: "Database",
  },
  {
    slug: "maintenance_mode",
    key: "global:maintenance_mode",
    name: "Maintenance Mode",
    description: "Enable maintenance mode for the application",
    category: "System",
  },
  {
    slug: "debug_mode",
    key: "global:debug_mode",
    name: "Debug Mode",
    description: "Enable debug logging and detailed error messages",
    category: "Development",
  },
  {
    slug: "feature_chat_enabled",
    key: "global:feature_chat_enabled",
    name: "Chat Feature",
    description: "Enable chat functionality",
    category: "Features",
  },
] as const;

export const SYSTEM_SECRETS = [
  {
    slug: "openai_api_key",
    key: "CHATFOUNDRY__PROVIDERS__OPENAI_API_KEY",
    name: "OpenAI API Key",
    description: "API key for OpenAI services",
    category: "AI Providers",
    sensitive: true,
  },
  {
    slug: "openai_base_url",
    key: "CHATFOUNDRY__PROVIDERS__OPENAI_BASE_URL",
    name: "OpenAI Base URL",
    description: "Custom base URL for OpenAI API (optional)",
    category: "AI Providers",
    sensitive: false,
  },
  {
    slug: "azure_openai_api_key",
    key: "CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_API_KEY",
    name: "Azure OpenAI API Key",
    description: "API key for Azure OpenAI services",
    category: "AI Providers",
    sensitive: true,
  },
  {
    slug: "azure_openai_resource_name",
    key: "CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_RESOURCE_NAME",
    name: "Azure OpenAI Resource Name",
    description: "Azure OpenAI resource name",
    category: "AI Providers",
    sensitive: false,
  },
  {
    slug: "azure_openai_base_url",
    key: "CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_BASE_URL",
    name: "Azure OpenAI Base URL",
    description: "Base URL for Azure OpenAI API",
    category: "AI Providers",
    sensitive: false,
  },
  {
    slug: "anthropic_api_key",
    key: "CHATFOUNDRY__PROVIDERS__ANTHROPIC_API_KEY",
    name: "Anthropic API Key",
    description: "API key for Anthropic Claude services",
    category: "AI Providers",
    sensitive: true,
  },
  {
    slug: "google_api_key",
    key: "CHATFOUNDRY__PROVIDERS__GOOGLE_API_KEY",
    name: "Google AI API Key",
    description: "API key for Google AI services",
    category: "AI Providers",
    sensitive: true,
  },
  {
    slug: "smtp_config",
    key: "CHATFOUNDRY__EMAIL__SMTP_CONFIG",
    name: "SMTP Configuration",
    description: "SMTP server configuration for email services (JSON format)",
    category: "Email",
    sensitive: true,
  },
] as const;
