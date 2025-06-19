import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  future: {
    unstable_middleware: true,
    unstable_viteEnvironmentApi: true,
    unstable_splitRouteModules: true,
    unstable_optimizeDeps: true,
  },

  routeDiscovery: {
    mode: "lazy",
    manifestPath: "/app_manifest",
  },
} satisfies Config;
