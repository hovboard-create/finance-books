/**
 * Checks every cover_url in books.json with a HEAD request.
 * Flags missing covers or OpenLibrary's "blank" placeholder (1x1 white gif, ~807 bytes).
 *
 * Usage: npx tsx scripts/verify-covers.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Book = {
  slug: string;
  title: string;
  author: string;
  isbn13: string | null;
  cover_url: string | null;
};

async function checkUrl(url: string): Promise<{
  ok: boolean;
  status: number;
  size: number;
  contentType: string | null;
}> {
  try {
    // OpenLibrary returns 302 redirect when a cover doesn't exist.
    // We use redirect:'manual' to detect that, and GET (not HEAD) so we can
    // measure actual byte size for placeholder detection.
    const res = await fetch(url, { redirect: "manual" });
    if (res.status === 302 || res.status === 301) {
      return { ok: false, status: res.status, size: 0, contentType: null };
    }
    const blob = await res.blob();
    return {
      ok: res.ok,
      status: res.status,
      size: blob.size,
      contentType: res.headers.get("content-type"),
    };
  } catch (e) {
    return { ok: false, status: 0, size: 0, contentType: null };
  }
}

async function main() {
  const root = resolve(__dirname, "..");
  const books = JSON.parse(
    readFileSync(resolve(root, "data/books.json"), "utf8")
  ) as Book[];

  console.log(`Checking ${books.length} cover URLs…\n`);

  const results: Array<{ book: Book; result: Awaited<ReturnType<typeof checkUrl>> }> = [];
  for (const book of books) {
    if (!book.cover_url) {
      results.push({ book, result: { ok: false, status: 0, size: 0, contentType: null } });
      continue;
    }
    const result = await checkUrl(book.cover_url);
    results.push({ book, result });
    const flag =
      !result.ok
        ? "❌ MISSING"
        : result.size < 2000
          ? "⚠️  PLACEHOLDER (size " + result.size + ")"
          : "✓";
    console.log(`${flag.padEnd(30)} ${book.title.padEnd(45)} ${result.status} ${result.size}b`);
  }

  console.log("\n--- Summary ---");
  const missing = results.filter((r) => !r.result.ok);
  const placeholders = results.filter((r) => r.result.ok && r.result.size < 2000);
  const good = results.filter((r) => r.result.ok && r.result.size >= 2000);

  console.log(`✓  ${good.length} covers OK`);
  console.log(`⚠️  ${placeholders.length} placeholders (no real cover at OpenLibrary)`);
  console.log(`❌ ${missing.length} missing`);

  if (placeholders.length > 0 || missing.length > 0) {
    console.log("\nNeed alternative covers for:");
    for (const r of [...placeholders, ...missing]) {
      console.log(`  - ${r.book.slug} (${r.book.title})`);
      if (r.book.isbn13) {
        console.log(`      Try: https://books.google.com/books?vid=ISBN${r.book.isbn13}`);
      }
    }
  }
}

main();
