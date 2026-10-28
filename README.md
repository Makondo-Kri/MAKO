# Tiny Crowd

A QR-accessible social game for real-world events. Attendees scan a code, make a tiny toy version of themselves, and drop into a shared virtual hall where they can wave, play a 40-second mini-game, and invite each other to meet at real spots in the venue.

> The game is the excuse. Meeting people is the reward.

No app install and no account. A nickname is enough.

---

## What's in the MVP

| Area | Status |
|---|---|
| Landing page, event link / QR entry | ✅ |
| Nickname + toy creator (5 characters × 9 colors × accent × 7 accessories) | ✅ |
| Optional "colors from a photo" (on device, never uploaded) | ✅ |
| Shared 3D hall: Main Hall, Coffee Corner, Play Zone, meetup spot pins | ✅ |
| Real-time presence, tap-to-walk, live movement | ✅ |
| Waves, emoji reactions, preset icebreaker messages | ✅ |
| Game invites → **Sync Up** mini-game (5 this-or-that rounds, ~40s) | ✅ |
| Meetup invites to organizer-defined venue spots (accept / not now / cancel / expire) | ✅ |
| "Find-me" badge screen to spot each other in person | ✅ |
| Block and report | ✅ |
| Leave event, reconnect after network drops (45s grace) | ✅ |
| Organizer: create event, QR code, live dashboard with real metrics | ✅ |
| Demo bots (clearly labelled, excluded from metrics) for solo testing | ✅ |
| Loading, empty, error, offline states | ✅ |

### Deliberately not in the MVP (future roadmap)

- AI selfie → 3D toy generation (the photo feature only picks colors, and says so)
- More mini-games, achievements, collectible accessories
- Event-branded environments and sponsored zones
- Accounts, cross-event profiles, reconnecting after the event
- Payments and subscriptions
- Event-platform integrations
- Horizontal scaling across multiple servers (see "Limits" below)

---

## How it works (plain-language architecture)

```
 Phone browser ──(WebSocket)──►  One Node.js server  ──►  data/*.json
  React + 3D                      • serves the web app      (event settings
                                  • runs live event rooms     + metrics only)
                                  • organizer API
```

- **Frontend:** React + TypeScript, built with Vite. Styling with Tailwind using a small design-token set (`tailwind.config.js`). 3D with React Three Fiber / Three.js. The toys are built in code from simple rounded shapes, so there are no model files to download and dozens of toys render smoothly on ordinary phones.
- **Realtime:** Socket.IO on a single Node server. Each event is a "room" held in memory (`server/room.ts`). Every message from a phone is validated with zod (`shared/protocol.ts`) and rate-limited.
- **Storage:** event settings and aggregate metrics are written to small JSON files in `data/`. Participants, messages and game answers are **never** written to disk.

### Why not Next.js + a managed realtime service?

Next.js is usually deployed to Vercel, which can't hold open WebSocket connections, so we'd need a second service for realtime anyway. Managed options (Supabase Realtime, Liveblocks, PartyKit, Ably) all work, but each adds an account, keys and a pricing tier before you've learned anything from a pilot. One small Node process that serves both the app and the realtime connection is the simplest thing that works, and it's cheap to host. If the pilot works, we can move rooms to Colyseus or a managed service later. Room logic is kept separate from networking so it can be ported.

---

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev
```

- Web app: http://localhost:5173 (Vite, with hot reload)
- API + realtime: http://localhost:3001 (Vite forwards `/api` and `/socket.io` to it)

Open **http://localhost:5173/e/demo** to join the built-in demo event (it has demo bots). Its organizer dashboard is at **http://localhost:5173/organize/demo?key=demo**.

### Test with your phone on the same Wi-Fi

`npm run dev` prints a "Network" address such as `http://192.168.1.20:5173`. Open `<that address>/e/demo` on your phone and on your laptop: you'll see each other's toys.

### Tests

```bash
npm test          # starts a real server and connects two independent clients
npm run typecheck
```

The multiplayer test covers join, presence, movement clamping, waves, malformed and duplicate actions, a full Sync Up game, declined and accepted meetups, disconnect → away → resume, leave, blocking and nickname validation.

---

## Deploy

It's a single Node service. Any host that supports long-running Node processes and WebSockets works.

**Render (simplest):**
1. Push this repo to GitHub.
2. Render → New → Web Service → pick the repo.
3. Build command: `npm ci && npm run build`. Start command: `npm start`.
4. Add a **persistent disk** mounted at `/var/data` and set `DATA_DIR=/var/data`. Without it, metrics reset on each deploy.
5. Set `DEMO_ORGANIZER_KEY` to something private and `PUBLIC_URL` to your service URL (for example `https://tinycrowd.onrender.com`).

Cost: a paid instance (from about $7/month) plus a small disk. The free tier sleeps when idle, which is fine for trying it out but not for a live event.

**Railway / Fly.io:** same build and start commands. Attach a volume for `DATA_DIR`.

Not suitable: Vercel or Netlify, because they are serverless and can't keep WebSocket connections open.

### Environment variables

See `.env.example`.

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (hosts usually set this) |
| `PUBLIC_URL` | Public address used in QR codes |
| `DATA_DIR` | Where event JSON files are saved |
| `DEMO_ORGANIZER_KEY` | Dashboard key for the built-in `demo` event |
| `ALLOW_EVENT_CREATION` | `false` stops the public from creating events at `/organize` |

---

## Running a pilot

1. Go to `/organize` and create the event. Name 3–6 **real, easy-to-find spots** (for example "Coffee bar — by the stairs").
2. **Bookmark the dashboard link** you're sent to. It contains your private organizer key.
3. Download the QR code from the dashboard and put it on signs, badges or the main screen.
4. Optionally switch on demo bots for the first half hour, so early arrivals aren't alone, then switch them off.
5. Watch the dashboard. The meetups-accepted number is the main signal of whether strangers actually met.

---

## Privacy and safety

- Only a nickname and toy are shared with other attendees. There are no contact details and no real location.
- The "colors from a photo" option runs entirely in the browser: the image is scaled to 48×48 pixels, two colors are picked, and it's discarded. Nothing is uploaded.
- Messages are preset icebreakers only, so there is no free text to moderate.
- Meetup invites always need an explicit accept, expire after 2 minutes, and can be cancelled or called off.
- Block hides both people from each other's interactions. Report also blocks, and the organizer sees an anonymous count plus the reported nickname and reason.
- Every action is validated on the server and rate-limited per person.
- **Retention:** participants are removed when they leave or 45s after disconnecting. Finished invites are forgotten after 30 minutes. Only event settings and aggregate counts are saved. Delete `data/<event-id>.json` to erase an event.

---

## Limits to know about

- One server process holds all rooms in memory. That's comfortably hundreds of people per event. Beyond that, or for several servers, rooms would need moving to Redis, Colyseus or a managed realtime service.
- Organizer keys are bearer links: anyone with the dashboard link can see the metrics.
- Event creation at `/organize` is open by default (rate-limited per IP). Set `ALLOW_EVENT_CREATION=false` for a private deployment.

## Project map

```
shared/        content catalog (toys, zones, questions) + message schemas
server/        index.ts (HTTP + sockets), room.ts (event logic), store.ts (JSON files), tests
src/three/     Toy.tsx (procedural toys), Hall.tsx (scene + camera), Environment.tsx (venue)
src/screens/   Landing, EventFlow (welcome), Creator, HallScreen, Panels, GameOverlay
src/organizer/ OrganizerCreate, Dashboard
src/lib/       client.ts (live state + socket), storage, router, photoColors
```
