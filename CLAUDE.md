# logistics-app

## What this project does
Full-stack logistics platform for fleet management, last-mile delivery, and shipment tracking.

## Structure
- `apps/api` — Express + PostgreSQL REST API (port 3001)
- `apps/web` — React + Vite dashboard (port 3000, proxies /api to 3001)
- `apps/mobile` — Expo (React Native) driver app
- `packages/shared` — Shared TypeScript types (Shipment, Vehicle, Driver)

## Tech stack
- Runtime: Node.js v18+
- Language: TypeScript (strict mode)
- Database: PostgreSQL
- Web: React 18 + Vite + React Router
- Mobile: Expo SDK 50 + React Navigation

## Run commands
- Install all: `npm install` (from root)
- API: `npm run dev:api`
- Web: `npm run dev:web`
- Mobile: `npm run dev:mobile`

## Conventions
- Shared types live in `packages/shared` — never duplicate them in apps
- API auto-creates tables on startup via `initDb()`
- Copy `apps/api/.env.example` to `apps/api/.env` and fill in DATABASE_URL before running the API

## Recent progress (Fleet page)
- **License plate search** on the Fleet page, centered in the header between the title and action buttons ([Fleet.tsx](apps/web/src/pages/Fleet.tsx)).
- **Non-operational flagging**: marking a vehicle "Non Operational" now requires a name and reason (`non_operational_by` / `non_operational_reason` on `vehicles`), captured via [MarkNonOperationalModal.tsx](apps/web/src/components/MarkNonOperationalModal.tsx) and surfaced in the Fleet table (sortable/filterable "Flagged By" column with a hover tooltip showing the reason) and in the non-operational notification body.
- **Maintenance periods**: new `maintenance_periods` table tracks each `in_maintenance` stint's start/end date, opened/closed automatically on status transitions in `vehicles.ts`. [MaintenanceDrawer.tsx](apps/web/src/components/MaintenanceDrawer.tsx) groups maintenance logs under the period they fall in (e.g. "In maintenance 3 Jul 2026 → 15 Jul 2026 (12 days)"), with logs outside any tracked period under "Other Records".
- **Date-out on maintenance logs**: `maintenance_logs.returned_at` stores when the vehicle came back from a given repair. Backfilled from the "Date out" column in the Van maintenance report CSV (previously parsed but discarded by `import_maintenance.py`) — past logs now show real `{in} → {out}` spans instead of a single date.
- **Timezone bug fix**: `pg` was parsing `DATE` columns into JS `Date` objects at local-timezone midnight, which shifted by a day (or more, across DST) once serialized to UTC. Fixed at the source in `db.ts` via a `pg` type parser that returns `DATE` columns as raw `"YYYY-MM-DD"` strings; all date displays now explicitly format with `timeZone: "UTC"`.
