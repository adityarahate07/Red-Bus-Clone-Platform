# TedBus — Bus Booking Platform

TedBus is a full-stack bus booking application built with the MEAN stack and inspired by the familiar RedBus booking experience. Search routes, choose seats, manage trips, and explore travel-planning and community features in a responsive interface.

## Overview

The app combines a booking flow with six additional features: a travel community, event notifications, an interactive route planner, three-language support, light/dark themes, and verified route reviews. The Angular frontend can also run without the API, using local storage and mock-data fallbacks for supported features.

## Features

### Booking essentials
- Search bus routes between supported Indian cities and choose a travel date.
- Browse bus options, select seats from an interactive layout, enter passenger details, and continue to checkout.
- Sign in with Google OAuth or use the demo sign-in flow.
- View booked trips and manage trip and profile preferences.

### Additional features
| Feature | What it includes |
| --- | --- |
| **Travel community** (`/community`) | Publish journey stories and photos, search and sort posts, like and comment, share posts, and report or moderate content. |
| **Notifications** (`/notifications`) | Booking and trip alerts, promotional notifications, channel preferences, delivery status, retry, and read/unread history. |
| **Route planner** (`/route-planner`) | Leaflet/OpenStreetMap map, selectable locations and waypoints, route comparison, simulated traffic and ETAs, and saved routes. |
| **Languages** | Switch between English, Hindi, and Marathi without reloading the page. |
| **Themes** | Switch between light and dark themes; the selection is persisted. |
| **Route ratings & reviews** (`/select-bus`) | Verified journey reviews, route ratings, one review per booking, time-limited editing, and review reporting. |

The profile area also brings together trips, preferences, and community activity. When the API is available, the Express backend exposes endpoints for community posts, notifications, saved routes, and reviews.

## Tech stack

- **Frontend:** Angular 17, TypeScript, Angular Material, Tailwind CSS, RxJS, Leaflet.js
- **Backend:** Node.js, Express 4, MongoDB, Mongoose 8
- **Map data:** OpenStreetMap

## Run locally

### Requirements

- Node.js 18 or newer and npm
- MongoDB or a MongoDB Atlas connection for database-backed API features (optional for frontend fallback mode)

### 1. Start the API

In a terminal, configure the database connection in `frontend/server/.env` (copy `.env.example` and replace the sample URI if needed). The `.env` file is local-only and must not be committed. Then start the API:

```bash
cd frontend/server
npm install
npm start
```

The API listens on `http://localhost:5000`. If `MONGODB_URI` is not set, the server starts with a warning and database-backed API features are unavailable; supported frontend features can still use their local fallback data.

### 2. Start the Angular app

In a second terminal:

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200). The Angular development server reloads when source files change.

### 3. Create a production build

```bash
cd frontend
npm run build
```

The build output is written to `frontend/dist/frontend/browser`.

## Project layout

```text
frontend/
├── src/          Angular application, assets, and translations
├── server/       Express API and MongoDB models/routes
├── angular.json  Angular build and serve configuration
└── package.json  Frontend scripts and dependencies
```

## Deployment

The Angular app can be deployed as a static single-page application. For Vercel, use `frontend` as the project root, `npm run build` as the build command, and `dist/frontend/browser` as the output directory. For Netlify, use the same build command and output directory, with `frontend` as the base directory. Configure an SPA rewrite to `index.html` so direct navigation to Angular routes works.

The Express API is a separate service; configure its MongoDB connection and deployment environment independently. Do not commit credentials or environment-specific secrets.
