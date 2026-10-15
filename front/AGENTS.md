<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Store Planner

- Next.js is the UI; call the separate Bun API for persisted data.
- Keep 2D geometry as the source of truth and derive the approximate 3D preview.
- Store dimensions in centimeters; convert to screen pixels only for rendering.
- Keep the editor approachable for managers who currently plan layouts on paper.
