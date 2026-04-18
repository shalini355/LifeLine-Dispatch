# LifeLine Dispatch

This project is a local dispatch simulation built with React, Vite, Express, and Leaflet. The backend serves the frontend and simulates ambulance assignment, routing, hospital load, and live incident updates.

## Prerequisites

- Node.js 20+ (Node 22 recommended)
- npm

## Run locally

1. Install dependencies:
   `npm install`
2. Start the app:
   `npm run dev`
3. Open:
   `http://localhost:3000`

## Available scripts

- `npm run dev` starts the Express server and Vite middleware in development mode.
- `npm run build` creates a production frontend build in `dist/`.
- `npm run preview` previews the Vite production build.
- `npm run lint` runs TypeScript type-checking.
- `npm run clean` removes the `dist/` directory in a cross-platform way.

## Notes

- No Gemini API key is required for the current app flow.
- If the live OSRM routing service is unavailable, the simulation now falls back to a direct path so dispatch still works.
