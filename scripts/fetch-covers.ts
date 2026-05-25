/**
 * Pulls cover image URLs from the Google Books API for every book in books.json,
 * and rewrites books.json with the updated cover_url.
 *
 * Google Books API is free, no key required for low volume (~1k req/day).
 * Cover quality: zoom=2 returns ~256x394 — sharp enough for our 24-28 sized thumbnails.
 *
 * Usage: npx tsx scripts/fetch-covers.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Book = {
  slug: string;
  title: string;
  author: string;
  isbn13: string | null;
  cover_url: string | null;
  google_books_id?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  [key: string]: unknown;
};

type GoogleBooksResponse = {
  totalItems: number;
  items?: Array<{
    id: string;
    volumeInfo: {
      title: string;
      authors?: string[];
      averageRating?: number;
      ratingsCount?: number;
      imageLinks?: {
        smallThumbnail?: string;
        thumbnail?: string;
        small?: string;
        medium?: string;
        large?: string;
        extraLarge?: string;
      };
    };
  }>;
};

/**
 * Build a higher-resolution Google Books cover URL.
 * Default thumbnails are zoom=1 (~128x192). zoom=2 is ~256x394.
 * Also force HTTPS and strip edge=curl which adds an annoying page-curl effect.
 */
function upgradeGoogleBooksImageUrl(url: string): string {
  return url
    .replace(/^http:/, "https:")
    .replace(/&edge=curl/, "")
    .replace(/[?&]zoom=\d+/, "")
    .concat(url.includes("?") ? "&zoom=2" : "?zoom=2");
}

async function lookupByIsbn(isbn: string) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as GoogleBooksResponse;
  return data.items?.[0] ?? null;
}

async function lookupByTitleAuthor(title: string, author: string) {
  // Use just first author (split on "&" or "and")
  const firstAuthor = author.split(/\s*[&,]\s*|\s+and\s+/i)[0];
  const q = encodeURIComponent(
    `intitle:"${title.replace(/[*:]/g, "")}" inauthor:"${firstAuthor}"`
  );
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as GoogleBooksResponse;
  return data.items?.[0] ?? null;
}

async function main() {
  const root = resolve(__dirname, "..");
  const booksPath = resolve(root, "data/books.json");
  const books = JSON.parse(readFileSync(booksPath, "utf8")) as Book[];

  console.log(`Fetching covers for ${books.length} books from Google Books…\n`);

  let updated = 0;
  let failed = 0;

  for (const book of books) {
    let item = book.isbn13 ? await lookupByIsbn(book.isbn13) : null;
    let source = "isbn";
    if (!item) {
      item = await lookupByTitleAuthor(book.title, book.author);
      source = "title+author";
    }

    if (!item) {
      console.log(`❌ ${book.title.padEnd(50)} (no match found)`);
      failed++;
      continue;
    }

    const img =
      item.volumeInfo.imageLinks?.extraLarge ??
      item.volumeInfo.imageLinks?.large ??
      item.volumeInfo.imageLinks?.medium ??
      item.volumeInfo.imageLinks?.small ??
      item.volumeInfo.imageLinks?.thumbnail ??
      item.volumeInfo.imageLinks?.smallThumbnail ??
      null;

    if (!img) {
      console.log(`⚠️  ${book.title.padEnd(50)} (matched, no image)`);
      failed++;
      continue;
    }

    const cover = upgradeGoogleBooksImageUrl(img);
    const rating = item.volumeInfo.averageRating ?? null;
    const ratingCount = item.volumeInfo.ratingsCount ?? null;

    book.cover_url = cover;
    book.google_books_id = item.id;
    if (rating) book.rating = rating;
    if (ratingCount) book.rating_count = ratingCount;

    console.log(
      `✓ ${book.title.padEnd(50)} via ${source.padEnd(13)} ${rating ? `★${rating} (${ratingCount})` : "no rating"}`
    );
    updated++;

    // Polite throttle — Google Books allows 1k/day unkeyed, plenty for 25.
    await new Promise((r) => setTimeout(r, 250));
  }

  writeFileSync(booksPath, JSON.stringify(books, null, 2) + "\n", "utf8");

  console.log(`\n--- Summary ---`);
  console.log(`✓  ${updated} books updated`);
  console.log(`❌ ${failed} failed`);
  console.log(`\nbooks.json rewritten. Re-run ETL with: npm run etl`);
}

main();
