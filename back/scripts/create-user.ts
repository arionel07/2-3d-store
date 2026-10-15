import { z } from "zod";
import { createAuth } from "../src/auth.ts";
import { closeDatabase } from "../src/db/index.ts";

const envSchema = z.object({
  AUTH_EMAIL: z.string().email(),
  AUTH_PASSWORD: z.string().min(8),
  AUTH_NAME: z.string().trim().min(1).max(100).default("Store planner"),
});

const parsed = envSchema.safeParse({
  AUTH_EMAIL: Bun.env.AUTH_EMAIL,
  AUTH_PASSWORD: Bun.env.AUTH_PASSWORD,
  AUTH_NAME: Bun.env.AUTH_NAME,
});

if (!parsed.success) {
  console.error(
    "Set AUTH_EMAIL, AUTH_PASSWORD (at least 8 characters), and optionally AUTH_NAME.",
  );
  process.exit(1);
}

const auth = createAuth({ disableSignUp: false });
const origin = Bun.env.BETTER_AUTH_URL ?? "http://localhost:3001";

try {
  const result = await auth.api.signUpEmail({
    body: {
      name: parsed.data.AUTH_NAME,
      email: parsed.data.AUTH_EMAIL,
      password: parsed.data.AUTH_PASSWORD,
    },
    headers: new Headers({ origin }),
  });

  if (!result) {
    throw new Error("User creation returned an empty response");
  }

  console.log(`Created internal user ${parsed.data.AUTH_EMAIL}`);
} finally {
  await closeDatabase();
}
