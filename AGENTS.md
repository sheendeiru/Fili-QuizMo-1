# AGENTS.md

Guidance for AI coding agents (Claude Code, Copilot, Cursor, etc.) working in this repository. Read this before making changes.

## Project Overview

<!-- Replace with a 2-3 sentence description of what this app does and who uses it. -->
A full-stack web application built with Next.js, React, Supabase, and Node.js.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| UI | React (Server Components by default) |
| Language | TypeScript (strict mode) |
| Backend / DB / Auth | Supabase (Postgres, Auth, Storage, Realtime) |
| Runtime | Node.js (LTS) |
| Package manager | npm (use the lockfile that exists; do not mix managers) |

## Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server (http://localhost:3000)
npm run build        # production build
npm run start        # run production build
npm run lint         # lint
npm run typecheck    # tsc --noEmit (add this script if missing)
npm test             # run tests (if configured)
```

Before declaring a task done, run `npm run lint` and `npm run build` (or `typecheck`) and fix any errors.

## Project Structure

```
.
├── app/                  # Next.js App Router (routes, layouts, route handlers)
│   ├── (auth)/           # Route groups for auth pages
│   ├── api/              # Route handlers (server-side endpoints)
│   ├── layout.tsx
│   └── page.tsx
├── components/           # Reusable React components
│   └── ui/               # Small, generic UI primitives
├── lib/
│   ├── supabase/         # Supabase client helpers (browser, server, middleware)
│   └── utils/            # Shared helpers
├── hooks/                # Custom React hooks (client-side)
├── types/                # Shared TypeScript types (incl. generated DB types)
├── supabase/
│   ├── migrations/       # SQL migrations (source of truth for schema)
│   └── seed.sql
├── public/               # Static assets
├── middleware.ts         # Auth/session refresh, route protection
└── .env.local            # Local secrets (never commit)
```

Adapt this to the actual layout if it differs; do not reorganize the project without being asked.

## Environment Variables

Stored in `.env.local` (never commit). Keep `.env.example` up to date when adding a variable.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, NEVER expose to the client
```

- Only variables prefixed with `NEXT_PUBLIC_` are sent to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Use it only in server code (route handlers, server actions, scripts), never in client components.

## Coding Conventions

### General
- Use TypeScript everywhere; avoid `any` (use `unknown` and narrow, or define a type).
- Prefer small, focused functions and components. Keep files under ~300 lines where practical.
- Use named exports for components and utilities; default exports only where Next.js requires them (`page.tsx`, `layout.tsx`, etc.).
- Use the `@/` import alias for absolute imports if configured.
- Follow the existing code style and formatter settings (Prettier/ESLint). Don't reformat unrelated code.
- Don't add new dependencies without a clear need; prefer what's already installed.

### Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities / non-component files: `kebab-case.ts` or `camelCase.ts` (match existing files)
- Constants: `UPPER_SNAKE_CASE`
- DB tables/columns: `snake_case`

## Next.js Guidelines

- Use the **App Router**. Do not add files to `pages/` unless the project already uses it.
- Components are **Server Components by default**. Add `"use client"` only when you need state, effects, event handlers, or browser APIs, and push it as far down the tree as possible.
- Fetch data in Server Components or route handlers rather than in `useEffect` when possible.
- Use **Server Actions** or **Route Handlers** (`app/api/**/route.ts`) for mutations. Validate all inputs on the server.
- Use `next/image` for images, `next/link` for navigation, and `next/font` for fonts.
- Add `loading.tsx` and `error.tsx` for routes that fetch data.
- Use `revalidatePath` / `revalidateTag` after mutations that change cached data.
- Export `metadata` (or `generateMetadata`) for SEO on public pages.

## React Guidelines

- Function components and hooks only; no class components.
- Keep state minimal and colocated. Derive values instead of storing them in state.
- Always provide stable `key` props in lists (never array index for dynamic lists).
- Respect the Rules of Hooks; include correct dependency arrays in `useEffect`/`useMemo`/`useCallback`.
- Handle loading, empty, and error states in every data-driven UI.
- Make UI accessible: semantic HTML, labels for inputs, keyboard support, sufficient contrast, `alt` text.

## Supabase Guidelines

### Clients
Use separate helpers in `lib/supabase/` for each context. Do not reuse one client everywhere.

- **Browser client**: for client components (uses the anon key).
- **Server client**: for Server Components, route handlers, and server actions (reads session from cookies).
- **Middleware client**: refreshes the auth session on each request.

Prefer `@supabase/ssr` for cookie-based auth in Next.js.

### Security (important)
- **Row Level Security (RLS) must be enabled on every table** exposed to the API, with explicit policies.
- Never rely on the client to enforce permissions. Authorize on the server and in RLS.
- Use `supabase.auth.getUser()` (verified) on the server rather than trusting `getSession()` alone for authorization decisions.
- Never expose the service role key or log secrets.
- Validate and sanitize all user input (e.g. with Zod) before writing to the database.

### Database & Migrations
- Schema changes go in `supabase/migrations/` as timestamped SQL files. Do not edit the production schema manually.
- Keep migrations small, reversible where possible, and idempotent when feasible.
- Regenerate types after schema changes:
  ```bash
  npx supabase gen types typescript --project-id <project-id> > types/database.types.ts
  ```
- Use the generated `Database` type with the Supabase client for typed queries.
- Select only the columns you need (avoid `select('*')` in production paths). Add indexes for columns used in filters/joins.
- Always check and handle the `error` returned by Supabase calls.

### Auth, Storage, Realtime
- Protect private routes in `middleware.ts` and again on the server where data is loaded.
- Use storage buckets with policies; prefer signed URLs for private files.
- Unsubscribe from Realtime channels in effect cleanup.

## Node.js Guidelines

- Target the Node.js LTS version specified in `.nvmrc` / `package.json` `engines`.
- Use ES modules and `async/await`; avoid unhandled promise rejections.
- Keep server-only code (secrets, service role usage, heavy libraries) out of client bundles. Consider `import "server-only"` in server-only modules.
- For scripts (seeding, maintenance), place them in `scripts/` and make them safe to re-run.
- Handle errors explicitly and return meaningful HTTP status codes from route handlers.

## Error Handling & Validation

- Validate request bodies and params with a schema library (e.g. Zod) in route handlers and server actions.
- Return consistent response shapes, e.g. `{ data, error }`.
- Never leak internal error details or stack traces to the client.
- Log server errors with enough context to debug, without logging secrets or PII.

## Testing

- Add or update tests for any logic you change when a test setup exists.
- Test behavior, not implementation details.
- Mock Supabase at the boundary; don't hit the production database from tests.

## Git & Workflow

- Make small, focused commits with clear messages (e.g. `feat: add login form`, `fix: handle empty quiz list`).
- Don't commit `.env*` files, `node_modules`, `.next`, or build output.
- Don't modify unrelated files or perform large refactors unless asked.

## Agent Rules (Do / Don't)

**Do**
- Read the relevant existing files before editing; match the surrounding style.
- Explain non-obvious decisions briefly in your summary.
- Run lint/typecheck/build before finishing, and report anything you couldn't verify.
- Ask for clarification when requirements are ambiguous or a change is destructive.

**Don't**
- Don't delete files, drop tables, or run destructive SQL without explicit confirmation.
- Don't hardcode secrets, URLs, or keys.
- Don't disable RLS, lint rules, or TypeScript checks to make an error go away.
- Don't invent APIs or package versions; check `package.json` and the docs.
- Don't add `"use client"` to whole trees just to silence an error.
