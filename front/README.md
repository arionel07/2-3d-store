# Store Layout Planner UI

The internal Next.js interface for planning store layouts. It talks to the
separate Hono API in `../back` and keeps all plan dimensions and coordinates in
integer centimeters.

## Local setup

```bash
bun install
cp .env.example .env.local
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` if the API is not on
`http://localhost:3001`.

## Run and check

```bash
bun run dev
bun run typecheck
bun run build
```

Open [http://localhost:3000](http://localhost:3000). Use the API's
`GET /api/readiness` endpoint to verify that PostgreSQL is available.
Sign in with an account created by the backend's closed
`bun run auth:create-user` command; there is no public registration.
Open a saved layout to see its geometry history. Each restore is confirmed in
the UI and creates a new version; gallery media is not part of snapshots.
