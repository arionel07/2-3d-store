# Bun API

- Use Bun, Hono, TypeScript, Drizzle ORM, and PostgreSQL.
- Keep routes under `/api`.
- Validate all incoming data with Zod.
- Store object sizes and positions in centimeters.
- Keep API behavior independent of Next.js so mobile clients can use it later.
- Do not add public registration. Authentication will be invite-only and is a later milestone.
- Keep secrets in `.env`; commit only `.env.example`.
