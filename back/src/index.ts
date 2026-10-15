import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, asc, desc, eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { z } from "zod";
import { checkDatabaseConnection, requireDb } from "./db/index.ts";
import { getAuth, requireSession, type AuthContext } from "./auth.ts";
import { validateLayoutObjects } from "./geometry.ts";
import {
  createStoredFilename,
  detectImageFormat,
  getLocalMediaUrl,
  getStoredFilePath,
  getUploadDirectory,
  isUploadSizeAllowed,
  MAX_UPLOAD_BYTES,
  removeLocalMediaFile,
} from "./media.ts";
import {
  layoutMedia,
  layoutObjects,
  layouts,
  layoutVersions,
  stores,
  user,
  type LayoutVersionObject,
} from "./db/schema.ts";

const app = new Hono<AuthContext>();

const uuidSchema = z.string().uuid();
const objectSchema = z.object({
  id: uuidSchema.optional(),
  type: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  xCm: z.number().int(),
  yCm: z.number().int(),
  widthCm: z.number().int().positive(),
  depthCm: z.number().int().positive(),
  heightCm: z.number().int().positive(),
  rotationDeg: z.number().int().min(-360).max(360),
});
const saveObjectsSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
  objects: z.array(objectSchema).max(500),
});
const snapshotObjectsSchema = z.array(objectSchema.extend({ id: uuidSchema }));
const restoreVersionSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
});
const createStoreSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).default(""),
});
const createLayoutSchema = z.object({
  name: z.string().trim().min(1).max(200),
  widthCm: z.number().int().positive(),
  depthCm: z.number().int().positive(),
});
const mediaMetadataSchema = z.object({
  kind: z.enum(["photo", "reference"]),
  caption: z.string().trim().max(200).default(""),
  note: z.string().trim().max(2000).default(""),
});
const createMediaSchema = mediaMetadataSchema.extend({
  url: z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "URL must use http or https"),
});

function toVersionObject(object: {
  id: string;
  type: string;
  name: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  rotationDeg: number;
}): LayoutVersionObject {
  return {
    id: object.id,
    type: object.type,
    name: object.name,
    xCm: object.xCm,
    yCm: object.yCm,
    widthCm: object.widthCm,
    depthCm: object.depthCm,
    heightCm: object.heightCm,
    rotationDeg: object.rotationDeg,
  };
}

function canonicalizeObjects(objects: LayoutVersionObject[]) {
  return objects
    .map(toVersionObject)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function objectsAreEqual(
  left: LayoutVersionObject[],
  right: LayoutVersionObject[],
) {
  return JSON.stringify(canonicalizeObjects(left)) === JSON.stringify(canonicalizeObjects(right));
}

app.use(
  "/api/*",
  cors({
    origin: Bun.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth().handler(c.req.raw));

app.use("/api/stores", requireSession);
app.use("/api/stores/*", requireSession);
app.use("/api/layouts/*", requireSession);
app.use("/api/media/*", requireSession);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.get("/api/media/:filename", async (c) => {
  const filename = c.req.param("filename");

  try {
    const file = Bun.file(getStoredFilePath(filename));

    if (!(await file.exists())) {
      return c.json({ error: "Media file not found" }, 404);
    }

    const extension = filename.slice(filename.lastIndexOf(".") + 1);
    const contentType = {
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    }[extension];

    return new Response(file, {
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Type": contentType,
      },
    });
  } catch {
    return c.json({ error: "Invalid media filename" }, 400);
  }
});

app.get("/api/readiness", async (c) => {
  try {
    await checkDatabaseConnection();
    return c.json({ status: "ok", database: "ok" });
  } catch {
    return c.json({ status: "error", database: "unavailable" }, 503);
  }
});

app.get("/api/stores", async (c) => {
  const db = requireDb();
  const result = await db
    .select({ store: stores, layout: layouts })
    .from(stores)
    .leftJoin(layouts, eq(layouts.storeId, stores.id))
    .orderBy(asc(stores.name), asc(layouts.name));

  const storesWithLayouts = result.reduce<
    Array<(typeof result)[number]["store"] & { layouts: Array<(typeof result)[number]["layout"]> }>
  >((accumulator, row) => {
    const existing = accumulator.find((store) => store.id === row.store.id);

    if (existing) {
      if (row.layout) {
        existing.layouts.push(row.layout);
      }
      return accumulator;
    }

    accumulator.push({
      ...row.store,
      layouts: row.layout ? [row.layout] : [],
    });
    return accumulator;
  }, []);

  return c.json({ stores: storesWithLayouts });
});

app.post("/api/stores", async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const parsed = createStoreSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid store", issues: parsed.error.issues }, 400);
  }

  const db = requireDb();
  const [store] = await db.insert(stores).values(parsed.data).returning();

  return c.json({ store: { ...store, layouts: [] } }, 201);
});

app.post("/api/stores/:storeId/layouts", async (c) => {
  const storeId = uuidSchema.safeParse(c.req.param("storeId"));

  if (!storeId.success) {
    return c.json({ error: "Invalid store id" }, 400);
  }

  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const parsed = createLayoutSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid layout", issues: parsed.error.issues }, 400);
  }

  const db = requireDb();
  const [store] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.id, storeId.data))
    .limit(1);

  if (!store) {
    return c.json({ error: "Store not found" }, 404);
  }

  const [layout] = await db
    .insert(layouts)
    .values({ ...parsed.data, storeId: store.id })
    .returning();

  return c.json({ layout }, 201);
});

app.get("/api/layouts/:layoutId", async (c) => {
  const layoutId = uuidSchema.safeParse(c.req.param("layoutId"));

  if (!layoutId.success) {
    return c.json({ error: "Invalid layout id" }, 400);
  }

  const db = requireDb();
  const [layout] = await db
    .select()
    .from(layouts)
    .where(eq(layouts.id, layoutId.data))
    .limit(1);

  if (!layout) {
    return c.json({ error: "Layout not found" }, 404);
  }

  const [objects, media] = await Promise.all([
    db
      .select()
      .from(layoutObjects)
      .where(eq(layoutObjects.layoutId, layout.id))
      .orderBy(asc(layoutObjects.createdAt)),
    db
      .select()
      .from(layoutMedia)
      .where(eq(layoutMedia.layoutId, layout.id))
      .orderBy(asc(layoutMedia.createdAt)),
  ]);

  const [latestVersion] = await db
    .select({ version: layoutVersions.version })
    .from(layoutVersions)
    .where(eq(layoutVersions.layoutId, layout.id))
    .orderBy(desc(layoutVersions.version))
    .limit(1);

  return c.json({
    layout,
    objects,
    media,
    currentVersion: latestVersion?.version ?? 0,
  });
});

app.get("/api/layouts/:layoutId/versions", async (c) => {
  const layoutId = uuidSchema.safeParse(c.req.param("layoutId"));

  if (!layoutId.success) {
    return c.json({ error: "Invalid layout id" }, 400);
  }

  const db = requireDb();
  const [layout] = await db
    .select({ id: layouts.id })
    .from(layouts)
    .where(eq(layouts.id, layoutId.data))
    .limit(1);

  if (!layout) {
    return c.json({ error: "Layout not found" }, 404);
  }

  const versions = await db
    .select({
      id: layoutVersions.id,
      version: layoutVersions.version,
      widthCm: layoutVersions.widthCm,
      depthCm: layoutVersions.depthCm,
      authorId: layoutVersions.authorId,
      authorName: user.name,
      authorEmail: user.email,
      savedAt: layoutVersions.savedAt,
      objects: layoutVersions.objects,
    })
    .from(layoutVersions)
    .innerJoin(user, eq(user.id, layoutVersions.authorId))
    .where(eq(layoutVersions.layoutId, layout.id))
    .orderBy(desc(layoutVersions.version));

  return c.json({ versions });
});

app.get("/api/layouts/:layoutId/media", async (c) => {
  const layoutId = uuidSchema.safeParse(c.req.param("layoutId"));

  if (!layoutId.success) {
    return c.json({ error: "Invalid layout id" }, 400);
  }

  const db = requireDb();
  const [layout] = await db
    .select({ id: layouts.id })
    .from(layouts)
    .where(eq(layouts.id, layoutId.data))
    .limit(1);

  if (!layout) {
    return c.json({ error: "Layout not found" }, 404);
  }

  const media = await db
    .select()
    .from(layoutMedia)
    .where(eq(layoutMedia.layoutId, layout.id))
    .orderBy(asc(layoutMedia.createdAt));

  return c.json({ media });
});

app.post("/api/layouts/:layoutId/media", async (c) => {
  const layoutId = uuidSchema.safeParse(c.req.param("layoutId"));

  if (!layoutId.success) {
    return c.json({ error: "Invalid layout id" }, 400);
  }

  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const parsed = createMediaSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid media", issues: parsed.error.issues }, 400);
  }

  const db = requireDb();
  const [layout] = await db
    .select({ id: layouts.id })
    .from(layouts)
    .where(eq(layouts.id, layoutId.data))
    .limit(1);

  if (!layout) {
    return c.json({ error: "Layout not found" }, 404);
  }

  const [media] = await db
    .insert(layoutMedia)
    .values({ ...parsed.data, layoutId: layout.id })
    .returning();

  return c.json({ media }, 201);
});

app.post("/api/layouts/:layoutId/media/upload", async (c) => {
  const layoutId = uuidSchema.safeParse(c.req.param("layoutId"));

  if (!layoutId.success) {
    return c.json({ error: "Invalid layout id" }, 400);
  }

  let body: Record<string, string | File>;

  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: "Request body must be a valid multipart form" }, 400);
  }

  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ error: "A file field is required" }, 400);
  }

  if (!isUploadSizeAllowed(file.size)) {
    return c.json(
      { error: `Image must be ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB or smaller` },
      400,
    );
  }

  const metadata = mediaMetadataSchema.safeParse({
    kind: body.kind,
    caption: body.caption,
    note: body.note,
  });

  if (!metadata.success) {
    return c.json({ error: "Invalid media metadata", issues: metadata.error.issues }, 400);
  }

  const db = requireDb();
  const [layout] = await db
    .select({ id: layouts.id })
    .from(layouts)
    .where(eq(layouts.id, layoutId.data))
    .limit(1);

  if (!layout) {
    return c.json({ error: "Layout not found" }, 404);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectImageFormat(bytes);

  if (!format) {
    return c.json({ error: "Only JPEG, PNG, and WebP images are supported" }, 400);
  }

  const filename = createStoredFilename(format);
  const uploadDirectory = getUploadDirectory();
  const filePath = getStoredFilePath(filename, uploadDirectory);
  const localUrl = getLocalMediaUrl(filename);

  await mkdir(uploadDirectory, { recursive: true });
  await Bun.write(filePath, bytes);

  try {
    const [media] = await db
      .insert(layoutMedia)
      .values({ ...metadata.data, layoutId: layout.id, url: localUrl })
      .returning();

    return c.json({ media }, 201);
  } catch (error) {
    await removeLocalMediaFile(localUrl, uploadDirectory).catch((cleanupError) => {
      console.error("Could not remove uploaded file after database failure", cleanupError);
    });
    throw error;
  }
});

app.delete("/api/layouts/:layoutId/media/:mediaId", async (c) => {
  const layoutId = uuidSchema.safeParse(c.req.param("layoutId"));
  const mediaId = uuidSchema.safeParse(c.req.param("mediaId"));

  if (!layoutId.success || !mediaId.success) {
    return c.json({ error: "Invalid layout or media id" }, 400);
  }

  const db = requireDb();
  const [media] = await db
    .select({ id: layoutMedia.id, url: layoutMedia.url })
    .from(layoutMedia)
    .where(
      and(
        eq(layoutMedia.id, mediaId.data),
        eq(layoutMedia.layoutId, layoutId.data),
      ),
    )
    .limit(1);

  if (!media) {
    return c.json({ error: "Media not found" }, 404);
  }

  await db.delete(layoutMedia).where(eq(layoutMedia.id, media.id));
  await removeLocalMediaFile(media.url);

  return c.json({ deleted: true, mediaId: media.id });
});

app.put("/api/layouts/:layoutId/objects", async (c) => {
  const layoutId = uuidSchema.safeParse(c.req.param("layoutId"));

  if (!layoutId.success) {
    return c.json({ error: "Invalid layout id" }, 400);
  }

  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const parsed = saveObjectsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid objects", issues: parsed.error.issues }, 400);
  }

  const db = requireDb();
  const authorId = c.get("authUserId");
  const normalizedObjects = parsed.data.objects.map((object) => ({
    id: object.id ?? crypto.randomUUID(),
    type: object.type,
    name: object.name,
    xCm: object.xCm,
    yCm: object.yCm,
    widthCm: object.widthCm,
    depthCm: object.depthCm,
    heightCm: object.heightCm,
    rotationDeg: object.rotationDeg,
  }));
  let outcome:
    | { kind: "not-found" }
    | { kind: "conflict"; currentVersion: number }
    | { kind: "invalid"; problems: ReturnType<typeof validateLayoutObjects> }
    | { kind: "unchanged"; objects: LayoutVersionObject[]; currentVersion: number }
    | { kind: "saved"; currentVersion: number }
    | undefined;

  await db.transaction(async (tx) => {
    const [layout] = await tx
      .select({ id: layouts.id, widthCm: layouts.widthCm, depthCm: layouts.depthCm })
      .from(layouts)
      .where(eq(layouts.id, layoutId.data))
      .for("update");

    if (!layout) {
      outcome = { kind: "not-found" };
      return;
    }

    const [latestVersion] = await tx
      .select({ version: layoutVersions.version })
      .from(layoutVersions)
      .where(eq(layoutVersions.layoutId, layout.id))
      .orderBy(desc(layoutVersions.version))
      .limit(1);
    const currentVersion = latestVersion?.version ?? 0;

    if (parsed.data.baseVersion !== currentVersion) {
      outcome = { kind: "conflict", currentVersion };
      return;
    }

    const geometryProblems = validateLayoutObjects(normalizedObjects, layout);

    if (geometryProblems.length > 0) {
      outcome = { kind: "invalid", problems: geometryProblems };
      return;
    }

    const existingObjects = await tx
      .select()
      .from(layoutObjects)
      .where(eq(layoutObjects.layoutId, layout.id));
    const existingSnapshot = existingObjects.map(toVersionObject);
    const nextSnapshot = normalizedObjects.map(toVersionObject);

    if (objectsAreEqual(existingSnapshot, nextSnapshot)) {
      outcome = {
        kind: "unchanged",
        objects: nextSnapshot,
        currentVersion,
      };
      return;
    }

    await tx.delete(layoutObjects).where(eq(layoutObjects.layoutId, layout.id));
    if (normalizedObjects.length > 0) {
      await tx.insert(layoutObjects).values(
        normalizedObjects.map((object) => ({ ...object, layoutId: layout.id })),
      );
    }

    const nextVersion = currentVersion + 1;
    await tx
      .update(layouts)
      .set({ updatedAt: new Date() })
      .where(eq(layouts.id, layout.id));
    await tx.insert(layoutVersions).values({
      layoutId: layout.id,
      version: nextVersion,
      widthCm: layout.widthCm,
      depthCm: layout.depthCm,
      objects: canonicalizeObjects(nextSnapshot),
      authorId,
    });
    outcome = { kind: "saved", currentVersion: nextVersion };
  });

  if (!outcome) {
    return c.json({ error: "Could not save layout version" }, 500);
  }

  if (outcome.kind === "not-found") {
    return c.json({ error: "Layout not found" }, 404);
  }
  if (outcome.kind === "conflict") {
    return c.json(
      {
        error: "Layout changed since this plan was loaded. Reload it before saving.",
        baseVersion: parsed.data.baseVersion,
        currentVersion: outcome.currentVersion,
      },
      409,
    );
  }
  if (outcome.kind === "invalid") {
    return c.json(
      {
        error: "Layout objects are outside the room or overlap.",
        problems: outcome.problems,
      },
      400,
    );
  }

  const savedObjects = await db
    .select()
    .from(layoutObjects)
    .where(eq(layoutObjects.layoutId, layoutId.data))
    .orderBy(asc(layoutObjects.createdAt));

  return c.json({
    objects: outcome.kind === "unchanged" ? savedObjects : savedObjects,
    currentVersion: outcome.currentVersion,
    versionCreated: outcome.kind === "saved",
  });
});

app.post("/api/layouts/:layoutId/versions/:version/restore", async (c) => {
  const layoutId = uuidSchema.safeParse(c.req.param("layoutId"));
  const version = z.coerce.number().int().positive().safeParse(c.req.param("version"));

  if (!layoutId.success || !version.success) {
    return c.json({ error: "Invalid layout or version" }, 400);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }
  const parsed = restoreVersionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid restore request", issues: parsed.error.issues }, 400);
  }

  const db = requireDb();
  const authorId = c.get("authUserId");
  let outcome:
    | { kind: "not-found"; message: string }
    | { kind: "conflict"; currentVersion: number }
    | { kind: "invalid"; problems: ReturnType<typeof validateLayoutObjects> }
    | { kind: "restored"; currentVersion: number }
    | undefined;

  await db.transaction(async (tx) => {
    const [layout] = await tx
      .select({ id: layouts.id, widthCm: layouts.widthCm, depthCm: layouts.depthCm })
      .from(layouts)
      .where(eq(layouts.id, layoutId.data))
      .for("update");

    if (!layout) {
      outcome = { kind: "not-found", message: "Layout not found" };
      return;
    }

    const [latestVersion] = await tx
      .select({ version: layoutVersions.version })
      .from(layoutVersions)
      .where(eq(layoutVersions.layoutId, layout.id))
      .orderBy(desc(layoutVersions.version))
      .limit(1);
    const currentVersion = latestVersion?.version ?? 0;

    if (parsed.data.baseVersion !== currentVersion) {
      outcome = { kind: "conflict", currentVersion };
      return;
    }

    const [targetVersion] = await tx
      .select()
      .from(layoutVersions)
      .where(
        and(
          eq(layoutVersions.layoutId, layout.id),
          eq(layoutVersions.version, version.data),
        ),
      )
      .limit(1);

    if (!targetVersion) {
      outcome = { kind: "not-found", message: "Version not found" };
      return;
    }

    const snapshot = snapshotObjectsSchema.safeParse(targetVersion.objects);
    if (!snapshot.success) {
      throw new Error(`Invalid stored layout version ${targetVersion.version}`);
    }
    const geometryProblems = validateLayoutObjects(snapshot.data, {
      widthCm: targetVersion.widthCm,
      depthCm: targetVersion.depthCm,
    });
    if (geometryProblems.length > 0) {
      outcome = { kind: "invalid", problems: geometryProblems };
      return;
    }

    await tx
      .update(layouts)
      .set({
        widthCm: targetVersion.widthCm,
        depthCm: targetVersion.depthCm,
        updatedAt: new Date(),
      })
      .where(eq(layouts.id, layout.id));
    await tx.delete(layoutObjects).where(eq(layoutObjects.layoutId, layout.id));
    if (snapshot.data.length > 0) {
      await tx.insert(layoutObjects).values(
        snapshot.data.map((object) => ({ ...object, layoutId: layout.id })),
      );
    }

    const nextVersion = currentVersion + 1;
    await tx.insert(layoutVersions).values({
      layoutId: layout.id,
      version: nextVersion,
      widthCm: targetVersion.widthCm,
      depthCm: targetVersion.depthCm,
      objects: canonicalizeObjects(snapshot.data),
      authorId,
    });
    outcome = { kind: "restored", currentVersion: nextVersion };
  });

  if (!outcome) {
    return c.json({ error: "Could not restore layout version" }, 500);
  }

  if (outcome.kind === "not-found") {
    return c.json({ error: outcome.message }, 404);
  }
  if (outcome.kind === "conflict") {
    return c.json(
      {
        error: "Layout changed since this plan was loaded. Reload it before restoring.",
        baseVersion: parsed.data.baseVersion,
        currentVersion: outcome.currentVersion,
      },
      409,
    );
  }
  if (outcome.kind === "invalid") {
    return c.json(
      { error: "The stored version contains invalid geometry.", problems: outcome.problems },
      400,
    );
  }

  const [restoredLayout] = await db
    .select()
    .from(layouts)
    .where(eq(layouts.id, layoutId.data))
    .limit(1);
  const restoredObjects = await db
    .select()
    .from(layoutObjects)
    .where(eq(layoutObjects.layoutId, layoutId.data))
    .orderBy(asc(layoutObjects.createdAt));

  return c.json({
    layout: restoredLayout,
    objects: restoredObjects,
    currentVersion: outcome.currentVersion,
  });
});

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

const configuredPort = Number.parseInt(Bun.env.PORT ?? "3001", 10);

export { app };

export default {
  port: Number.isFinite(configuredPort) ? configuredPort : 3001,
  fetch: app.fetch,
};
