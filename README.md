# CTrack

A local-first calorie and weight tracker that runs entirely in your browser. No
account, no server, no database required to get started — your data lives in
IndexedDB on your device. Optionally connect your own Firebase/Firestore project
to sync the same data across multiple devices.

CTrack is an installable PWA: add it to your home screen and it works offline.

## Features

### Overview (home)

A dashboard showing today at a glance:

- **Calorie target** — a radial gauge of today's net intake against your
  estimated daily goal. Your goal is derived from your stats using the
  **Mifflin–St Jeor** BMR equation scaled by your activity level (TDEE), minus
  your configured deficit.
- **Deficit** — a radial gauge tracking how much of your daily deficit remains
  after intake and exercise.
- **Weight** — your latest weight plus all-time-high / all-time-low and current
  goal mode.
- Quick **Add** (intake), **Burn** (exercise) and **Update** (weight) actions.

### Calories

Log meals and exercise. Each entry is a name plus an energy value; intake adds
calories and burned calories subtract. Previously entered items autocomplete so
re-logging is fast. A line chart plots your daily net intake against your
calorie target and TDEE, with summary stats (average intake, average TDEE, days
tracked). The list is grouped by day and lazy-loads as you scroll.

When adding intake you can also **scan a product barcode** (EAN/UPC) with your
camera. The barcode is looked up against [Open Food Facts]; the product name and
its energy value are pre-filled, and you set the portion in grams (energy is
scaled from the per-100&nbsp;g figure). Lookups are cached locally, so repeat
scans are instant and work offline. Manual entry continues to work exactly as
before when you don't scan.

### Weight

Track body weight over time, optionally with body-fat %, muscle % and visceral
fat. The chart plots your weight against BMI guide lines so you can see where you
sit, and stats show total change, monthly average and current BMI. The three BMI
lines adapt to you: they show the category boundaries surrounding your current
BMI (derived from your weight and height), so they stay on-screen whether you're
lean or heavy. You can also add your own custom reference lines (see
**Settings**). Entries lazy-load as you scroll and can be edited inline.

> On mobile, the charts on the Calories and Weight pages shrink to half height
> once you scroll down, so the data list gets more of the screen.

### Settings

- Edit your profile: age, height, starting weight, gender, activity level, goal
  (loss / gain / maintain) and daily deficit.
- **Weight Graph Lines** — add, edit and remove your own horizontal reference
  lines on the weight chart (a goal weight, a population average, …). Each line
  has a label, a value in kg and a colour.
- **Cloud Sync (Firebase)** — connect, update or disconnect a Firestore project
  (see [Firestore integration](#firestore-integration)).
- **Air-gapped credential transfer** — move your Firebase config between devices
  with no network by showing a QR code on one device and scanning it with the
  camera on another.
- **Data handling** — sync from Firebase to local, persist in-memory data to
  IndexedDB, and retry any writes that failed to reach Firebase.
- **Backup & Restore** — export your entire local database to a single JSON file
  and restore it later.
- **App updates** — force the PWA to fetch the latest version (useful when an
  installed copy is serving a cached build).

## Data & storage

CTrack is **local-first**. The storage layer always reads and writes IndexedDB;
when a Firebase config is present and reachable, writes are also pushed to
Firestore and newer cloud data is folded in on load. If Firebase is unreachable
or over quota, writes are queued in an IndexedDB **outbox** and replayed on the
next load (or via _Retry Failed Syncs_ in settings). Without a Firebase config,
everything stays on the device.

Data is organised into these collections / object stores:

| Collection        | Contents                              |
| ----------------- | ------------------------------------- |
| `userSettings`    | Profile and goal configuration        |
| `weightHistory`   | Weight entries (+ optional body comp) |
| `weightSettings`  | Custom weight-chart reference lines   |
| `calorieIntake`   | Logged food / drink                   |
| `calorieBurn`     | Logged exercise                       |
| `activityHistory` | Activity-level history                |

In addition, a local-only `foodCache` object store holds Open Food Facts barcode
lookups. It is a regenerable cache — never synced to Firebase and never included
in backups.

## Installation

### Prerequisites

- **Node.js 20+** and **npm**.

### Run locally

```bash
# 1. Clone the repository
git clone <your-fork-or-repo-url> ctrack
cd ctrack

# 2. Install dependencies
npm install

# 3. Start the dev server (http://localhost:5173)
npm run dev
```

### Build for production

The app builds to a static bundle in `build/` that you can host on any static
file server (GitHub Pages, Netlify, Vercel, an S3 bucket, nginx, …).

```bash
npm run build      # output in build/
npm run preview    # preview the production build locally
```

### Install as a PWA

Open the deployed (or previewed) app in a browser and use **Add to Home Screen**
/ **Install app**. Once installed it runs standalone and works offline. If an
installed copy keeps serving an old build, use **Settings → App Updates → Force
Update**.

### Firestore integration

Cloud sync is **optional** — the app is fully functional without it. To sync
your data across devices, connect your own Firebase project. CTrack uses only
the **Firestore Lite** client with the public web-app config (no Firebase Auth),
so the setup below is intended for a personal, single-user project.

1. **Create a Firebase project** at the
   [Firebase console](https://console.firebase.google.com/) (_Add project_).
2. **Create a Firestore database**: in the console, go to _Build → Firestore
   Database → Create database_. Pick a location.
3. **Register a web app**: _Project settings → General → Your apps → Web (`</>`)_.
   Give it a nickname and register it. Firebase shows a `firebaseConfig` object
   like:
   ```js
   const firebaseConfig = {
   	apiKey: 'AIza…',
   	authDomain: 'your-project.firebaseapp.com',
   	projectId: 'your-project',
   	storageBucket: 'your-project.firebasestorage.app',
   	messagingSenderId: '1234567890',
   	appId: '1:1234567890:web:abc123'
   };
   ```
   These are public project identifiers, not secrets.
4. **Set Firestore security rules**: because the app does not use Firebase Auth,
   access is governed entirely by your rules. For a private personal project,
   the safest option is to keep the database locked and only open access from
   trusted contexts (for example via [App Check], or by running against the
   emulator). Be aware that fully open rules such as the following make your data
   readable and writable by anyone who has the config:
   ```
   // WARNING: open access — anyone with the config can read/write.
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   Choose rules appropriate to how public your deployment is.
5. **Connect CTrack**: open **Settings → Cloud Sync (Firebase)**, paste the
   config fields (at minimum _API Key_ and _Project ID_), and press **Connect**.
   The app reloads and begins syncing. Collections are created automatically the
   first time data is written.
6. **(Optional) Copy the config to another device**: on the connected device,
   **Settings → Cloud Sync → Show QR**; on the other device, **Scan QR**, review
   the prefilled fields and press **Connect**.

Your Firebase config is stored only in that browser's IndexedDB and is never
included in JSON backups. Use **Disconnect** to remove it and return to
local-only mode (your local data is kept).

## TODO

- [x] Add Open Food Facts barcode lookup
      ([API](https://openfoodfacts.github.io/openfoodfacts-server/api/))
- [ ] Generate a predictive weight curve projecting one month ahead

## Attribution

Food product data is provided by [Open Food Facts], a collaborative, free and
open database, made available under the
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).

[Open Food Facts]: https://world.openfoodfacts.org/
