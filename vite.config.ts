import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
    }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  build: {
    minify: true,
  },

  optimizeDeps: {
    include: [
      "zod/v4",
      "@conform-to/react",
      "@conform-to/zod/v4",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      "@radix-ui/react-select",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-separator",
      "@radix-ui/react-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-accordion",
      "@radix-ui/react-slider",
      "@radix-ui/react-checkbox",
      "@origin-space/image-cropper",
      "remix-utils/safe-redirect",
      "remix-utils/honeypot/react",
      "remix-utils/honeypot/server",
      "lucide-react",
      "class-variance-authority",
      "@radix-ui/react-label",
      "clsx",
      "tailwind-merge",
      "date-fns",
      "sonner",
      "spin-delay",
      "better-auth/react",
      "remix-toast",
      "react",
      "drizzle-orm",
      "@ai-sdk/react",
      "@radix-ui/react-collapsible",
      "@ai-sdk/ui-utils",
      "@ai-sdk/anthropic",
      "@ai-sdk/azure",
      "@ai-sdk/openai",
      "ai",
      "workers-ai-provider",      
      "@radix-ui/react-scroll-area",
    ],
  },

  server: {
    port: 4010,
  },
});
