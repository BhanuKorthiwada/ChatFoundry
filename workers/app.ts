import { createRequestHandler } from "react-router";
import { adapterContext } from "~/lib/contexts";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
  export interface Future {
    unstable_viteEnvironmentApi: true;
    unstable_middleware: true;
  }
}

const requestHandler = createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE);

export default {
  async fetch(request, env, ctx) {
    try {
      const contextValue = {
        cloudflare: {
          env,
          ctx,
        },
      };
      const context = new Map([[adapterContext, contextValue]]);
      return requestHandler(request, context);
    } catch (error) {
      console.error(error);
      return new Response("An unexpected error occurred", { status: 500 });
    }
  },

  scheduled: async (event, env, ctx) => {
    try {
      switch (event.cron) {
        case "0 0 * * *":
          try {
            console.log("Running daily scheduled task (Midnight)");
          } catch (error) {
            console.error("Daily task error:", error);
          }
          break;

        case "0 * * * *":
          try {
            console.log("Running hourly scheduled task");
            // TODO: Remove conversations without messages or create them on message creation
          } catch (error) {
            console.error("Hourly task error:", error);
          }
          break;
      }
    } catch (error) {
      console.error("Scheduled event error:", error);
    }
  },
} satisfies ExportedHandler<Env>;
