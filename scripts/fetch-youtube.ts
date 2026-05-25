/**
 * Fetches the best author-talk YouTube video for each book via YouTube Data
 * API v3, validates it exists via oembed, and writes to data/youtube-data.json.
 *
 * Cost: ~100 quota units per book (1 search call). 25 books = 2,500 units.
 * Free tier daily quota is 10,000 units, so we can re-run ~4x/day if needed.
 *
 * Setup:
 *   1. Enable YouTube Data API v3 at https://console.cloud.google.com
 *   2. Create an API key, add to .env.local:
 *        YOUTUBE_API_KEY=AIza...
 *   3. Run: npm run fetch-youtube
 *
 * Search strategy:
 *   We search "{title} {author} interview" with videoDuration=medium (4-20min)
 *   to filter out 30-second shorts and clickbait. We pick the top result whose
 *   ID passes oembed validation (i.e. the video still exists and is embeddable).
 *
 * Review workflow:
 *   After running, open data/youtube-data.json and skim the video_title field
 *   for each entry. If a result looks wrong (e.g. picked a generic "summary"
 *   channel instead of an author talk), search YouTube yourself and replace
 *   the video_id manually. Re-run `npm run validate-youtube` to confirm.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

type Book = {
  slug: string;
  title: string;
  author: string;
};

type YouTubeRow = {
  video_id: string;
  video_title: string;
  channel: string;
  search_query: string;
  fetched_at: string;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
      publishedAt: string;
    };
  }>;
  error?: { message: string };
};

function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function youtubeSearch(
  query: string,
  apiKey: string
): Promise<YouTubeSearchResponse> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoDuration", "medium");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("relevanceLanguage", "en");
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  return res.json();
}

async function isEmbeddable(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${videoId}&format=json`
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Strip "The ", subtitle after colon, and editor's voice from a search query.
function cleanTitle(title: string): string {
  return title
    .replace(/^The\s+/i, "")
    .replace(/[:].*$/, "")
    .replace(/[*]/g, "")
    .trim();
}

// First author only.
function firstAuthor(author: string): string {
  return author.split(/\s*[&,]\s*|\s+and\s+/i)[0].trim();
}

async function main() {
  loadEnv();
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("Missing YOUTUBE_API_KEY in .env.local");
    process.exit(1);
  }

  const root = resolve(__dirname, "..");
  const books = JSON.parse(
    readFileSync(resolve(root, "data/books.json"), "utf8")
  ) as Book[];

  // Preserve any existing youtube-data.json so manual overrides survive a re-run
  const outPath = resolve(root, "data/youtube-data.json");
  let existing: Record<string, YouTubeRow> = {};
  if (existsSync(outPath)) {
    try {
      existing = JSON.parse(readFileSync(outPath, "utf8"));
    } catch {}
  }

  const out: Record<string, YouTubeRow> = { ...existing };
  let found = 0;
  let skipped = 0;

  for (const book of books) {
    // Skip if already manually curated (we don't overwrite — re-runs are additive)
    if (existing[book.slug]) {
      console.log(`↪ ${book.slug.padEnd(40)} (already set: ${existing[book.slug].video_id})`);
      skipped++;
      continue;
    }

    const queries = [
      `${cleanTitle(book.title)} ${firstAuthor(book.author)} interview`,
      `${cleanTitle(book.title)} ${firstAuthor(book.author)} talk`,
      `${firstAuthor(book.author)} ${cleanTitle(book.title)}`,
    ];

    let chosen: YouTubeRow | null = null;

    for (const query of queries) {
      const result = await youtubeSearch(query, apiKey);
      if (result.error) {
        console.error(`❌ API error: ${result.error.message}`);
        process.exit(1);
      }
      const items = result.items ?? [];
      for (const item of items) {
        const ok = await isEmbeddable(item.id.videoId);
        if (ok) {
          chosen = {
            video_id: item.id.videoId,
            video_title: item.snippet.title,
            channel: item.snippet.channelTitle,
            search_query: query,
            fetched_at: new Date().toISOString(),
          };
          break;
        }
      }
      if (chosen) break;
    }

    if (chosen) {
      out[book.slug] = chosen;
      console.log(
        `✓ ${book.slug.padEnd(40)} ${chosen.video_id}  "${chosen.video_title.slice(0, 55)}" (${chosen.channel})`
      );
      found++;
    } else {
      console.log(`❌ ${book.slug.padEnd(40)} no embeddable result found`);
    }

    // Polite throttle: YouTube allows 100 units/sec but no need to push it
    await new Promise((r) => setTimeout(r, 300));
  }

  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`\n--- Summary ---`);
  console.log(`✓  ${found} new videos found`);
  console.log(`↪ ${skipped} already curated, untouched`);
  console.log(`Total entries: ${Object.keys(out).length}`);
  console.log(`\nReview titles in ${outPath}, swap any bad picks manually, then re-run ETL.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
