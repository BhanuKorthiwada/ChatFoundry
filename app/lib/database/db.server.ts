import { env as cfEnv } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { env } from "~/lib/env.server";
import * as schema from "./schema";

export const db = drizzle(cfEnv.CF_DB, {
  schema: { ...schema },
  casing: "snake_case",
  logger: env.ENVIRONMENT === "development",
});

const getDb = (d1: D1Database) => {
  const db = drizzle(d1, {
    schema: { ...schema },
    casing: "snake_case",
  });
  return db;
};

export type AppDbType = ReturnType<typeof getDb>;
