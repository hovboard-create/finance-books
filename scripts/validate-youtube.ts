/**
 * Validates every youtube_id in editorial.json + books.json via YouTube's
 * oembed endpoint. A 200 response means the video exists and is embeddable.
 * Anything else (404 / 401 / private / removed) is flagged.
 *
 * Run this BEFORE committing any new youtube_id. The risk we're guarding
 * against: an LLM (or human) typing a plausible-looking 11-char ID that
 * doesn't correspond to a real video — the iframe silently renders
 * "Video unavailable" without us noticing.
 *
 * Usage: npx tsx scripts/validate-youtube.ts
 *        npx tsx scripts/validate-youtube.ts ID1 ID2 ...   (validate ad-hoc)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type CandidateSource = {
  slug: string;
  field: "editorial.youtube_id" | "books.youtube_id";
  youtube_id: string;
};

async function validateId(id: string): Promise<{
  ok: boolean;
  status: number;
  title: string | null;
  author: string | null;
}> {
  const url = `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${encodeURIComponent(id)}&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, status: res.status, title: null, author: null };
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      ok: true,
      status: res.status,
      title: data.title ?? null,
      author: data.author_name ?? null,
    };
  } catch (e) {
    return { ok: false, status: 0, title: null, author: null };
  }
}

function collect(): CandidateSource[] {
  const root = resolve(__dirname, "..");
  const out: CandidateSource[] = [];

  try {
    const editorial = JSON.parse(
      readFileSync(resolve(root, "data/editorial.json"), "utf8")
    ) as Record<string, { youtube_id?: string | null }>;
    for (const [slug, ed] of Object.entries(editorial)) {
      if (ed.youtube_id) out.push({ slug, field: "editorial.youtube_id", youtube_id: ed.youtube_id });
    }
  } catch {}

  try {
    const books = JSON.parse(
      readFileSync(resolve(root, "data/books.json"), "utf8")
    ) as Array<{ slug: string; youtube_id?: string | null }>;
    for (const b of books) {
      if (b.youtube_id) out.push({ slug: b.slug, field: "books.youtube_id", youtube_id: b.youtube_id });
    }
  } catch {}

  return out;
}

async function main() {
  const cliIds = process.argv.slice(2);

  const items: CandidateSource[] =
    cliIds.length > 0
      ? cliIds.map((id) => ({ slug: "(cli)", field: "books.youtube_id" as const, youtube_id: id }))
      : collect();

  if (items.length === 0) {
    console.log("No youtube_id values found in editorial.json or books.json.");
    console.log("Pass IDs as args to validate ad-hoc: npx tsx scripts/validate-youtube.ts <id1> <id2>");
    return;
  }

  console.log(`Validating ${items.length} youtube_id value(s)…\n`);

  let ok = 0;
  let bad = 0;

  for (const item of items) {
    const result = await validateId(item.youtube_id);
    if (result.ok) {
      console.log(
        `✓ ${item.youtube_id}  ${item.slug.padEnd(40)} ${result.title?.slice(0, 60) ?? ""}`
      );
      ok++;
    } else {
      console.log(
        `❌ ${item.youtube_id}  ${item.slug.padEnd(40)} (status ${result.status}) — REMOVE OR REPLACE`
      );
      bad++;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n--- ${ok} valid, ${bad} broken ---`);
  if (bad > 0) process.exit(1);
}

main();
