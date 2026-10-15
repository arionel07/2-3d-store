import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import type { Context, Next } from "hono";
import { account, session, user, verification } from "./db/schema.ts";
import { requireDb } from "./db/index.ts";

export type AuthContext = {
  Variables: {
    authUserId: string;
  };
};

const defaultFrontendOrigin = "http://localhost:3000";
const defaultApiOrigin = "http://localhost:3001";

export function createAuth(options: { disableSignUp: boolean }) {
  const secret = Bun.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required");
  }

  return betterAuth({
    baseURL: Bun.env.BETTER_AUTH_URL ?? defaultApiOrigin,
    secret,
    trustedOrigins: [Bun.env.FRONTEND_ORIGIN ?? defaultFrontendOrigin],
    database: drizzleAdapter(requireDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: options.disableSignUp,
    },
    plugins: [bearer()],
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  authInstance ??= createAuth({ disableSignUp: true });
  return authInstance;
}

export async function requireSession(c: Context<AuthContext>, next: Next) {
  try {
    const session = await getAuth().api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: "Authentication required" }, 401);
    }

    c.set("authUserId", session.user.id);
    await next();
  } catch (error) {
    console.error("Authentication check failed", error);
    return c.json({ error: "Authentication unavailable" }, 503);
  }
}
