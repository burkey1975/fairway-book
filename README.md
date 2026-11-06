# Fairway Book

A golf group app in the style of Golf GameBook: live scoring, game formats, live leaderboards across everyone's phones, stats, an estimated handicap and 3-2-1 player votes with a season tally.

- **App:** Expo (React Native), Expo Router, TypeScript
- **Backend:** Supabase: email sign-in, Postgres with row-level security, Realtime, and one Edge Function
- **Course data:** [GolfCourseAPI.com](https://golfcourseapi.com), called from the Edge Function so the API key never ships in the app

## Features

| | |
|---|---|
| Scoring | Hole by hole: strokes, putts, fairway (hit / missed left / missed right). GIR is worked out from strokes and putts. Anyone in the group can mark anyone's card. |
| Formats | Stroke play (net/gross), Stableford, singles match play, skins (net, with carry-overs). WHS course handicap, adjustable allowance %. |
| Live leaderboard | Updates on every phone in the round through Supabase Realtime. |
| Joining | Each round has a 6-letter code. Friends join with it, or claim the guest spot the organiser added for them. |
| Courses | Search GolfCourseAPI (results are cached in your database), or enter a course by hand. |
| Stats | Rounds, average and best score, putts per 18, GIR %, fairways and miss direction, scoring mix, last 10 scores, estimated handicap (WHS: best differentials of the last 20, net double bogey cap). |
| Votes | After a round, each player gives 3-2-1 votes on their own phone. The organiser votes for guests who don't have the app. The Votes tab shows the Player of the Year table. |

## Setup

You need Node 20+, a free [Supabase](https://supabase.com) project and a [GolfCourseAPI](https://golfcourseapi.com) key.

### 1. Backend (Supabase)

```bash
npx supabase login
npx supabase init                         # creates supabase/config.toml; keep the existing folders
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push                      # creates tables, security rules and realtime
npx supabase secrets set GOLFCOURSEAPI_KEY=your_key_here
npx supabase functions deploy course-search
```

Then, in the Supabase dashboard:

- **Authentication → Email Templates → Magic Link:** add `{{ .Token }}` to the email body. The app signs in with a 6-digit code, so it needs no deep-link setup.
- Optional for production: **Authentication → SMTP**. Supabase's built-in email sender is heavily rate-limited.

### 2. App

```bash
cp .env.example .env                      # fill in your project URL and anon/publishable key
npm install
npx expo install --fix                    # aligns package versions with the Expo SDK
npx expo start
```

Scan the QR code with **Expo Go**. If Expo Go reports an incompatible SDK, either upgrade with `npx expo install expo@^57.0.0 --fix` or run a development build with `npx expo run:ios` / `npx expo run:android`.

To run it in a web browser instead: `npx expo start --web`.

### Putting it online

See **[DEPLOY.md](DEPLOY.md)** for step-by-step instructions to upload to GitHub, host it as a website on Vercel, and optionally publish to the App Store and Play Store.

### 3. Tests

```bash
npm test          # scoring engine: handicaps, Stableford, match play, skins, WHS differentials, stats, votes
npm run typecheck
```

## Project layout

```
app/                      screens (Expo Router)
  sign-in.tsx             email code sign-in
  (tabs)/                 Play · Rounds · Stats · Votes · Profile
  round/new.tsx           course search, tee, format, guests
  round/[id]/index.tsx    hole-by-hole scoring
  round/[id]/leaderboard.tsx, card.tsx, votes.tsx
  course/new.tsx          manual course entry
src/lib/golf.ts           scoring engine (pure TypeScript, unit tested)
src/lib/api.ts            Supabase queries
src/hooks/useRound.ts     round state + realtime + debounced score saving
supabase/migrations/      schema, row-level security, join-by-code functions
supabase/functions/course-search/   GolfCourseAPI proxy + cache
tests/golf.test.ts
```

## Who can see and change what

All of this is enforced in the database, not just the app:

- Only players in a round (and its organiser) can see its scores, players and votes.
- Any player in the round can enter scores. Only the organiser can add guests, finish the round or delete it.
- Votes can only be cast as yourself, or by the organiser for a guest. Nobody can vote for themselves.
- Courses from GolfCourseAPI are read-only. Manual courses can only be edited by whoever added them.

## Known limits / next steps

- Match play is singles only. Fourball, team and Texas scramble formats aren't included yet.
- Manual courses have one tee each. Add another tee by entering the course again with a different tee name.
- The handicap is an estimate, not an official index. 9-hole rounds don't count toward it.
- Not included yet: GPS distances to the green, push notifications ("your mate just birdied"), societies and seasons beyond the calendar year, profile photos.
- Before publishing to the App Store or Play Store, change `bundleIdentifier` / `package` in `app.json`, then build with EAS (see DEPLOY.md).
