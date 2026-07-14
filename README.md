# Vanakias — Fleet Management App

A full-stack fleet management platform for managing vehicles, drivers, and maintenance history.

## Stack

| Layer | Tech |
|---|---|
| API | Node.js · Express · PostgreSQL |
| Web | React · Vite · TypeScript |
| Mobile | Expo · React Native |
| Shared | TypeScript types (monorepo) |

## Features

### Fleet
- Add, edit, and archive vehicles
- Track license plate, brand, model, type (van / truck / bike)
- Fuel type (gas / diesel / electric), capacity, and lease date
- Operational status: Operational · On Route · In Maintenance · Non Operational
- Filter vehicles by status, sort alphabetically
- Full maintenance log per vehicle (oil change, brake pads, etc.)

### Drivers
- Add and manage drivers with contact info
- Assign vehicles to drivers (bidirectional sync)
- Driver status: Available · On Duty · Offline

### Dashboard
- Live fleet stats by status and type
- Driver availability overview
- Vehicles currently in maintenance

### UI
- Claude-themed color palette (coral `#D97757`, dark charcoal nav)
- Nunito rounded font
- Animated pop-up modals
- Fully responsive — works on desktop and mobile browser

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 16

### Setup

```bash
# Install dependencies
npm install

# Set up environment
cp apps/api/.env.example apps/api/.env
# Edit DATABASE_URL in apps/api/.env

# Start the API (auto-creates tables)
npm run dev:api

# Start the web dashboard
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To access from your phone, use your local IP:
```
http://<your-local-ip>:3000
```

### Mobile App

```bash
npm run dev:mobile
```

## Project Structure

```
logistics-app/
├── apps/
│   ├── api/          # Express + PostgreSQL REST API (port 3001)
│   ├── web/          # React + Vite dashboard (port 3000)
│   └── mobile/       # Expo driver app
└── packages/
    └── shared/       # Shared TypeScript types
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/vehicles` | List or create vehicles |
| PUT | `/api/vehicles/:id` | Update vehicle |
| GET/POST | `/api/drivers` | List or create drivers |
| PUT | `/api/drivers/:id` | Update driver (syncs vehicle assignment) |
| GET/POST | `/api/maintenance/:vehicleId` | Maintenance log per vehicle |
