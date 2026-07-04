# Dicey Movements

A fitness PWA that combines dice-rolled workouts with timers, social competition, and territorial zone battles.

## Features

### Game

- **Dice-based workouts** — Roll dice to pick an exercise and rep count from your active split
- **Workout splits** — Full Body, Upper Body, Lower Body, Cardio, Arms & Abs, Mindfulness
- **Timer** — Customizable countdown with pause, resume, reset, and Roll & Start
- **Exercise multipliers** — Repeating an exercise in a session increases its rep multiplier
- **Daily sessions** — Multipliers reset when the calendar day rolls

### Territory Heists

- **Zone map** — Claimed zones appear on an interactive map (`/map`, nav: **Heists**)
- **~2 km grid zones** — Each completed set is tagged to the zone where you are when you finish it
- **Zone Captain** — Most reps in a zone over the rolling last 7 days
- **Dice Heist** — Overtake a zone captain for a celebratory modal with confetti
- **Map colors** — Green = your zones, blue = friend zones, red = everyone else
- **Fresh GPS** — Location is resolved in the background on each set completion so reps credit the right zone

### Social

- **Friends** — Send and accept friend requests
- **Activity feed** — See friend workouts
- **Leaderboard** — Compare reps, sets, and Oura steps over time ranges
- **High fives** — React to friend activity
- **Push notifications** — Timer, achievements, friend activity, and friend requests (PWA)

### Other

- **Achievements** — Unlock badges for streaks, workouts, and milestones
- **Oura integration** — Sync steps and activity data ([setup guide](./OURA_SETUP.md))
- **Cross-device timer sync** — Timer state syncs across devices via Supabase
- **PWA** — Installable app with service worker and offline shell

## App Pages

| Route | Description |
|-------|-------------|
| `/` | Game — timer, dice, workout, history, stats |
| `/friends` | Friend search, requests, and management |
| `/activity` | Friend activity feed |
| `/map` | Territory Heists map and zone standings |
| `/oura/callback` | Oura OAuth callback |

## Tech Stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Routing | React Router v6 |
| Database & Auth | Supabase (Postgres + RLS) |
| Map | Leaflet, react-leaflet, OpenStreetMap tiles |
| Backend | Express on Render — push notifications, Oura sync, social alerts |
| Deploy | Netlify (frontend), Render (backend) |

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- (Optional) Backend deployed or running locally for push notifications and Oura

### Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:

   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_BACKEND_URL=https://your-backend.onrender.com
   ```

4. Run database migrations in the Supabase SQL editor as needed, including:
   - `create_activities_table.sql`
   - `create_zone_competition.sql` — zone scoring and `get_zone_captains()` RPC

5. Start the dev server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:5173`

### Backend

The Express API lives in `backend/`. See `backend/package.json` for scripts. It handles web push (VAPID), friend activity notifications, Oura OAuth/webhooks, and workout completion alerts.

## Zone Competition

Zones are geographic grid cells (~2 km) derived from GPS at set completion time.

- Each `activities` row stores a `zone_id`
- Captain standings use a rolling 7-day window
- The Heists map shows only claimed zones as soft gradient circles
- Profile location updates in the background after each set for map accuracy

Run `create_zone_competition.sql` in Supabase before using Heists.

## Timer & State Sync

Timer state is synced through Supabase (`profiles` timer columns + realtime), not just localStorage. This supports:

- Phone lock / unlock
- Switching tabs or devices
- Master/slave device behavior when multiple devices are open

Workout progress (activities, streaks, zone reps) is stored in Supabase.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build + service worker cache bust |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
