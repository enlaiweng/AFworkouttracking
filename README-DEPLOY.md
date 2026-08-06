# Deploying the AF Conditioning Challenge to Cloudflare

This is the production version of the team workout tracker: a static React app on Cloudflare Pages, three small API functions, and a D1 database holding the roster and every entry. Same platform shape as your wellness tracker.

## What changed from the Claude artifact

- Shared storage became a D1 database. Each workout is its own row, so two devices can never overwrite each other.
- The leaderboard is now one SQL query on the server instead of 47 parallel reads. The rate limit concern from the scale report no longer applies.
- The server validates everything itself: roster allowlist, activity types, the 24-hour cap, the future-date guard. It also recomputes points from minutes, so the phone's math is a preview, not the record.
- "This device remembers you" now uses localStorage, which is the normal tool for that job on a real website.
- All accessibility work carried over unchanged.
- Added and fixed wrangler.toml
- Added worker.js
  

## Prerequisites

- A free Cloudflare account (dash.cloudflare.com)
- Node.js 18 or newer
- About fifteen minutes

## Deploy, step by step

Unzip the bundle, then from inside the `afc-cloudflare` folder:

**1. Install dependencies**
```
npm install
```

**2. Log in to Cloudflare** (opens a browser window once)
```
npx wrangler login
```

**3. Create the database**
```
npx wrangler d1 create afc-challenge
```
The output includes a `database_id`. Open `wrangler.toml` and replace `PASTE-YOUR-DATABASE-ID-HERE` with it.

**4. Load the schema and the 46-paddler roster**
```
npx wrangler d1 execute afc-challenge --remote --file=schema.sql
```

**5. Build the site**
```
npm run build
```

**6. Deploy**
```
npx wrangler pages deploy
```
First run asks you to create the Pages project. Accept the name `afc-challenge` and the `main` branch. When it finishes you get a URL like `https://afc-challenge.pages.dev`. That link is the app. Text it to the crew.

## Trying it locally first (optional but smart)

```
npx wrangler d1 execute afc-challenge --local --file=schema.sql
npm run build
npx wrangler pages dev
```
Opens the app at a localhost address with a local copy of the database, API included. Log a workout, check the board, delete the entry. Nothing touches production.

## Shipping updates later

Edit, then:
```
npm run build && npx wrangler pages deploy
```
Live in about a minute.

## Backups and exports

The weekly captain ritual from the QA plan now has a real command:
```
npx wrangler d1 execute afc-challenge --remote \
  --command "SELECT m.name, m.team, SUM(e.pts) AS pts, COUNT(DISTINCT e.date) AS days FROM entries e JOIN members m ON m.slug=e.slug WHERE e.date LIKE '2026-08%' GROUP BY e.slug ORDER BY pts DESC"
```
Paste the output wherever the team keeps records. A full raw export is `SELECT * FROM entries`. Because dates are stored, September starts automatically and August history is preserved for a future month-view.

## Costs and limits

The free tier covers this team many times over: D1 allows five million reads a day, Pages Functions one hundred thousand requests a day. Forty-six paddlers checking a leaderboard will not get close.

## Honest notes

- Identity is still honor-system by design, the same trust level the spreadsheet had. The server's roster check stops outsiders, not impersonation.
- This production build compiles clean and its functions are syntax-verified, but it has not yet been through the 27-test suite, which targeted the artifact version. The suites port with a small fetch mock. Sensible sequence: run August's pilot on the tested artifact, stand this up in parallel, port the tests, and cut the team over on September 1 with a clean month.
- Custom domain, month history views, and real sign-in are natural v1.1 items once the pilot proves the habit.
