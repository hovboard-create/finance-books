import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Segment = {
  slug: string;
  name: string;
  short_name: string;
  audience: string;
  hero_headline: string;
  hero_subhead: string;
  meta_title: string;
  meta_description: string;
  sort_order: number;
};

type Book = {
  slug: string;
  title: string;
  subtitle: string | null;
  author: string;
  asin: string | null;
  isbn13: string | null;
  year: number | null;
  pages: number | null;
  goodreads_rating: number | null;
  cover_url: string | null;
  takeaway?: string | null;
  key_lessons?: string | null;
  who_its_for?: string | null;
  youtube_id?: string | null;
  buy_warning?: string | null;
};

type BookSegment = {
  book_slug: string;
  segment_slug: string;
  display_rank: number;
};

type Editorial = {
  takeaway?: string;
  key_lessons?: string;
  who_its_for?: string;
  youtube_id?: string | null;
  buy_warning?: string | null;
};

type AmazonRow = {
  asin?: string;
  rating?: number | null;
  rating_count?: number | null;
  price?: number | null;
  price_display?: string | null;
  availability?: string | null;
  updated_at?: string | null;
};

function main() {
  const root = resolve(__dirname, "..");
  const segmentsPath = resolve(root, "data/segments.json");
  const booksPath = resolve(root, "data/books.json");
  const mappingsPath = resolve(root, "data/book_segments.json");
  const editorialPath = resolve(root, "data/editorial.json");
  const dbPath = resolve(root, "db/finance-books.db");

  const segments = JSON.parse(readFileSync(segmentsPath, "utf8")) as Segment[];
  const books = JSON.parse(readFileSync(booksPath, "utf8")) as Book[];
  const mappings = JSON.parse(readFileSync(mappingsPath, "utf8")) as BookSegment[];

  // Editorial content lives in a separate file so writers can iterate on it
  // independently of the metadata. Merged into books at seed time.
  let editorial: Record<string, Editorial> = {};
  try {
    editorial = JSON.parse(readFileSync(editorialPath, "utf8"));
  } catch {
    console.warn(`No editorial.json found — book pages will show placeholders.`);
  }

  // Amazon data lives in its own file because it gets refreshed daily by
  // scripts/refresh-amazon.ts. Decoupling it from books.json prevents
  // hand-curated metadata churn when ratings/prices update.
  const amazonPath = resolve(root, "data/amazon-data.json");
  let amazon: Record<string, AmazonRow> = {};
  try {
    amazon = JSON.parse(readFileSync(amazonPath, "utf8"));
  } catch {
    console.warn(`No amazon-data.json found — book pages will use fallback rating display.`);
  }

  // YouTube data is produced by scripts/fetch-youtube.ts and validated against
  // YouTube's oembed endpoint to avoid hallucinated video IDs.
  const youtubePath = resolve(root, "data/youtube-data.json");
  let youtube: Record<string, { video_id: string }> = {};
  try {
    youtube = JSON.parse(readFileSync(youtubePath, "utf8"));
  } catch {
    // optional file
  }

  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    DROP TABLE IF EXISTS book_segments;
    DROP TABLE IF EXISTS books;
    DROP TABLE IF EXISTS segments;

    CREATE TABLE segments (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      audience TEXT NOT NULL,
      hero_headline TEXT NOT NULL,
      hero_subhead TEXT NOT NULL,
      meta_title TEXT NOT NULL,
      meta_description TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE books (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      author TEXT NOT NULL,
      asin TEXT,
      isbn13 TEXT,
      year INTEGER,
      pages INTEGER,
      goodreads_rating REAL,
      cover_url TEXT,
      takeaway TEXT,
      key_lessons TEXT,
      who_its_for TEXT,
      youtube_id TEXT,
      buy_warning TEXT,
      amazon_rating REAL,
      amazon_rating_count INTEGER,
      amazon_price REAL,
      amazon_price_display TEXT,
      amazon_availability TEXT,
      amazon_updated_at TEXT
    );

    CREATE TABLE book_segments (
      book_slug TEXT NOT NULL REFERENCES books(slug),
      segment_slug TEXT NOT NULL REFERENCES segments(slug),
      display_rank INTEGER NOT NULL,
      PRIMARY KEY (book_slug, segment_slug)
    );
    CREATE INDEX idx_book_segments_segment ON book_segments(segment_slug, display_rank);
    CREATE INDEX idx_book_segments_book ON book_segments(book_slug);
  `);

  const insertSegment = db.prepare(`
    INSERT INTO segments (slug, name, short_name, audience, hero_headline, hero_subhead, meta_title, meta_description, sort_order)
    VALUES (@slug, @name, @short_name, @audience, @hero_headline, @hero_subhead, @meta_title, @meta_description, @sort_order)
  `);

  const insertBook = db.prepare(`
    INSERT INTO books (
      slug, title, subtitle, author, asin, isbn13, year, pages, goodreads_rating, cover_url,
      takeaway, key_lessons, who_its_for, youtube_id, buy_warning,
      amazon_rating, amazon_rating_count, amazon_price, amazon_price_display, amazon_availability, amazon_updated_at
    ) VALUES (
      @slug, @title, @subtitle, @author, @asin, @isbn13, @year, @pages, @goodreads_rating, @cover_url,
      @takeaway, @key_lessons, @who_its_for, @youtube_id, @buy_warning,
      @amazon_rating, @amazon_rating_count, @amazon_price, @amazon_price_display, @amazon_availability, @amazon_updated_at
    )
  `);

  const insertMapping = db.prepare(`
    INSERT INTO book_segments (book_slug, segment_slug, display_rank)
    VALUES (@book_slug, @segment_slug, @display_rank)
  `);

  const tx = db.transaction(() => {
    for (const s of segments) insertSegment.run(s);
    for (const b of books) {
      const ed = editorial[b.slug] ?? {};
      const am = amazon[b.slug] ?? {};
      insertBook.run({
        // Spread the book's own metadata (slug, title, author, asin, cover, etc.),
        // then explicitly set every editorial/amazon column below so each named
        // SQL parameter is always present even when source files omit it.
        ...b,
        // Editorial overrides metadata defaults — book's metadata can still
        // ship a youtube_id, but editorial wins when both are set.
        takeaway: ed.takeaway ?? b.takeaway ?? null,
        key_lessons: ed.key_lessons ?? b.key_lessons ?? null,
        who_its_for: ed.who_its_for ?? b.who_its_for ?? null,
        // Precedence: editorial (manual override) > youtube-data (auto-fetched) > books.json default
        youtube_id: ed.youtube_id ?? youtube[b.slug]?.video_id ?? b.youtube_id ?? null,
        buy_warning: ed.buy_warning ?? b.buy_warning ?? null,
        amazon_rating: am.rating ?? null,
        amazon_rating_count: am.rating_count ?? null,
        amazon_price: am.price ?? null,
        amazon_price_display: am.price_display ?? null,
        amazon_availability: am.availability ?? null,
        amazon_updated_at: am.updated_at ?? null,
      });
    }
    for (const m of mappings) insertMapping.run(m);
  });
  tx();

  const stats = {
    segments: (db.prepare("SELECT COUNT(*) AS n FROM segments").get() as { n: number }).n,
    books: (db.prepare("SELECT COUNT(*) AS n FROM books").get() as { n: number }).n,
    mappings: (db.prepare("SELECT COUNT(*) AS n FROM book_segments").get() as { n: number }).n,
    with_takeaway: (db.prepare("SELECT COUNT(*) AS n FROM books WHERE takeaway IS NOT NULL").get() as { n: number }).n,
  };
  console.log("ETL complete:", stats);

  console.log("\nBooks per segment:");
  const rows = db.prepare(`
    SELECT s.short_name, s.slug, COUNT(*) AS n
    FROM segments s LEFT JOIN book_segments bs ON bs.segment_slug = s.slug
    GROUP BY s.slug
    ORDER BY s.sort_order
  `).all() as Array<{ short_name: string; slug: string; n: number }>;
  for (const r of rows) {
    console.log(`  ${r.short_name.padEnd(22)} ${r.n} books`);
  }

  db.close();
}

main();
