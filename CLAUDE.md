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
