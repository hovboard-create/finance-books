import Database from "better-sqlite3";
import { resolve } from "node:path";
import type { Book, BookWithSegments, Segment } from "./schema";

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dbPath = resolve(process.cwd(), "db/finance-books.db");
  _db = new Database(dbPath, { readonly: true, fileMustExist: true });
  return _db;
}

export function getAllSegments(): Segment[] {
  return db()
    .prepare("SELECT * FROM segments ORDER BY sort_order ASC")
    .all() as Segment[];
}

export function getSegment(slug: string): Segment | null {
  return (
    (db().prepare("SELECT * FROM segments WHERE slug = ?").get(slug) as
      | Segment
      | undefined) ?? null
  );
}

export function getAllBooks(): Book[] {
  return db()
    .prepare("SELECT * FROM books ORDER BY title ASC")
    .all() as Book[];
}

export function getBook(slug: string): Book | null {
  return (
    (db().prepare("SELECT * FROM books WHERE slug = ?").get(slug) as
      | Book
      | undefined) ?? null
  );
}

export function getBookWithSegments(slug: string): BookWithSegments | null {
  const book = getBook(slug);
  if (!book) return null;
  const segments = db()
    .prepare(
      "SELECT segment_slug FROM book_segments WHERE book_slug = ? ORDER BY display_rank ASC"
    )
    .all(slug) as Array<{ segment_slug: string }>;
  return { ...book, segment_slugs: segments.map((s) => s.segment_slug) };
}

export function getBooksForSegment(segmentSlug: string): Book[] {
  return db()
    .prepare(
      `SELECT b.* FROM books b
       JOIN book_segments bs ON bs.book_slug = b.slug
       WHERE bs.segment_slug = ?
       ORDER BY bs.display_rank ASC, b.title ASC`
    )
    .all(segmentSlug) as Book[];
}

export function getRelatedBooks(slug: string, limit = 4): Book[] {
  return db()
    .prepare(
      `SELECT DISTINCT b.* FROM books b
       JOIN book_segments bs ON bs.book_slug = b.slug
       WHERE bs.segment_slug IN (
         SELECT segment_slug FROM book_segments WHERE book_slug = ?
       )
       AND b.slug != ?
       ORDER BY bs.display_rank ASC
       LIMIT ?`
    )
    .all(slug, slug, limit) as Book[];
}

export function getStats(): {
  books: number;
  segments: number;
  with_takeaway: number;
} {
  const d = db();
  return {
    books: (d.prepare("SELECT COUNT(*) AS n FROM books").get() as { n: number })
      .n,
    segments: (
      d.prepare("SELECT COUNT(*) AS n FROM segments").get() as { n: number }
    ).n,
    with_takeaway: (
      d
        .prepare("SELECT COUNT(*) AS n FROM books WHERE takeaway IS NOT NULL")
        .get() as { n: number }
    ).n,
  };
}
