<div align="center">

# Souvenir

**Don't just take souvenirs from places. Leave them for others to find.**

A mobile app for leaving small personal gifts at real-world places,
and finding the ones other people have left for you.

</div>

---

## About

Every place is full of stories nobody wrote down: the bench that has held a thousand tired people, the wall that watched the weather change its mind.

Souvenir lets you leave something there. A poem, an essay, a playlist, a piece of digital art, each tied to an ordinary object and a clue. Someone nearby follows your words, finds the same spot, and unlocks what you left.

## Features

- **Leave a gift.** Attach text, an image, a file or a link to a still object such as a bench, wall or tree.
- **Write a clue.** Up to 200 words, so the right person can find the object.
- **Set a limit.** Choose how many people can claim your gift.
- **Discover nearby.** See quests within 5 km on the map.
- **Prove you were there.** Take a live camera photo from the same spot within 1 minute to unlock the gift.

## How it works

| Step | What happens |
|---|---|
| **1. Leave** | The creator photographs an object, attaches a gift, writes a clue and sets a claim limit. |
| **2. Discover** | Users within 5 km see the quest on the map with an approximate pin. |
| **3. Find** | The finder follows the clue and takes a live photo of the object within 1 minute. |
| **4. Unlock** | The server checks the photo and the location, then unlocks the gift. |

## Tech stack

| Layer | Choice |
|---|---|
| App | Expo (React Native), TypeScript, Expo Router (`src/` folder) |
| Authentication | Clerk via `@clerk/expo` v3 |
| Backend | Supabase: Postgres + PostGIS, Row Level Security, Storage, Edge Functions |
| Auth bridge | Clerk native third-party auth. The user id is text (`user_2abc...`), read in SQL as `auth.jwt()->>'sub'` |

## Getting started

### Prerequisites

- Node.js and npm
- Xcode (iOS) or Android Studio (Android)
- A [Clerk](https://clerk.com) project and a [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
npm install
npx expo install expo-image-picker expo-document-picker expo-location expo-crypto react-native-maps
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-key
```

> The Supabase URL must be the bare project address. Do not add `/rest/v1` or a trailing `/`.

### 3. Set up the database

1. Run the files in `supabase/migrations/` in order, using the Supabase SQL Editor.
2. In the Supabase dashboard, add Clerk under **Authentication → Third-Party Auth**.

### 4. Add permissions

In `app.json`, add usage descriptions for the camera, photo library and location. Android maps also need a Google Maps API key.

### 5. Run the app

Google sign-in, maps and the camera need native code, so Expo Go will not work. Build a development client:

```bash
npx expo run:ios
# or
npx expo run:android
```

After changing `.env`, restart with a clean cache:

```bash
npx expo start -c
```

## Project structure

```
src/
├── app/
│   ├── (auth)/            Login and sign up
│   ├── (app)/             Signed-in screens
│   │   └── souvenir/      Souvenir list and "add yours"
│   └── _layout.tsx
├── components/
│   ├── CameraVerification.tsx
│   ├── ClueModal.tsx
│   ├── ScreenFrame.tsx
│   └── SouvenirMap.tsx
├── constants/theme.ts
├── lib/                   Supabase client
├── services/
│   ├── souvenirs.ts       Create and fetch souvenirs
│   ├── imageVerification.ts
│   ├── location.ts
│   └── routing.ts
└── types/souvenir.ts
supabase/
└── migrations/            Database schema, in order
```

## Privacy and security

- **Exact locations stay private.** The public map shows a point fuzzed by 50 to 200 m. The real coordinates are stored in a private table readable only by the creator and the server.
- **Gifts stay locked** until a verified claim, enforced by Row Level Security.
- **Only the server writes claims.** An edge function checks the one-minute window and the photo before anything unlocks.
- **Files are stored per owner** under `{user_id}/{souvenir_id}/{file}`, which the storage policies use to check ownership.
- **The 5 km radius is enforced in the database**, not just in the app.

## Status

All planned features are complete:

- [x] Splash screen and sign in (email, password, Google)
- [x] Souvenir list and upload screen
- [x] Quest screen with clue, map and camera verification
- [x] Claim edge function (time window, photo check, unlock)
- [x] Saved souvenirs 


---

<div align="center">

*Leave something small. Someone will find it.*

</div>
