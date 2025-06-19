import type { Config } from "drizzle-kit";

export default {
  out: "./drizzle",
  schema: "./app/lib/database/schema.ts",
  dialect: "sqlite",
  casing: "snake_case",
  strict: true,
  breakpoints: true,
  verbose: process.env.NODE_ENV === "development",
  migrations: {
    prefix: "supabase",
  },
} satisfies Config;
