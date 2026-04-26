# MoneyOS Mobile

This is the Expo + React Native mobile app for Life Ledger MoneyOS.

MoneyOS is the first wedge of Life Ledger: a trusted consumer ledger that starts with financial cashflow intelligence and can later expand into broader life-data workflows.

## Stack

- Expo
- React Native
- TypeScript
- Expo Router
- Zustand

## Requirements

- Node.js `20`
- npm `10` or later

## Setup

```bash
cd mobile
npm install
```

To load example environment values:

```bash
cd mobile
cp .env.example .env
```

## Run

```bash
cd mobile
npm start
```

Useful shortcuts:

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run typecheck`

## API Configuration

The app reads the backend base URL from:

- `EXPO_PUBLIC_API_BASE_URL`

If not set, it defaults to:

- `http://127.0.0.1:8000`

Example:

```bash
cd mobile
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8000 npm start
```

Use your machine's local network IP when testing on a physical phone.

## Local Testing

1. Start the backend:

```bash
cd backend
uvicorn app.main:app --reload
```

2. Start the mobile app:

```bash
cd mobile
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8000 npm start
```

3. Open it with:

- Expo Go on a physical device
- Android emulator
- iOS simulator

## Packaged Build Testing

This project now includes `EAS` build profiles for development, preview, and production.

### Preview APK For Android Testing

```bash
cd mobile
npx eas login
npm run build:android:preview
```

This profile builds an internal-distribution Android `apk`, which is the easiest format for manual device testing.

### Production Android Bundle

```bash
cd mobile
npm run build:android:production
```

This creates an Android App Bundle for release workflows.

### Preview iOS Build

```bash
cd mobile
npm run build:ios:preview
```

### Production iOS Build

```bash
cd mobile
npm run build:ios:production
```

## Build Profiles

- `development`: internal development client build
- `preview`: internal test build, Android outputs an `apk`
- `production`: release-oriented build, Android outputs an `aab`

The app variant is controlled by:

- `EXPO_PUBLIC_APP_VARIANT`

Current variants:

- `dev`
- `preview`
- `production`

These variants change the app name, URL scheme, and package identifiers so test builds do not collide with production installs.

## Notes For Real Device Testing

- use your machine's LAN IP, not `127.0.0.1`
- make sure the backend allows connections from your phone
- if the device cannot reach your local machine, use a tunnel or hosted API

## Test Checklist

Use [TESTING.md](/Users/Abhay/life-ledger/mobile/TESTING.md) for the first manual QA pass across onboarding and persona dashboards.

## Current Scope

The first scaffold includes:

- onboarding flow
- persona-based home dashboards
- tab navigation
- demo auth and onboarding API wiring
- dashboard summary fetching

Next screens like add-entry forms, CSV import, loans, and AI coach can now plug into this structure.
