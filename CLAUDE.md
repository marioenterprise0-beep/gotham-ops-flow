# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite + TanStack Start SSR dev server
npm run build      # production build (Cloudflare Workers target via nitro)
npm run lint       # ESLint
npm run format     # Prettier
npm run test       # vitest run — small unit suite, pure-logic only (no Supabase/React)
```

Small vitest suite in `src/tests/` — pure logic only (geofence math, permission resolution,
checkbox/blank detection, URL sanitization). Files that import `createServerFn`/Supabase
middleware aren't imported directly; their pure logic is duplicated inline in the test file
instead (see existing tests for the pattern) since that machinery doesn't run cleanly outside
the TanStack Start Vite plugin pipeline. `package-lock.json` is the lockfile — use `npm`, not
`bun` or `pnpm`.

There's also a Mac Electron desktop wrapper (`electron/`, tagged releases like `electron-v1.0.0`,
its own GitHub Actions auto-release workflow) and iPad PWA support — not just a browser app.

## Stack

- **TanStack Start** (SSR) + **TanStack Router** (file-based) + **React 19**
- **Supabase** — Postgres + Auth + RLS + pgmq email queue
- **Tailwind CSS v4** + **shadcn/ui** (New York, slate, 46 components in `src/components/ui/`)
- **Vite** via `@lovable.dev/vite-tanstack-config` — do **not** manually add `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, or `nitro` plugins; they're already bundled and duplicates break the build
- Path alias: `@/` → `src/`

## Routing

All routes are files in `src/routes/`. `routeTree.gen.ts` is auto-generated — never edit it. `__root.tsx` is the only app shell. File→URL mapping:

| File            | URL                                   |
| --------------- | ------------------------------------- |
| `index.tsx`     | `/`                                   |
| `users.tsx`     | `/users`                              |
| `users/$id.tsx` | `/users/:id`                          |
| `_layout.tsx`   | layout wrapper (renders `<Outlet />`) |

Sub-namespaces: `src/routes/api/` for HTTP handlers, `src/routes/lovable/` for Lovable platform webhooks (email send, auth hooks, queue processor), `src/routes/email/` for user-facing email pages (unsubscribe).

## Auth & Roles

`RoleProvider` in `src/lib/role.tsx` wraps the entire app. Access via `useRole()`.

**Role hierarchy** (highest → lowest): `owner › manager › shift_lead › grill › prep › cashier`

A user can hold multiple roles; the primary role is the highest-ranked one. Owners always get `"edit"` access everywhere, bypassing `tab_permissions` checks.

**Tab-level permissions**: Each sidebar tab has an optional `gate` (`"manager"` | `"owner"` | `"analytics"`). The `tab_permissions` table stores per-role and per-user overrides (`"none"` | `"view"` | `"edit"`). The `getTabAccess(tabKey)` function from `useRole()` resolves the effective level. Use `canSee(roleId, module)` for module-level visibility.

**Route guard**: every protected route calls `requireAuthBeforeLoad()` in `beforeLoad` — reads from localStorage, falls back to session refresh, redirects to `/auth` if unauthenticated.

**Server guard**: server functions use `requireManager` / `requireOwner` from `src/lib/auth-guards.ts` after the `requireSupabaseAuth` middleware. These are defense-in-depth — Supabase RLS is the primary lock.

## Server Functions Pattern

All data logic lives in `src/lib/*.functions.ts` (one file per domain). Every server function follows this shape:

```ts
export const myFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])          // injects context.supabase + context.userId
  .inputValidator((d) => z.object({...}).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);   // role guard if needed
    // ... db calls ...
  });
```

Never call `createServerFn` inside route files — keep all server logic in `*.functions.ts`.

## Supabase Clients

| Import                                                    | Key Used         | Use When                                     |
| --------------------------------------------------------- | ---------------- | -------------------------------------------- |
| `@/integrations/supabase/client` → `supabase`             | anon/publishable | Client components, RLS-enforced queries      |
| `@/integrations/supabase/client.server` → `supabaseAdmin` | service role     | Trusted server-only ops that bypass RLS      |
| `context.supabase` (from `requireSupabaseAuth`)           | user JWT         | Server functions — user-scoped, RLS enforced |

`src/integrations/supabase/types.ts` is auto-generated from the schema — never edit by hand.

## Sync Bus

After every mutation, call `syncDomains(queryClient, ...domains)` from `src/lib/sync-bus.ts`. This invalidates all React Query keys that depend on the changed domains. Every call also automatically bumps `change-log` and `dashboard-stats`. Use `syncAll(qc)` only on sign-in or role changes.

Domain list: `users` `roles` `permissions` `profiles` `invites` `schedule` `timeclock` `labor` `inventory` `orders` `cash` `alerts` `operations` `tasks` `sops` `recaps` `hospitality` `history` `dashboard` `integrity`

## Email System

Emails are rendered with `@react-email/components` and enqueued to a Supabase pgmq queue via `src/lib/email/enqueue.server.ts`. The queue processor at `src/routes/lovable/email/queue/process.ts` dequeues and dispatches through `@lovable.dev/email-js`.

- **30 email templates** in `src/lib/email-templates/` (invite, schedule changes, low-stock alerts, daily digest, cash variance, etc.)
- Brand domain: `notify.gothamhalaldash.com`
- User preferences (categories, quiet hours, frequency) stored in `notification_preferences` table
- Unsubscribe tokens in `email_unsubscribe_tokens` — never re-send to a used/suppressed token

To add a new email: create a template in `src/lib/email-templates/`, register it in `registry.ts`, then call `enqueueEmail()` from `enqueue.server.ts`.

## Environment Variables

| Variable                        | Side            | Purpose                                  |
| ------------------------------- | --------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`             | client + server | Supabase project URL                     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client + server | Anon/publishable key                     |
| `SUPABASE_URL`                  | server only     | Same URL for server-side auth middleware |
| `SUPABASE_PUBLISHABLE_KEY`      | server only     | Anon key for auth middleware             |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only     | Admin client + email queue               |

**Important**: On Cloudflare Workers, `process.env` reads at module scope resolve to `undefined` — always read env vars inside a function/handler, never at module top level. See `src/lib/config.server.ts` for the pattern.

## Design System

Custom brand tokens defined in `src/styles.css` alongside standard shadcn tokens:

- `--color-gold` / `--color-gold-light` — Gotham Halal brand gold
- `--color-graphite` — dark surface color
- `--font-display: "Black Han Sans"` — used for headings via `font-display` class
- `--font-sans: "DM Sans"` — body text

Shared gotham-specific primitives (not in shadcn): `Card`, `StatusPill`, `SectionHeader`, `CircularProgress`, `RoleBadge` — all in `src/components/gotham/primitives.tsx`.

## Key Conventions

- `.server.ts` suffix prevents Vite from bundling a file into the client bundle
- `src/lib/role.tsx` exports `canSee()`, `ROLES`, `ROLE_RANK`, `useRole()`, `initials()` — import from here, not re-implement
- `src/lib/exports.ts` has `downloadCSV()` and `openPrintablePDF()` — use these for any export feature
- `src/lib/automation.functions.ts` controls rollover, auto-clock-out, and manager self-approval settings
- The sidebar tab order is user-draggable and persisted to `localStorage` key `gotham:tab-order:v1`
- New shadcn component: `npx shadcn@latest add <name>` (drops into `src/components/ui/`)
- Migrations: `supabase/migrations/` — apply via `supabase db push` or the Supabase dashboard
