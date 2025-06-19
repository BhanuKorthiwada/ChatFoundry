import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),

  layout("routes/layout.tsx", [
    route("home", "routes/home.tsx"),
    route("todos", "routes/todos.tsx"),

    // Settings
    ...prefix("settings", [
      layout("routes/settings/layout.tsx", [
        route("account", "routes/settings/account.tsx"),
        route("appearance", "routes/settings/appearance.tsx"),
        route("sessions", "routes/settings/sessions.tsx"),
        route("password", "routes/settings/password.tsx"),
        route("connections", "routes/settings/connections.tsx"),
      ]),
    ]),

    // Admin
    ...prefix("admin", [layout("routes/admin/layout.tsx", [route("dashboard", "routes/admin/dashboard.tsx")])]),

    // Pages with Sidebar layout

    layout("routes/ai/layout.tsx", [
      route("provider-new", "routes/providers/provider-create.tsx"),
      route("providers/:providerId?", "routes/providers/provider-list.tsx"),

      route("model-new", "routes/models/model-create.tsx"),
      route("models/:modelId?", "routes/models/model-list.tsx"),

      route("assistant-new", "routes/assistants/assistant-create.tsx"),
      route("assistants/:assistantId?", "routes/assistants/assistant-list.tsx"),

      route("chat/:conversationId?", "routes/chat/chat.tsx"),
      route("chat-history", "routes/chat/chat-history.tsx"),

      route("*", "routes/ai/not-found.tsx"),
    ]),
  ]),

  // Better Auth
  ...prefix("auth", [
    layout("routes/auth/layout.tsx", [
      route("sign-in", "routes/auth/sign-in.tsx"),
      route("sign-up", "routes/auth/sign-up.tsx"),
      route("sign-out", "routes/auth/sign-out.tsx"),
    ]),
    route("forget-password", "routes/auth/forget-password.tsx"),
    route("reset-password", "routes/auth/reset-password.tsx"),
  ]),

  // Image routes
  route("images/*", "routes/images.ts"),

  // Better Auth and other API's
  ...prefix("api", [
    route("auth/error", "routes/api/better-error.tsx"),
    route("auth/*", "routes/api/better.tsx"),
    route("color-scheme", "routes/api/color-scheme.ts"),

    route("providers", "routes/api/providers.tsx"),

    route("models", "routes/api/models.tsx"),

    route("assistants", "routes/api/assistants.tsx"),

    route("chat/:conversationId", "routes/api/chat.tsx"),

    route("data/seed", "routes/api/data-seed.tsx"),
  ]),

  // Not found
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
