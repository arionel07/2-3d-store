import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const databaseUrl = Bun.env.DATABASE_URL;
const client = databaseUrl ? postgres(databaseUrl) : null;

export const db = client ? drizzle({ client }) : null;

export function requireDb() {
  if (!db) {
    throw new Error("DATABASE_URL is required");
  }

  return db;
}

export async function checkDatabaseConnection() {
  if (!client) {
    throw new Error("DATABASE_URL is required");
  }

  await client`select 1`;
}

export async function closeDatabase() {
  await client?.end({ timeout: 1 });
}
