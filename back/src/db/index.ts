import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const databaseUrl = Bun.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl);

export const db = drizzle({ client });
