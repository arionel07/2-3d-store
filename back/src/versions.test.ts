import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createAuth } from "./auth.ts";
import { requireDb } from "./db/index.ts";
import { layoutObjects, layoutVersions, layouts, stores, user } from "./db/schema.ts";
import { app } from "./index.ts";

const databaseReady = Boolean(Bun.env.DATABASE_URL && Bun.env.BETTER_AUTH_SECRET);
const testEmail = `versions-test-${crypto.randomUUID()}@example.com`;
const testPassword = "Strong-version-test-password-123";
const testOrigin = Bun.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

describe.skipIf(!databaseReady)("layout geometry versions", () => {
  let storeId = "";
  let layoutId = "";

  async function login() {
    const response = await app.fetch(
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
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  }

  function objectAt(xCm: number) {
    return {
      id: crypto.randomUUID(),
      type: "shelf",
      name: "Main shelf",
      xCm,
      yCm: 100,
      widthCm: 180,
      depthCm: 60,
      heightCm: 180,
      rotationDeg: 0,
    };
  }

  async function save(cookie: string, baseVersion: number, object: ReturnType<typeof objectAt>) {
    return app.fetch(
      new Request(`http://localhost/api/layouts/${layoutId}/objects`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ baseVersion, objects: [object] }),
      }),
    );
  }

  beforeAll(async () => {
    const provisioningAuth = createAuth({ disableSignUp: false });
    await provisioningAuth.api.signUpEmail({
      body: { name: "Version test user", email: testEmail, password: testPassword },
      headers: new Headers({ origin: testOrigin }),
    });

    const db = requireDb();
    const [store] = await db.insert(stores).values({ name: "Version test store", address: "" }).returning();
    if (!store) throw new Error("Could not create version test store");
    storeId = store.id;
    const [layout] = await db
      .insert(layouts)
      .values({ storeId, name: "Version test layout", widthCm: 1200, depthCm: 800 })
      .returning();
    if (!layout) throw new Error("Could not create version test layout");
    layoutId = layout.id;
  });

  beforeEach(async () => {
    const db = requireDb();
    await db.delete(layoutVersions).where(eq(layoutVersions.layoutId, layoutId));
    await db.delete(layoutObjects).where(eq(layoutObjects.layoutId, layoutId));
    await db.update(layouts).set({ widthCm: 1200, depthCm: 800 }).where(eq(layouts.id, layoutId));
  });

  afterAll(async () => {
    const db = requireDb();
    await db.delete(stores).where(eq(stores.id, storeId));
    await db.delete(user).where(eq(user.email, testEmail));
  });

  test("creates one version and skips an unchanged save", async () => {
    const cookie = await login();
    const object = objectAt(100);
    const firstSave = await save(cookie, 0, object);
    expect(firstSave.status).toBe(200);
    expect(await firstSave.json()).toMatchObject({ currentVersion: 1, versionCreated: true });

    const duplicateSave = await save(cookie, 1, object);
    expect(duplicateSave.status).toBe(200);
    expect(await duplicateSave.json()).toMatchObject({ currentVersion: 1, versionCreated: false });

    const versionsResponse = await app.fetch(
      new Request(`http://localhost/api/layouts/${layoutId}/versions`, { headers: { Cookie: cookie } }),
    );
    const versionsBody = (await versionsResponse.json()) as { versions: Array<{ version: number; authorName: string }> };
    expect(versionsResponse.status).toBe(200);
    expect(versionsBody.versions).toHaveLength(1);
    expect(versionsBody.versions[0]).toMatchObject({ version: 1, authorName: "Version test user" });
  });

  test("restores a version by creating a new version", async () => {
    const cookie = await login();
    const originalObject = objectAt(100);
    await save(cookie, 0, originalObject);
    await save(cookie, 1, objectAt(300));

    const restoreResponse = await app.fetch(
      new Request(`http://localhost/api/layouts/${layoutId}/versions/1/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ baseVersion: 2 }),
      }),
    );
    const restored = (await restoreResponse.json()) as { currentVersion: number; objects: Array<{ xCm: number }> };
    expect(restoreResponse.status).toBe(200);
    expect(restored.currentVersion).toBe(3);
    expect(restored.objects[0]?.xCm).toBe(100);

    const versionsResponse = await app.fetch(
      new Request(`http://localhost/api/layouts/${layoutId}/versions`, { headers: { Cookie: cookie } }),
    );
    const versionsBody = (await versionsResponse.json()) as { versions: Array<{ version: number }> };
    expect(versionsBody.versions.map((item) => item.version)).toEqual([3, 2, 1]);
  });

  test("rejects a save based on a stale version", async () => {
    const firstCookie = await login();
    const secondCookie = await login();
    await save(firstCookie, 0, objectAt(100));

    const winningSave = await save(firstCookie, 1, objectAt(300));
    expect(winningSave.status).toBe(200);

    const staleSave = await save(secondCookie, 1, objectAt(500));
    const conflict = (await staleSave.json()) as { currentVersion: number };
    expect(staleSave.status).toBe(409);
    expect(conflict.currentVersion).toBe(2);

    const layoutResponse = await app.fetch(
      new Request(`http://localhost/api/layouts/${layoutId}`, { headers: { Cookie: firstCookie } }),
    );
    const layoutBody = (await layoutResponse.json()) as { objects: Array<{ xCm: number }>; currentVersion: number };
    expect(layoutBody.currentVersion).toBe(2);
    expect(layoutBody.objects[0]?.xCm).toBe(300);
  });
});
