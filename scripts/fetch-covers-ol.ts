/**
 * Uses Open Library's search API to find the best cover_i for each book,
 * then verifies the cover_id URL actually returns a real image (>2KB).
 * Updates books.json in place.
 *
 * Why this works better than direct ISBN-based covers:
 * - OL has 25+ editions of popular books; one of them usually has a real cover
 * - search.json returns the most popular edition's cover_i
 * - covers.openlibrary.org/b/id/{cover_i}-L.jpg redirects to archive.org but returns real bytes
 *
 * Usage: npx tsx scripts/fetch-covers-ol.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Book = {
  slug: string;
  title: string;
  author: string;
  isbn13: string | null;
  cover_url: string | null;
  ol_cover_id?: number | null;
  [key: string]: unknown;
};

type OLSearchResult = {
  docs: Array<{
    cover_i?: number;
    title?: string;
    author_name?: string[];
    edition_count?: number;
    isbn?: string[];
  }>;
};

async function searchOL(title: string, author: string) {
  // Strip subtitle/edition junk to improve match rate
  const cleanTitle = title.replace(/[*]/g, "").trim();
  const firstAuthor = author.split(/\s*[&,]\s*|\s+and\s+/i)[0];
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(firstAuthor)}&limit=5&fields=cover_i,title,author_name,edition_count,isbn`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as OLSearchResult;
  return data.docs ?? [];
}

async function verifyCover(coverId: number): Promise<{ ok: boolean; size: number }> {
  try {
    const res = await fetch(
      `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
      { redirect: "follow" }
    );
    if (!res.ok) return { ok: false, size: 0 };
    const blob = await res.blob();
    return { ok: blob.size >= 2000, size: blob.size };
  } catch {
    return { ok: false, size: 0 };
  }
}

async function main() {
  const root = resolve(__dirname, "..");
  const booksPath = resolve(root, "data/books.json");
  const books = JSON.parse(readFileSync(booksPath, "utf8")) as Book[];

  console.log(`Resolving covers for ${books.length} books via Open Library search…\n`);

  let updated = 0;
  let failed = 0;

  for (const book of books) {
    const results = await searchOL(book.title, book.author);
    // Sort by edition_count (most editions = most popular = best cover)
    results.sort((a, b) => (b.edition_count ?? 0) - (a.edition_count ?? 0));

    let chosen: { coverId: number; size: number } | null = null;
    for (const r of results) {
      if (!r.cover_i) continue;
      const v = await verifyCover(r.cover_i);
      if (v.ok) {
        chosen = { coverId: r.cover_i, size: v.size };
        break;
      }
    }

    if (chosen) {
      book.cover_url = `https://covers.openlibrary.org/b/id/${chosen.coverId}-L.jpg`;
      book.ol_cover_id = chosen.coverId;
      console.log(`✓ ${book.title.padEnd(50)} cover_i=${chosen.coverId} (${chosen.size}b)`);
      updated++;
    } else {
      book.cover_url = null;
      book.ol_cover_id = null;
      console.log(`❌ ${book.title.padEnd(50)} no working cover found`);
      failed++;
    }

    // Polite throttle for OL
    await new Promise((r) => setTimeout(r, 200));
  }

  writeFileSync(booksPath, JSON.stringify(books, null, 2) + "\n", "utf8");

  console.log(`\n--- Summary ---`);
  console.log(`✓  ${updated} books with verified covers`);
  console.log(`❌ ${failed} books need manual cover sourcing`);
  console.log(`\nbooks.json rewritten. Re-run ETL with: npm run etl`);
}

main();
