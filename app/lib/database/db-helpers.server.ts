import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";

/**
 * Generate a UUID for primary keys
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Common details type
 */
export type Details = Record<string, unknown> | null | undefined;

export const createdBy = {
  createdBy: text(),
};

export const createdAt = {
  createdAt: integer({ mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
};

export const updatedBy = {
  updatedBy: text(),
};

export const updatedAt = {
  updatedAt: integer({ mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => sql`(unixepoch() * 1000)`),
};

export const createdAuditFields = {
  ...createdBy,
  ...createdAt,
};

export const updatedAuditFields = {
  ...updatedBy,
  ...updatedAt,
};

export const isDeleted = {
  isDeleted: integer({ mode: "boolean" }).default(false),
};

export const deletedBy = {
  deletedBy: text(),
};

export const deletedAt = {
  deletedAt: integer({ mode: "timestamp_ms" }),
};

export const softDeleteAuditFields = {
  ...isDeleted,
  ...deletedBy,
  ...deletedAt,
};
