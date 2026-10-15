# Store Layout Planner API

The API uses Bun, Hono, Drizzle ORM, PostgreSQL and Zod. Run commands from
this directory.

## Local setup

```bash
bun install
cp .env.example .env
bun run db:generate
bun run db:migrate
```

Set `BETTER_AUTH_SECRET` in `.env` to a random value of at least 32
characters. Keep it outside the repository. `BETTER_AUTH_URL` should be the
API's public origin, while `FRONTEND_ORIGIN` should be the exact browser
origin allowed by CORS.

The local PostgreSQL instance is provided by `../docker/compose.yml` and is
available on host port `5433`.

`UPLOAD_DIR` defaults to `./uploads` relative to the backend working directory.
Set it to a persistent mounted directory in `.env` for deployments.

## Run and check

```bash
bun run dev
bun run typecheck
bun run test
```

Create an internal account from a trusted shell or secret manager. This is a
closed CLI flow; the HTTP API has no public sign-up route. Supplying the
password through an environment variable avoids putting it in shell history:

```bash
read -r -s AUTH_PASSWORD
export AUTH_PASSWORD AUTH_EMAIL=manager@example.com AUTH_NAME="Store manager"
bun run auth:create-user
unset AUTH_PASSWORD AUTH_EMAIL AUTH_NAME
```

The browser uses a Better Auth session cookie. The same API also accepts the
token returned by the sign-in endpoint as `Authorization: Bearer <token>`, so
a future mobile client does not need Next.js server actions.

The API listens on `PORT` (default `3001`). Available endpoints:

- `GET /api/health` — liveness only;
- `GET /api/readiness` — checks PostgreSQL connectivity;
- `GET|POST /api/auth/*` — Better Auth login, session and logout endpoints;
- `GET /api/stores` — lists stores with their layouts;
- `POST /api/stores` — creates a store from `{ "name": "...", "address": "..." }`;
- `POST /api/stores/:storeId/layouts` — creates a layout with integer `widthCm` and `depthCm`;
- `GET /api/layouts/:layoutId` — reads a layout, its objects, media and current geometry version;
- `GET /api/layouts/:layoutId/versions` — lists immutable geometry snapshots with author and save time;
- `GET /api/layouts/:layoutId/media` — lists images linked to a layout;
- `POST /api/layouts/:layoutId/media` — adds an image from an HTTP(S) URL;
- `POST /api/layouts/:layoutId/media/upload` — uploads a JPEG, PNG or WebP up to 10 MB using multipart form data;
- `DELETE /api/layouts/:layoutId/media/:mediaId` — removes an image;
- `PUT /api/layouts/:layoutId/objects` — replaces the layout's objects and creates a version when data changes. The body includes `baseVersion` for optimistic conflict detection;
- `POST /api/layouts/:layoutId/versions/:version/restore` — restores a snapshot and creates a new version. The body includes `baseVersion`.

Object coordinates and dimensions are stored as integer centimeters.
Version snapshots contain only room dimensions and geometry objects; gallery
media is intentionally not versioned. A stale `baseVersion` returns HTTP 409
without changing the current plan or history.
All stores, layouts, objects, media and local image URLs require an
authenticated session. Local uploaded files are served privately from
`UPLOAD_DIR`.
