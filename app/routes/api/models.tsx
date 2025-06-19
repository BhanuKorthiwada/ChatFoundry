import { Logger } from "~/.server/log-service";
import { db } from "~/lib/database/db.server";
import type { Route } from "./+types/models";

export async function loader(_: Route.LoaderArgs) {
  try {
    const models = await db.query.aiModels.findMany({
      columns: {
        id: true,
        name: true,
      },
      with: {
        provider: {
          columns: {
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      success: true,
      data: models,
    };
  } catch (error) {
    Logger.error("models", error);
    return {
      success: false,
      error: "Something went wrong, please try again later.",
    };
  }
}
