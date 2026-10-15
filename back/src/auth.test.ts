import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createAuth } from "./auth.ts";
import { requireDb } from "./db/index.ts";
import { app } from "./index.ts";
import { user } from "./db/schema.ts";

const databaseReady = Boolean(Bun.env.DATABASE_URL && Bun.env.BETTER_AUTH_SECRET);
const testEmail = `auth-test-${crypto.randomUUID()}@example.com`;
const testPassword = "Strong-test-password-123";
const testOrigin = Bun.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

describe.skipIf(!databaseReady)("authentication", () => {
  beforeAll(async () => {
    const provisioningAuth = createAuth({ disableSignUp: false });
    await provisioningAuth.api.signUpEmail({
      body: {
        name: "Authentication test user",
        email: testEmail,
        password: testPassword,
      },
      headers: new Headers({ origin: testOrigin }),
    });
  });

  afterAll(async () => {
    await requireDb().delete(user).where(eq(user.email, testEmail));
  });

  test("keeps liveness public but rejects data without a session", async () => {
    const healthResponse = await app.fetch(new Request("http://localhost/api/health"));
    const storesResponse = await app.fetch(new Request("http://localhost/api/stores"));
    const mediaResponse = await app.fetch(new Request("http://localhost/api/media/not-a-real-file.png"));

    expect(healthResponse.status).toBe(200);
    expect(storesResponse.status).toBe(401);
    expect(mediaResponse.status).toBe(401);
  });

  test("does not expose public registration", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: testOrigin,
        },
        body: JSON.stringify({
          name: "Should not be created",
          email: `blocked-${crypto.randomUUID()}@example.com`,
          password: testPassword,
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("supports login, protected requests and logout", async () => {
    const loginResponse = await app.fetch(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: testOrigin,
        },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          rememberMe: true,
        }),
      }),
    );
    const setCookie = loginResponse.headers.get("set-cookie");
    const cookie = setCookie?.split(";", 1)[0];
    const loginBody = (await loginResponse.clone().json()) as { token?: string };

    expect(loginResponse.status).toBe(200);
    expect(cookie).toBeTruthy();
    expect(loginBody.token).toBeTruthy();

    const authorizedResponse = await app.fetch(
      new Request("http://localhost/api/stores", {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    expect(authorizedResponse.status).toBe(200);

    const mobileResponse = await app.fetch(
      new Request("http://localhost/api/stores", {
        headers: { Authorization: `Bearer ${loginBody.token}` },
      }),
    );
    expect(mobileResponse.status).toBe(200);

    const logoutResponse = await app.fetch(
      new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: {
          Cookie: cookie ?? "",
          Origin: testOrigin,
        },
      }),
    );
    expect(logoutResponse.status).toBe(200);

    const rejectedResponse = await app.fetch(
      new Request("http://localhost/api/stores", {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    expect(rejectedResponse.status).toBe(401);
  });
});
