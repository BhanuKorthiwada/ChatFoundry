import { Logger } from "~/.server/log-service";
import { db } from "~/lib/database/db.server";
import type { Route } from "./+types/providers";

export async function loader(_: Route.LoaderArgs) {
  try {
    const providers = await db.query.aiProviders.findMany({
      where: (t, { eq }) => eq(t.status, "active"),
      columns: {
        id: true,
        name: true,
        description: true,
        slug: true,
      },
    });

    return {
      success: true,
      data: providers,
    };
  } catch (error) {
    Logger.error("providers", error);
    return {
      success: false,
      error: "Something went wrong, please try again later.",
    };
  }
}
