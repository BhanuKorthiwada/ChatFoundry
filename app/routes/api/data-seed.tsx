import { env as cfEnv } from "cloudflare:workers";
import { Logger } from "~/.server/log-service";
import { DATA_SEED, SYSTEM_FLAGS } from "~/lib/constants";
import { db } from "~/lib/database/db.server";
import * as schema from "~/lib/database/schema";
import type { Route } from "./+types/data-seed";

export async function loader(_: Route.LoaderArgs) {
  const seedLog = [];
  const queryProviders = () => {
    return db.query.aiProviders.findMany({
      where: (t, { eq }) => eq(t.status, "active"),
      columns: {
        id: true,
        name: true,
        description: true,
        slug: true,
      },
    });
  };

  const queryModels = () => {
    return db.query.aiModels.findMany({
      columns: {
        id: true,
        slug: true,
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
  };

  const querySeedFlag = async () => {
    const value = await cfEnv.CF_KV.get("global:d1__allow_seeding");
    return value === "true";
  };

  try {
    let allowSeeding = await querySeedFlag();

    if (!allowSeeding) {
      return {
        success: false,
        error: "Data seeding is not allowed",
      };
    }

    let providers = await queryProviders();

    if (providers.length === 0) {
      for (const provider of DATA_SEED.providers) {
        const providerInsertResult = await db.insert(schema.aiProviders).values(provider);
        if (!providerInsertResult.success) {
          seedLog.push({
            entity: "provider",
            entityRef: provider.slug,
            success: false,
            message: "Failed to insert provider",
            error: providerInsertResult.error,
          });
        }
      }
      providers = await queryProviders();
    }

    seedLog.push({
      entity: "provider",
      entityRef: "all",
      success: true,
      message: "Providers seeded successfully",
    });

    let models = await queryModels();

    if (models.length === 0) {
      for (const model of DATA_SEED.models) {
        const modelInsertResult = await db.insert(schema.aiModels).values({
          slug: model.modelSlug,
          name: model.name,
          description: model.name,
          providerId: providers.find((p) => p.slug === model.providerSlug)?.id!,
          isPreviewModel: model.isPreview,
          isPremiumModel: model.isPremium,
        });
        if (!modelInsertResult.success) {
          seedLog.push({
            entity: "model",
            entityRef: model.modelSlug,
            success: false,
            message: "Failed to insert model",
            error: modelInsertResult.error,
          });
        }
      }

      models = await queryModels();
    }

    seedLog.push({
      entity: "model",
      entityRef: "all",
      success: true,
      message: "Models seeded successfully",
    });

    const assistants = await db.query.aiAssistants.findMany({
      columns: {
        id: true,
        slug: true,
        name: true,
      },
    });

    if (assistants.length === 0) {
      for (const assistant of DATA_SEED.assistants) {
        const assistantInsertResult = await db.insert(schema.aiAssistants).values({
          slug: assistant.slug,
          name: assistant.name,
          description: assistant.name,
          modelId: models.find((m) => m.slug === assistant.modelSlug)?.id!,
        });
        if (!assistantInsertResult.success) {
          seedLog.push({
            entity: "assistant",
            entityRef: assistant.slug,
            success: false,
            message: "Failed to insert assistant",
            error: assistantInsertResult.error,
          });
        }
      }
    }

    seedLog.push({
      entity: "assistant",
      entityRef: "all",
      success: true,
      message: "Assistants seeded successfully",
    });

    seedLog.push({
      entity: "seed",
      entityRef: "all",
      success: true,
      message: "Data seeded successfully",
    });

    allowSeeding = await querySeedFlag();
    if (allowSeeding) {
      await cfEnv.CF_KV.put(SYSTEM_FLAGS.find((f) => f.slug === "d1_allow_seeding")!.key, "false");
    }

    seedLog.push({
      entity: "seed",
      entityRef: "all",
      success: true,
      message: "Data seeding flag reset successfully",
    });

    return {
      success: true,
      message: "Data seeded successfully",
      seedLog,
    };
  } catch (error) {
    Logger.error("data-seed", error);
    return {
      success: false,
      error: "Something went wrong, please try again later.",
    };
  }
}
