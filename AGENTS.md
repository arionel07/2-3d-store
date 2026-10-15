# Store layout planner

- This is an internal tool for Vizaje-Nica managers and directors.
- Keep the MVP fast to use; this is a visual planning tool, not CAD.
- `front` is Next.js. `back` is a separate Bun API using Hono.
- Store layout dimensions and object dimensions in centimeters.
- The editable 2D plan is the source of truth; derive the approximate 3D view from it.
- Objects need editable width, depth, and height, plus position and rotation.
- Show whether an object fits with clear visual feedback; keep the layout easy to undo and revise.
- The API should remain usable by future mobile clients and shared manager profiles.
- Login will be invite-only with no public registration; do not implement auth until requested.
- Use PostgreSQL through Drizzle. Keep database access in `back`.
- Do not add infrastructure or features outside the MVP without a clear need.
