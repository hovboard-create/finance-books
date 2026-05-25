# finance-books.com

Amazon-affiliate reading guide to the best personal-finance books, curated by
life stage rather than generic bestseller lists. Built for organic SEO on
long-tail "best finance books for [audience]" keywords.

Next.js 16 (App Router) · SQLite (build-time only) · Tailwind v4. Follows the
repairyachts content-site blueprint.

## Architecture

Every page is **statically generated at build time**. SQLite is read only during
`next build` (via `generateStaticParams`) — there is no database at runtime, so
the deployed site is pure static HTML/CSS. Fast, cheap, and Vercel-friendly.

The database is rebuilt from JSON source files on every `dev` / `build` by the
`predev` / `prebuild` hook running `scripts/etl.ts`. There are no migrations to
manage — edit the JSON, restart.

## Data pipeline

Four source files in `data/`, each owned by a different workflow:

| File | What it holds | How it's updated |
|------|---------------|------------------|
| `books.json` | Hand-curated metadata: title, author, ASIN, cover URL, editor's rating | Manual, rarely |
| `editorial.json` | Editorial content: takeaway, key lessons, who-it's-for, buy_warning | Manual, when curating |
| `amazon-data.json` | Live ratings + prices from Amazon PA-API | `npm run refresh-amazon` (daily, when PA-API access is active) |
| `youtube-data.json` | Author-talk video IDs | `npm run fetch-youtube` (one-time + on demand) |

ETL merges them into the `books` table with this precedence for overlapping
fields (e.g. `youtube_id`): **editorial.json > auto-fetched data > books.json default**.

## Scripts

```bash
npm run dev               # ETL + dev server
npm run build             # ETL + production build (all static)
npm run etl               # rebuild the SQLite DB from data/*.json
npm run fetch-covers-ol   # resolve book covers via Open Library search API
npm run fetch-youtube     # find author-talk videos (needs YOUTUBE_API_KEY)
npm run validate-youtube  # check every youtube_id resolves via YouTube oembed
npm run refresh-amazon    # pull ratings + prices from PA-API (needs PA-API keys)
```

## External integrations

### Amazon affiliate links
Tag `hovboard-20` is baked into `src/lib/affiliate.ts` (override with
`NEXT_PUBLIC_AMAZON_TAG`). Links use the direct ASIN pattern — no API required.

### Amazon PA-API (ratings + prices) — ON HOLD
As of 2026-05, Amazon requires **10 qualifying sales in the trailing 30 days**
before granting PA-API access. Until the site qualifies, book pages show our own
**editor's rating** ("Our take") and no prices. The integration is fully
scaffolded (`scripts/refresh-amazon.ts`, schema columns, UI rendering) and will
light up automatically once `amazon-data.json` is populated.

**Never show prices without PA-API + a <24h refresh** — Amazon's Operating
Agreement forbids stale pricing. The "Buy on Amazon" CTA shows the live price at
click-through.

### Covers
Open Library search API → `cover_i` lookup. All covers are verified to return
real bytes (see `scripts/verify-covers.ts`). Google Books' unkeyed API quota is
throttled to 0 and is not usable.

### YouTube
Author talks fetched via YouTube Data API v3, **validated against the oembed
endpoint** so a hallucinated/dead video ID can never reach production. Run
`npm run validate-youtube` before any deploy.

## Environment

Copy `.env.example` to `.env.local` (gitignored) and fill in keys as you obtain
them. None are required to build — the site degrades gracefully without them.

## Deploy

Static export on Vercel. Root directory is this folder. Build command is the
default (`npm run build`), which runs the ETL first. No runtime env vars needed
for the static site; the API keys are only used by the data scripts.
